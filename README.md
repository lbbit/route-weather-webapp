# Route Weather Webapp

A small web app that:

- Geocodes origin/destination via Amap
- Gets driving route
- Samples waypoint points along the polyline
- Reverse-geocodes each point to city/adcode
- Fetches **live weather** at each waypoint
- Renders route + waypoints on a map and shows an ETA/weather list

## Run

```bash
export AMAP_API_KEY=YOUR_KEY
cd route-weather-webapp
docker compose up --build
```

Open:
- Frontend: http://localhost:5173
- Backend: http://localhost:8000/docs

## Notes

This is a functional rewrite demo. Next steps:
- Aggregate to distinct cities (de-dup by adcode)
- Use forecast API + match weather to ETA time
- Add caching & rate limits
- Better route sampling based on distance & city boundaries
