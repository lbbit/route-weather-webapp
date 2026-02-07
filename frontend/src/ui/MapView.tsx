import React, { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// NOTE: In mainland China, OpenStreetMap default tile servers often time out.
// We default to AMap (Gaode) public tile endpoint for demo purposes.
// Leaflet only supports {s} subdomain variables (not {1-4}).
const DEFAULT_TILE_URL =
  (import.meta as any).env?.VITE_TILE_URL ||
  'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&style=7&x={x}&y={y}&z={z}'

export default function MapView({
  polyPoints,
  waypoints,
}: {
  polyPoints: Array<[number, number]>
  waypoints: Array<{ name: string; location: string; eta_minutes: number; eta_time: string }>
}) {
  const mapRef = useRef<HTMLDivElement | null>(null)
  const leafletRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const tileRef = useRef<L.TileLayer | null>(null)
  const [tileError, setTileError] = useState<string | null>(null)

  useEffect(() => {
    if (!mapRef.current) return
    if (leafletRef.current) return

    const map = L.map(mapRef.current, {
      center: [31.2304, 121.4737],
      zoom: 6,
      zoomControl: true,
    })

    const tile = L.tileLayer(DEFAULT_TILE_URL, {
      maxZoom: 18,
      subdomains: ['1', '2', '3', '4'],
      attribution: 'Map tiles',
    })
    tile.on('tileerror', (e: any) => {
      // Avoid spamming state updates; set once.
      setTileError((prev) => prev || '底图瓦片加载失败（网络/源不可达），已降级为仅显示路线与标注')
      // eslint-disable-next-line no-console
      console.warn('tileerror', e)
    })
    tile.addTo(map)
    tileRef.current = tile

    const layer = L.layerGroup().addTo(map)

    leafletRef.current = map
    layerRef.current = layer

    return () => {
      // React 18 StrictMode will mount->unmount->mount effects in dev.
      // If we don't reset refs here, we may keep a pointer to a removed Leaflet map
      // and later calls like fitBounds will crash (e.g. reading _leaflet_pos).
      try {
        map.remove()
      } finally {
        leafletRef.current = null
        layerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const map = leafletRef.current
    const layer = layerRef.current
    if (!map || !layer) return

    layer.clearLayers()

    if (polyPoints.length > 0) {
      const line = L.polyline(polyPoints, { color: '#3b82f6', weight: 4, opacity: 0.9 })
      line.addTo(layer)
      map.fitBounds(line.getBounds().pad(0.15))
    }

    const labelIcon = (html: string) =>
      L.divIcon({
        className: 'wpLabel',
        html,
        iconSize: undefined,
      })

    for (let i = 0; i < waypoints.length; i++) {
      const wp = waypoints[i]
      if (!wp.location) continue
      const [lng, lat] = wp.location.split(',').map(Number)
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue

      const eta = new Date(wp.eta_time)
      const etaText = Number.isNaN(eta.getTime())
        ? ''
        : eta.toLocaleString(undefined, { hour: '2-digit', minute: '2-digit' })

      const html = `<div class="wpCard">
        <div class="wpName">${wp.name}</div>
        <div class="wpEta">+${wp.eta_minutes}m${etaText ? ` · ${etaText}` : ''}</div>
      </div>`

      // Use divIcon to avoid image asset failures in constrained networks.
      const m = L.marker([lat, lng], { icon: labelIcon(html) })
      m.addTo(layer)
    }
  }, [polyPoints, waypoints])

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative' }}>
      <div ref={mapRef} style={{ height: '100%', width: '100%' }} />
      {tileError ? <div className="mapToast">{tileError}</div> : null}
    </div>
  )
}
