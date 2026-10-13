import { useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { apiClient } from '@/api/client'
import { useApi } from '@/hooks/useApi'
import type { PrioritizeResponse, SupplierDetail } from '@/types/api'
import { MASK, LW, LH } from '@/shared/landMask'
import { CAT, catKey, money, rCol, ago, shortDate, MULT, srcLabel } from '@/shared/core'
import { useModel, type Model, type Sup } from '../data'
import { BandChip, CatChip, EmptyState, ErrorState, LineChart, Loading, useEnter, useGo } from '../ui'

export function SupplierDetailPage() {
  const { id = '' } = useParams()
  const { data } = useModel()
  const detail = useApi<SupplierDetail>(() => apiClient.getSupplierDetail(id), [id])
  const plan = useApi<PrioritizeResponse | null>(() => apiClient.getLatestMitigationPlan().catch(() => null), [])
  if (!data) return null
  const sup = data.byId.get(id)
  if (detail.loading && !detail.data) return <Loading what="this supplier" />
  if (detail.errorStatus === 404 || (!sup && !detail.loading && !detail.data)) {
    return <div className="pgi"><EmptyState title="Supplier not found" action={<GoBack />}>This supplier may have been removed, or the link is out of date.</EmptyState></div>
  }
  if (detail.error || !detail.data || !sup) return <ErrorState what="this supplier" message={detail.error} onRetry={detail.refetch} />
  return <Detail model={data} sup={sup} d={detail.data} plan={plan.data} />
}

function GoBack() {
  const go = useGo()
  return <button className="btn" onClick={() => go.page('suppliers')}>Back to suppliers</button>
}

function Detail({ model, sup: s, d, plan }: { model: Model; sup: Sup; d: SupplierDetail; plan: PrioritizeResponse | null }) {
  const go = useGo()
  const ref = useRef<HTMLDivElement>(null)
  useEnter(ref, s.id)
  const f = d.contributing_factors || {}
  const risk = d.current_risk_score ?? s.risk
  const hist = [...(d.risk_history || [])].sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp))
  const mult = Number(f.criticality_multiplier ?? MULT[s.tier] ?? 1)
  const raw = Number(f.raw_risk ?? (mult ? risk / mult : risk))
  const news = Number(f.news_risk ?? 0), weather = Number(f.weather_risk ?? 0)
  const mx = Math.max(100, raw * mult, news, weather)
  const inPlan = plan ? plan.selected_suppliers.find((x) => x.supplier_id === s.id) : null
  const prevScore = d.previous_risk_score
  const events = [...(d.related_risk_events || [])].sort((a, b) => +new Date(b.detected_at) - +new Date(a.detected_at))
  const top = (f.top_events || []) as NonNullable<typeof f.top_events>

  return (
    <div className="pgi" ref={ref}>
      <div className="dhead">
        <div>
          <span className="small">{s.region}, {s.country}, {s.category}</span>
          <h2>{s.name}</h2>
          <div style={{ display: 'flex', gap: 10, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="tier">Tier {s.tier}</span><BandChip r={risk} /><span className="small">{money(s.spend)} annual spend</span>
          </div>
          <div className="acts" style={{ marginTop: 14 }}>
            <button className="btn" onClick={() => go.network(s.id)}>View blast radius in network</button>
            <button className="btn ghost" onClick={() => go.signals(s.region)}>Signals in {s.region}</button>
            <button className="btn ghost" onClick={() => go.page('optimizer')}>Plan mitigation</button>
          </div>
        </div>
        <div className="bigs"><b>{risk.toFixed(1)}</b>
          <span className="small" style={{ paddingBottom: 8 }}>risk score<br />{prevScore != null ? `${risk - prevScore >= 0 ? '▲' : '▼'} ${Math.abs(risk - prevScore).toFixed(1)} since last refresh` : d.risk_trend || 'first score'}</span>
        </div>
      </div>

      <div className="c s8">
        <div className="ch-h"><h3>Score history</h3><span className="small">Every score the backend has recorded for this supplier</span></div>
        <LineChart label="Risk score history" h={240} threshold={70} xs={hist.map((p) => new Date(p.timestamp).getTime())}
          series={[{ name: s.name.split(' ')[0], v: hist.map((p) => p.risk_score), col: rCol(risk), area: true }]}
          markers={events.map((e) => ({ x: new Date(e.detected_at).getTime(), col: CAT[catKey(e.event_type)], tip: `<b>${e.headline.replace(/"/g, '')}</b>${e.event_type}, ${shortDate(e.detected_at)}` }))} />
      </div>
      <div className="c s4">
        <div className="ch-h"><h3>Location</h3><span className="small">{s.lat.toFixed(2)}°, {s.lon.toFixed(2)}°</span></div>
        <MiniMap model={model} s={s} />
        <div className="kv4"><div><span>Revenue exposed</span><b>{money(s.exposure)}</b></div><div><span>Dependency impact</span><b>{s.impact.toFixed(2)}</b></div></div>
      </div>

      <div className="c s7">
        <div className="ch-h"><h3>How the score is built</h3><span className="small">News and weather risk, combined, then the tier multiplier</span></div>
        {d.current_risk_score == null ? <p className="empty">This supplier has not been scored yet. It gets a score on the next refresh.</p> : (
          <div className="wf">
            <div className="wfr"><span>News signals<br /><span className="small">GDELT headlines, classified and sentiment-scored</span></span><span className="tr"><i style={{ left: 0, width: `${(news / mx) * 100}%`, background: CAT.logistics }} /></span><b>{news.toFixed(1)}</b></div>
            <div className="wfr"><span>Weather signals<br /><span className="small">Open-Meteo severe-weather alerts</span></span><span className="tr"><i style={{ left: 0, width: `${(weather / mx) * 100}%`, background: CAT.weather }} /></span><b>{weather.toFixed(1)}</b></div>
            <div className="wfr tot"><span>Combined, with diminishing returns</span><span className="tr"><i style={{ left: 0, width: `${(raw / mx) * 100}%`, background: '#3B3E46' }} /></span><b>{raw.toFixed(1)}</b></div>
            <div className="wfr"><span>Tier {s.tier} multiplier, ×{mult.toFixed(2)}</span><span className="tr"><i style={{ left: `${(Math.min(raw, raw * mult) / mx) * 100}%`, width: `${(Math.abs(raw * mult - raw) / mx) * 100}%`, background: mult > 1 ? '#D93A12' : '#1F3BFF' }} /></span><b>{mult > 1 ? '+' : '−'}{Math.abs(raw * mult - raw).toFixed(1)}</b></div>
            <div className="wfr tot"><span>Final score{raw * mult > 100 ? ', capped at 100' : ''}</span><span className="tr"><i style={{ left: 0, width: `${(risk / mx) * 100}%`, background: rCol(risk) }} /></span><b>{risk.toFixed(1)}</b></div>
          </div>
        )}
        {top.length > 0 && (<>
          <div className="ch-h" style={{ marginTop: 6 }}><h3>Signals driving it</h3><span className="small">{Number(f.event_count ?? top.length)} in the scoring window</span></div>
          <div className="feed1">{top.map((e) => (
            <div key={e.id} className="fi"><CatChip t={e.event_type} /><span>{e.headline}<small>{srcLabel(e.source)}, {ago(e.detected_at)}</small></span><b className="num">{e.severity != null ? e.severity.toFixed(0) : '–'}</b></div>
          ))}</div>
        </>)}
      </div>
      <div className="c s5">
        <div className="ch-h"><h3>Mitigation</h3><span className="small">{Math.round(s.eff * 100)}% effective for {s.category}</span></div>
        <div className="kv4">
          <div><span>Cost</span><b>{money(inPlan?.mitigation_cost ?? s.cost)}</b></div>
          <div><span>Revenue protected</span><b>{money(inPlan?.expected_protected_revenue ?? s.protected)}</b></div>
          <div><span>Return on spend</span><b>{(inPlan?.efficiency_ratio ?? s.roi).toFixed(1)}×</b></div>
          <div><span>In latest plan</span><b>{plan ? (inPlan ? 'Funded' : 'Not funded') : 'No plan yet'}</b></div>
        </div>
        {inPlan && <p className="small" style={{ margin: 0 }}>{inPlan.reason}</p>}
        <div className="ch-h"><h3>Feeds these product lines</h3></div>
        {(d.dependencies.length ? d.dependencies.map((x) => ({ p: x.company_product, w: x.dependency_weight })) : s.deps.map((x) => ({ p: model.products[x.p], w: x.w }))).map((x) => (
          <div key={x.p} className="pbar" style={{ gridTemplateColumns: 'minmax(0,1fr) 120px 40px' }}><span>{x.p}</span><span className="tr"><i style={{ width: `${x.w * 100}%`, background: '#14161C' }} /></span><b>{x.w.toFixed(2)}</b></div>
        ))}
        <button className="btn" onClick={() => go.page('optimizer')}>Plan mitigation</button>
      </div>

      <div className="c s12">
        <div className="ch-h"><h3>Related signals</h3><span className="small">{events.length} in {s.region}</span></div>
        {events.length ? <div className="feed1">{events.slice(0, 12).map((e) => (
          <div key={e.id} className="fi"><CatChip t={e.event_type} /><span>{e.raw_url ? <a href={e.raw_url} target="_blank" rel="noreferrer">{e.headline}</a> : e.headline}<small>{srcLabel(e.source)}, {e.region}, {ago(e.detected_at)}</small></span><b className="num">{e.severity != null ? e.severity.toFixed(0) : '–'}</b></div>
        ))}</div> : <p className="empty">No signals have touched this supplier's corridor recently.</p>}
      </div>
    </div>
  )
}

function MiniMap({ model, s }: { model: Model; s: Sup }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const draw = () => {
      const r = c.getBoundingClientRect(), pr = Math.min(devicePixelRatio, 2)
      if (!r.width) return
      c.width = r.width * pr; c.height = r.height * pr
      const g = c.getContext('2d')!
      g.setTransform(pr, 0, 0, pr, 0, 0)
      const span = 24, k = r.width / span, lon0 = s.lon - span / 2, lat0 = s.lat + r.height / k / 2
      const P = (la: number, lo: number) => [(lo - lon0) * k, (lat0 - la) * k]
      g.fillStyle = '#14161C'
      for (let row = 0; row < LH; row++) {
        const la = 84 - row * (142 / (LH - 1))
        if (la > lat0 + 1 || la < lat0 - r.height / k - 1) continue
        for (let col = 0; col < LW; col++) {
          const lo = -180 + col * 0.75
          if (lo < lon0 - 1 || lo > lon0 + span + 1) continue
          if (MASK[row * LW + col]) { const [x, y] = P(la, lo); g.globalAlpha = 0.35; g.fillRect(x - 1.4, y - 1.4, 2.8, 2.8) }
        }
      }
      g.globalAlpha = 1
      model.suppliers.forEach((o) => {
        const [x, y] = P(o.lat, o.lon)
        if (x < 0 || x > r.width || y < 0 || y > r.height) return
        g.beginPath(); g.arc(x, y, o === s ? 8 : 4, 0, 7); g.fillStyle = rCol(o.risk); g.fill(); g.strokeStyle = '#F7F6F1'; g.lineWidth = 2; g.stroke()
      })
      const [x, y] = P(s.lat, s.lon)
      g.beginPath(); g.arc(x, y, 14, 0, 7); g.strokeStyle = '#14161C'; g.lineWidth = 1.5; g.stroke()
    }
    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(c)
    return () => ro.disconnect()
  }, [model, s])
  return <canvas className="minimap" ref={ref} aria-label={`Map of ${s.name} and nearby suppliers`} />
}
