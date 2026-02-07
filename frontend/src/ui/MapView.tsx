import React, { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix default marker icons when bundling
// @ts-ignore
import marker2x from 'leaflet/dist/images/marker-icon-2x.png'
// @ts-ignore
import marker1x from 'leaflet/dist/images/marker-icon.png'
// @ts-ignore
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

L.Icon.Default.mergeOptions({
  iconRetinaUrl: marker2x,
  iconUrl: marker1x,
  shadowUrl: markerShadow,
})

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

  useEffect(() => {
    if (!mapRef.current) return
    if (leafletRef.current) return

    const map = L.map(mapRef.current, {
      center: [31.2304, 121.4737],
      zoom: 6,
      zoomControl: true,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '© OpenStreetMap',
    }).addTo(map)

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

    for (const wp of waypoints) {
      if (!wp.location) continue
      const [lng, lat] = wp.location.split(',').map(Number)
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue
      const eta = new Date(wp.eta_time)
      const etaText = Number.isNaN(eta.getTime())
        ? wp.eta_time
        : eta.toLocaleString(undefined, { hour: '2-digit', minute: '2-digit' })
      const m = L.marker([lat, lng]).bindPopup(
        `<b>${wp.name}</b><br/>ETA: +${wp.eta_minutes} 分钟（${etaText}）`
      )
      m.addTo(layer)
    }
  }, [polyPoints, waypoints])

  return <div ref={mapRef} style={{ height: '100%', width: '100%' }} />
}
