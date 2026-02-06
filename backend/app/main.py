from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

AMAP_BASE_V3 = "https://restapi.amap.com/v3"
AMAP_BASE_V5 = "https://restapi.amap.com/v5"


def get_env(name: str) -> str:
    v = os.getenv(name)
    if not v:
        raise RuntimeError(f"Missing env var: {name}")
    return v


class RouteRequest(BaseModel):
    origin: str = Field(..., description="Origin city/address")
    destination: str = Field(..., description="Destination city/address")
    strategy: Literal["fastest", "avoid_highway", "avoid_tolls", "avoid_congestion"] = "fastest"
    depart_at: datetime | None = Field(
        default=None,
        description="Optional departure time (ISO8601). Defaults to now (Asia/Shanghai assumed by client).",
    )


class WaypointWeather(BaseModel):
    name: str
    location: str
    eta_minutes: int
    eta_time: datetime
    adcode: str | None = None
    weather: dict[str, Any] | None


class RouteResponse(BaseModel):
    origin: dict[str, Any]
    destination: dict[str, Any]
    distance_m: int
    duration_s: int
    polyline: str
    waypoints: list[WaypointWeather]


app = FastAPI(title="Route Weather API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"] ,
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


async def amap_geocode(client: httpx.AsyncClient, address: str, key: str) -> dict[str, Any]:
    r = await client.get(f"{AMAP_BASE_V3}/geocode/geo", params={"address": address, "key": key})
    r.raise_for_status()
    data = r.json()
    if data.get("status") != "1" or not data.get("geocodes"):
        raise HTTPException(400, f"Geocode failed for '{address}': {data}")
    g = data["geocodes"][0]
    return {"formatted": g.get("formatted_address") or address, "location": g["location"]}


def strategy_to_amap(strategy: str) -> str:
    # Amap driving strategy:
    # 0 fastest, 1 avoid highways, 2 avoid tolls, 3 avoid congestion
    return {
        "fastest": "0",
        "avoid_highway": "1",
        "avoid_tolls": "2",
        "avoid_congestion": "3",
    }[strategy]


async def amap_route(client: httpx.AsyncClient, origin_loc: str, dest_loc: str, key: str, strategy: str) -> dict[str, Any]:
    # Use v5 driving API to be closer to wow repo (supports richer fields in show_fields).
    r = await client.get(
        f"{AMAP_BASE_V5}/direction/driving",
        params={
            "origin": origin_loc,
            "destination": dest_loc,
            "strategy": strategy_to_amap(strategy),
            # keep response small but include city crossing data
            "show_fields": "cost,cities,polyline",
            "key": key,
        },
    )
    r.raise_for_status()
    data = r.json()
    if data.get("status") != "1" or not data.get("route", {}).get("paths"):
        raise HTTPException(400, f"Route failed: {data}")
    return data


def extract_cross_cities_v5(path: dict[str, Any]) -> list[dict[str, str]]:
    """Extract unique cross cities from v5 driving response path.

    wow repo uses show_fields=cities and iterates step['cities'][]. Here we keep a similar idea
    but dedupe by adcode.
    """
    out: list[dict[str, str]] = []
    seen: set[str] = set()
    for step in path.get("steps", []) or []:
        for c in step.get("cities", []) or []:
            ad = c.get("adcode")
            nm = c.get("city")
            if not ad or ad in seen:
                continue
            seen.add(ad)
            out.append({"adcode": ad, "name": nm or ad})
    return out


async def amap_weather_live(client: httpx.AsyncClient, adcode_or_city: str, key: str) -> dict[str, Any] | None:
    # live weather by city/adcode
    r = await client.get(
        f"{AMAP_BASE_V3}/weather/weatherInfo",
        params={"city": adcode_or_city, "extensions": "base", "key": key},
    )
    r.raise_for_status()
    data = r.json()
    if data.get("status") != "1" or not data.get("lives"):
        return None
    return data["lives"][0]


async def amap_regeo_citycode(client: httpx.AsyncClient, location: str, key: str) -> dict[str, Any] | None:
    # Reverse geocode a point, extract city/adcode
    r = await client.get(
        f"{AMAP_BASE_V3}/geocode/regeo",
        params={"location": location, "radius": 1000, "extensions": "base", "key": key},
    )
    r.raise_for_status()
    data = r.json()
    if data.get("status") != "1":
        return None
    comp = data.get("regeocode", {}).get("addressComponent", {})
    adcode = comp.get("adcode")
    city = comp.get("city") or comp.get("province")
    return {"adcode": adcode, "city": city}


def pick_waypoint_points(steps: list[dict[str, Any]], max_points: int = 12) -> list[tuple[str, int]]:
    """Pick representative points along the route polyline.

    Returns list of (location, eta_minutes_from_start).

    We approximate ETA by distributing total duration proportionally by step duration.
    """
    # Flatten segments: each step has polyline, duration, distance
    segments: list[tuple[list[str], int]] = []
    total = 0
    for st in steps:
        dur = int(float(st.get("duration", 0)))
        total += dur
        poly = st.get("polyline", "")
        pts = poly.split(";") if poly else []
        if pts:
            segments.append((pts, dur))

    if total <= 0 or not segments:
        return []

    # sample points across time
    target_times = [int(total * (i + 1) / (max_points + 1)) for i in range(max_points)]

    out: list[tuple[str, int]] = []
    t_acc = 0
    seg_idx = 0
    for tt in target_times:
        while seg_idx < len(segments) and t_acc + segments[seg_idx][1] < tt:
            t_acc += segments[seg_idx][1]
            seg_idx += 1
        if seg_idx >= len(segments):
            break
        pts, dur = segments[seg_idx]
        if dur <= 0:
            continue
        frac = max(0.0, min(1.0, (tt - t_acc) / dur))
        pt_idx = int(frac * (len(pts) - 1)) if len(pts) > 1 else 0
        loc = pts[pt_idx]
        eta_min = int(tt / 60)
        out.append((loc, eta_min))

    # de-dup by location
    seen = set()
    dedup: list[tuple[str, int]] = []
    for loc, eta_min in out:
        if loc in seen:
            continue
        seen.add(loc)
        dedup.append((loc, eta_min))
    return dedup


@app.post("/api/route", response_model=RouteResponse)
async def route_weather(req: RouteRequest) -> RouteResponse:
    amap_key = get_env("AMAP_API_KEY")

    async with httpx.AsyncClient(timeout=20) as client:
        origin = await amap_geocode(client, req.origin, amap_key)
        dest = await amap_geocode(client, req.destination, amap_key)

        data = await amap_route(client, origin["location"], dest["location"], amap_key, req.strategy)

        path = data["route"]["paths"][0]
        distance_m = int(float(path.get("distance", 0)))
        duration_s = int(float(path.get("duration", 0)))
        steps = path.get("steps", [])

        # collect full polyline (steps joined)
        polyline = ";".join([s.get("polyline", "") for s in steps if s.get("polyline")])

        depart_at = req.depart_at
        if depart_at is None:
            depart_at = datetime.now(timezone.utc)

        # Prefer "cross cities" list if v5 provides it (closer to wow logic).
        cross_cities = extract_cross_cities_v5(path)

        waypoints: list[WaypointWeather] = []

        if cross_cities:
            # For each cross city, geocode city name to put a marker.
            # ETA is approximated by evenly distributing total duration across cities.
            n = len(cross_cities)
            for i, city in enumerate(cross_cities):
                # Best-effort location: geocode by city name
                try:
                    g = await amap_geocode(client, city["name"], amap_key)
                    loc = g["location"]
                    name = g["formatted"]
                except Exception:
                    loc = ""
                    name = city["name"]

                eta_min = int(((i + 1) / (n + 1)) * (duration_s / 60)) if duration_s > 0 else 0
                eta_time = depart_at + timedelta(minutes=eta_min)
                weather = await amap_weather_live(client, city["adcode"], amap_key)

                if loc:
                    waypoints.append(
                        WaypointWeather(
                            name=name,
                            location=loc,
                            eta_minutes=eta_min,
                            eta_time=eta_time,
                            adcode=city["adcode"],
                            weather=weather,
                        )
                    )
        else:
            # Fallback: sample points along polyline and reverse geocode
            points = pick_waypoint_points(steps, max_points=12)
            for idx, (loc, eta_min) in enumerate(points, start=1):
                regeo = await amap_regeo_citycode(client, loc, amap_key)
                weather = None
                name = regeo.get("city") if regeo else f"Waypoint {idx}"
                adcode = regeo.get("adcode") if regeo else None
                city_key = adcode or (regeo.get("city") if regeo else None)
                if city_key:
                    weather = await amap_weather_live(client, city_key, amap_key)

                eta_time = depart_at + timedelta(minutes=eta_min)
                waypoints.append(
                    WaypointWeather(
                        name=name,
                        location=loc,
                        eta_minutes=eta_min,
                        eta_time=eta_time,
                        adcode=adcode,
                        weather=weather,
                    )
                )

        return RouteResponse(
            origin=origin,
            destination=dest,
            distance_m=distance_m,
            duration_s=duration_s,
            polyline=polyline,
            waypoints=waypoints,
        )
