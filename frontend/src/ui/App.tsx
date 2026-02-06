import React, { useMemo, useState } from 'react'
import MapView from './MapView'
import ResultsPanel from './ResultsPanel'

type RouteResp = {
  origin: { formatted: string; location: string }
  destination: { formatted: string; location: string }
  distance_m: number
  duration_s: number
  polyline: string
  waypoints: Array<{
    name: string
    location: string
    eta_minutes: number
    eta_time: string
    weather: any | null
  }>
}

export default function App() {
  const [origin, setOrigin] = useState('上海')
  const [destination, setDestination] = useState('杭州')
  const [strategy, setStrategy] = useState<'fastest' | 'avoid_highway' | 'avoid_tolls' | 'avoid_congestion'>(
    'fastest'
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<RouteResp | null>(null)

  const polyPoints = useMemo(() => {
    if (!data?.polyline) return []
    return data.polyline.split(';').map((p) => {
      const [lng, lat] = p.split(',').map(Number)
      return [lat, lng] as [number, number]
    })
  }, [data])

  async function onSearch() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin, destination, strategy }),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text)
      }
      const json = (await res.json()) as RouteResp
      setData(json)
    } catch (e: any) {
      setError(e?.message || String(e))
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app">
      <header className="header">
        <div>
          <div className="title">Route Weather</div>
          <div className="subtitle">基于高德路线 + 途经点实时天气（Demo）</div>
        </div>
        <div className="form">
          <input value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="出发地" />
          <span className="arrow">→</span>
          <input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="目的地" />
          <select value={strategy} onChange={(e) => setStrategy(e.target.value as any)}>
            <option value="fastest">最快</option>
            <option value="avoid_highway">不走高速</option>
            <option value="avoid_tolls">不走收费</option>
            <option value="avoid_congestion">躲避拥堵</option>
          </select>
          <button disabled={loading} onClick={onSearch}>
            {loading ? '查询中…' : '查询'}
          </button>
        </div>
      </header>

      <main className="main">
        <div className="map">
          <MapView polyPoints={polyPoints} waypoints={data?.waypoints || []} />
        </div>
        <div className="panel">
          {error ? <div className="error">{error}</div> : null}
          <ResultsPanel data={data} />
        </div>
      </main>

      <footer className="footer">
        提示：这是一个重写版示例。后续可加入：按行政区聚合途经城市、天气预报（按 ETA 时间）、缓存与配额控制。
      </footer>
    </div>
  )
}
