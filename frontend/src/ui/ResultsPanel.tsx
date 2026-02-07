import React from 'react'

function fmtMinutes(mins: number) {
  if (!Number.isFinite(mins)) return '-'
  const m = Math.max(0, Math.round(mins))
  const h = Math.floor(m / 60)
  const mm = m % 60
  if (h <= 0) return `${mm} 分钟`
  if (mm === 0) return `${h} 小时`
  return `${h} 小时 ${mm} 分钟`
}

function fmtTime(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export default function ResultsPanel({ data }: { data: any | null }) {
  if (!data) {
    return (
      <div className="card">
        <div className="cardTitle">结果</div>
        <div className="muted">输入起点/终点并点击“查询”。</div>
      </div>
    )
  }

  const km = (data.distance_m / 1000).toFixed(1)
  const mins = Math.round(data.duration_s / 60)
  const durationText = mins > 0 ? fmtMinutes(mins) : data.duration_s ? `${data.duration_s}s` : '—'

  return (
    <div className="stack">
      <div className="card">
        <div className="cardTitle">路线概览</div>
        <div className="kv">
          <div>
            <div className="k">起点</div>
            <div className="v">{data.origin.formatted}</div>
          </div>
          <div>
            <div className="k">终点</div>
            <div className="v">{data.destination.formatted}</div>
          </div>
          <div>
            <div className="k">距离</div>
            <div className="v">{km} km</div>
          </div>
          <div>
            <div className="k">预计用时</div>
            <div className="v">约 {durationText}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="cardTitle">途经点天气（按 ETA 选择：近程实时 / 远程预报）</div>
        <div className="list">
          {data.waypoints.map((wp: any, i: number) => {
            const w = wp.weather
            const source = wp.weather_source
            const isDest = i === data.waypoints.length - 1
            return (
              <div className={isDest ? 'row rowDest' : 'row'} key={i}>
                <div className="rowMain">
                  <div className="rowTitle">
                    {wp.name} <span className="pill">+{wp.eta_minutes}m</span>
                    {source ? <span className={source === 'forecast' ? 'tag tagForecast' : 'tag'}>{source}</span> : null}
                  </div>
                  <div className="rowSub">ETA {fmtTime(wp.eta_time)}</div>
                  {wp.weather_error ? <div className="rowHint">{wp.weather_error}</div> : null}
                </div>
                <div className="rowRight">
                  {w ? (
                    <>
                      <div className="temp">{w.temperature}°C</div>
                      <div className="muted">{w.weather}</div>
                      {w.windpower || w.winddirection ? (
                        <div className="muted">
                          {w.winddirection ? `${w.winddirection}风` : ''}{w.windpower ? ` ${w.windpower}级` : ''}
                        </div>
                      ) : null}
                      {w.humidity ? <div className="muted">湿度 {w.humidity}%</div> : null}
                    </>
                  ) : (
                    <div className="muted">数据暂不可用</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
