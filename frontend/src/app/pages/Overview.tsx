import { useCallback, useMemo, useRef } from 'react'
import { CAT, catKey, money, rCol, ago, shortDate } from '@/shared/core'
import { useModel, prodRisk, type Model } from '../data'
import { FieldView } from '../FieldView'
import { CatChip, EmptyState, LineChart, ScoreChip, Spark, useEnter, useGo } from '../ui'

function nearest<T extends { timestamp: string }>(arr: T[], t: number) {
  let best: T | null = null, bd = Infinity
  arr.forEach((p) => { const d = Math.abs(new Date(p.timestamp).getTime() - t); if (d < bd) { bd = d; best = p } })
  return best as T | null
}

export function OverviewPage() {
  const { data } = useModel()
  const ref = useRef<HTMLDivElement>(null)
  useEnter(ref, 'overview')
  if (!data) return null
  if (!data.suppliers.length) {
    return (
      <div className="pgi" ref={ref}>
        <EmptyState title="No supplier data yet">Run <code>python -m app.seed</code> in the backend to load the example suppliers, then refresh.</EmptyState>
      </div>
    )
  }
  return <Overview data={data} innerRef={ref} />
}

function Overview({ data, innerRef }: { data: Model; innerRef: React.RefObject<HTMLDivElement | null> }) {
  const go = useGo()
  const S = data.suppliers
  const sum = data.summary
  const trend = useMemo(() => (sum?.risk_trend || []).slice().sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp)), [sum])
  const last = trend[trend.length - 1]
  const prev = last ? nearest(trend, new Date(last.timestamp).getTime() - 7 * 86400000) : null
  const avg = sum?.average_risk ?? S.reduce((a, s) => a + s.risk, 0) / S.length
  const crit = S.filter((s) => s.risk >= 70).sort((a, b) => b.risk - a.risk)
  const exposure = S.reduce((a, s) => a + s.exposure, 0)
  const protectable = S.reduce((a, s) => a + s.protected, 0)
  const events = sum?.recent_events || []
  const delta = (a: number | undefined, b: number | undefined, f: (v: number) => string) =>
    a == null || b == null ? 'No earlier score to compare' : `${a - b >= 0 ? '▲' : '▼'} ${f(Math.abs(a - b))} vs 7 days earlier`

  // headline per supplier from the most recent event that names it
  const headline = new Map<string, string>()
  events.forEach((e) => e.affected_suppliers.forEach((n) => { if (!headline.has(n)) headline.set(n, e.headline) }))
  const attention = (crit.length ? crit : [...S].sort((a, b) => b.risk - a.risk).slice(0, 5)).slice(0, 7)

  // signals per day for the last 14 days
  const perDay = Array.from({ length: 14 }, (_, i) => {
    const d0 = Date.now() - (13 - i) * 86400000
    return events.filter((e) => Math.abs(new Date(e.detected_at).getTime() - d0) < 43200000).length
  })
  const open = useCallback((id: string) => go.supplier(id), [go])

  return (
    <div className="pgi" ref={innerRef}>
      <div className="c flush s12">
        <div className="kband">
          <div><span className="l">Average supplier risk</span><b>{avg.toFixed(1)}</b><span className="d">{delta(last?.average_risk, prev && prev !== last ? prev.average_risk : undefined, (v) => v.toFixed(1))}</span><Spark vals={trend.map((x) => x.average_risk)} /></div>
          <div><span className="l">Critical suppliers</span><b>{crit.length}</b><span className="d">{delta(last?.high_risk_count, prev && prev !== last ? prev.high_risk_count : undefined, (v) => String(v))}</span><Spark vals={trend.map((x) => x.high_risk_count)} col="#D93A12" /></div>
          <div><span className="l">Revenue exposed</span><b>{money(exposure)}</b><span className="d">{money(protectable)} recoverable with mitigation</span><Spark vals={trend.map((x) => x.average_risk)} /></div>
          <div><span className="l">Signals, recent</span><b>{sum?.recent_event_count ?? events.length}</b><span className="d">Latest {events[0] ? ago(events[0].detected_at) : 'none yet'}</span><Spark vals={perDay} /></div>
        </div>
      </div>

      <div className="c flush s8">
        <div className="ch-h" style={{ padding: '16px 18px 0' }}><h3>Risk field</h3><span className="small">Height is risk. Drag to look around, click a peak to open it, pinch or ⌘ + scroll to zoom.</span></div>
        <FieldView model={data} onOpen={open} />
      </div>
      <div className="c s4">
        <div className="ch-h"><h3>Needs attention</h3><span className="small">{crit.length} critical</span></div>
        <div className="att">
          {attention.map((s) => (
            <button key={s.id} className="ar" onClick={() => go.supplier(s.id)}>
              <span className="st" style={{ background: rCol(s.risk) }} />
              <span style={{ minWidth: 0 }}><span className="t">{s.name}</span><small>{headline.get(s.name) || `${s.category}, ${s.country}`}</small></span>
              <ScoreChip r={s.risk} />
            </button>
          ))}
        </div>
      </div>

      <div className="c s8">
        <div className="ch-h"><h3>Average risk across all suppliers</h3>
          <span className="legend">{[...new Set(events.map((e) => catKey(e.event_type)))].map((c) => <span key={c}><i style={{ background: CAT[c], borderRadius: 1, transform: 'rotate(45deg)' }} />{c}</span>)}</span>
        </div>
        <LineChart label="Average supplier risk over time with signal markers" h={230} threshold={70}
          xs={trend.map((p) => new Date(p.timestamp).getTime())}
          series={[{ name: 'Average risk', v: trend.map((p) => p.average_risk), col: '#14161C', area: true }]}
          markers={events.map((e) => ({ x: new Date(e.detected_at).getTime(), col: CAT[catKey(e.event_type)], tip: `<b>${e.headline.replace(/"/g, '')}</b>${e.event_type}, ${e.region}, ${shortDate(e.detected_at)}` }))} />
      </div>
      <div className="c s4">
        <div className="ch-h"><h3>Product line exposure</h3><span className="small">Dependency-weighted risk</span></div>
        {data.products.map((p, i) => {
          const v = prodRisk(data, i)
          return (
            <div key={p} className="pbar" data-tip={`<b>${p}</b>Weighted risk ${v.toFixed(1)}, ${data.deps.filter((d) => d[0] === i).length} suppliers`}>
              <span>{p}</span><span className="tr"><i style={{ width: `${v}%`, background: rCol(v) }} /></span><b>{v.toFixed(0)}</b>
            </div>
          )
        })}
        <p className="small" style={{ margin: 0 }}>Each supplier's risk, weighted by how much the product depends on it.</p>
      </div>

      <div className="c s8">
        <div className="ch-h"><h3>Risk by corridor</h3><span className="small">Average, highest and critical suppliers per corridor</span></div>
        {(sum?.regional_risk?.length ? sum.regional_risk : data.regions.map((r) => {
          const ss = S.filter((s) => s.region === r)
          return { region: r, supplier_count: ss.length, average_risk: ss.reduce((a, s) => a + s.risk, 0) / (ss.length || 1), highest_risk: Math.max(0, ...ss.map((s) => s.risk)), high_risk_supplier_count: ss.filter((s) => s.risk >= 70).length }
        })).map((r) => (
          <div key={r.region} className="pbar corr" data-tip={`<b>${r.region}</b>${r.supplier_count} suppliers<br>Highest <span class='tv'>${r.highest_risk.toFixed(1)}</span>`}>
            <span>{r.region}<small className="small" style={{ display: 'block' }}>{r.supplier_count} suppliers, {r.high_risk_supplier_count} critical</small></span>
            <span className="tr"><i style={{ width: `${r.average_risk}%`, background: rCol(r.average_risk) }} /><em style={{ left: `${r.highest_risk}%` }} /></span>
            <b>{r.average_risk.toFixed(0)}</b>
          </div>
        ))}
        <p className="small" style={{ margin: 0 }}>Bar is the corridor average. The tick marks its riskiest supplier.</p>
      </div>
      <div className="c s4">
        <div className="ch-h"><h3>Latest signals</h3><button className="btn ghost" onClick={() => go.signals()}>All signals</button></div>
        <div className="feed1">
          {events.length ? events.slice(0, 5).map((e) => (
            <div key={e.id} className="fi"><CatChip t={e.event_type} /><span>{e.headline}<small>{e.region}, {ago(e.detected_at)}</small></span><b className="num">{e.severity != null ? e.severity.toFixed(0) : '–'}</b></div>
          )) : <p className="empty">No signals recorded yet. They appear after the first scheduled refresh.</p>}
        </div>
      </div>
    </div>
  )
}
