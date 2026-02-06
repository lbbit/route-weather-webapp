import React from 'react'

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
            <div className="v">约 {mins} 分钟</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="cardTitle">途经点天气（实时）</div>
        <div className="list">
          {data.waypoints.map((wp: any, i: number) => {
            const w = wp.weather
            return (
              <div className="row" key={i}>
                <div className="rowMain">
                  <div className="rowTitle">
                    {wp.name} <span className="pill">+{wp.eta_minutes}m</span>
                  </div>
                  <div className="rowSub">{new Date(wp.eta_time).toLocaleString()}</div>
                </div>
                <div className="rowRight">
                  {w ? (
                    <>
                      <div className="temp">{w.temperature}°C</div>
                      <div className="muted">{w.weather}</div>
                    </>
                  ) : (
                    <div className="muted">无数据</div>
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
