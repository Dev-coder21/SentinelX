import { useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { apiClient } from '@/api/client'
import { useApi } from '@/hooks/useApi'
import type { RiskEvent } from '@/types/api'
import { CAT, CATS, catKey, catLabel, daysSince, daysOld, shortDate, srcLabel } from '@/shared/core'
import { useModel } from '../data'
import { CatChip, EmptyState, ErrorState, Loading, useEnter, useGo, useWidth } from '../ui'

export function SignalsPage() {
  const res = useApi<RiskEvent[]>(() => apiClient.getRiskEvents({ limit: 200 }), [])
  if (res.loading && !res.data) return <Loading what="signals" />
  if (res.error || !res.data) return <ErrorState what="signals" message={res.error} onRetry={res.refetch} />
  if (!res.data.length) {
    return <div className="pgi"><EmptyState title="No risk events recorded">Signals appear after the first scheduled refresh polls GDELT and Open-Meteo.</EmptyState></div>
  }
  return <Signals events={res.data} />
}

function Signals({ events }: { events: RiskEvent[] }) {
  const { data } = useModel()
  const go = useGo()
  const [params, setParams] = useSearchParams()
  const ref = useRef<HTMLDivElement>(null)
  useEnter(ref, 'signals')
  const [cat, setCat] = useState<string | null>(null)
  const [src, setSrc] = useState<string>('')
  const [min, setMin] = useState(0)
  const [q, setQ] = useState('')
  const reg = params.get('region') || ''
  const setReg = (v: string) => { const p = new URLSearchParams(params); if (v) p.set('region', v); else p.delete('region'); setParams(p, { replace: true }) }

  const sorted = useMemo(() => [...events].sort((a, b) => +new Date(b.detected_at) - +new Date(a.detected_at)), [events])
  const sources = [...new Set(events.map((e) => e.source))]
  const regions = [...new Set([...(data?.regions || []), ...events.map((e) => e.region)])]
  const cats = CATS.filter((c) => events.some((e) => catKey(e.event_type) === c))
  const ql = q.trim().toLowerCase()
  const shown = sorted.filter((e) => (!cat || catKey(e.event_type) === cat) && (!src || e.source === src) && (!reg || e.region === reg) && (e.severity ?? 0) >= min &&
    (!ql || `${e.headline} ${e.summary || ''} ${e.region} ${e.event_type}`.toLowerCase().includes(ql)))
  const anyF = cat || src || reg || min > 0 || q
  const clear = () => { setCat(null); setSrc(''); setMin(0); setQ(''); setReg('') }

  return (
    <div className="pgi" ref={ref}>
      <div className="c s12">
        <div className="ch-h"><h3>Signals per day, by category</h3><span className="legend">{cats.map((c) => <span key={c}><i style={{ background: CAT[c], borderRadius: 1 }} />{c}</span>)}</span></div>
        <DayBars events={sorted} />
      </div>
      <div className="s12 fbar">
        <div className="frow">
          <label className="search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search headline, place or category" aria-label="Search signals" style={{ width: 280, maxWidth: '100%' }} />
          </label>
          <label className="small" htmlFor="sigsrc">Source</label>
          <select className="sel" id="sigsrc" value={src} onChange={(e) => setSrc(e.target.value)}><option value="">All sources</option>{sources.map((v) => <option key={v} value={v}>{srcLabel(v)}</option>)}</select>
          <label className="small" htmlFor="sigreg">Corridor</label>
          <select className="sel" id="sigreg" value={reg} onChange={(e) => setReg(e.target.value)}><option value="">All corridors</option>{regions.map((v) => <option key={v} value={v}>{v}</option>)}</select>
          <label className="small" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>Minimum severity
            <input type="range" min={0} max={80} step={5} value={min} onChange={(e) => setMin(+e.target.value)} style={{ width: 140, ['--p' as string]: `${(min / 80) * 100}%` }} />
            <b className="num" style={{ minWidth: 20, color: 'var(--ink)' }}>{min}</b>
          </label>
        </div>
        <div className="frow" style={{ justifyContent: 'space-between' }}>
          <div className="chips">{[null, ...cats].map((c) => <button key={c || 'all'} aria-pressed={cat === c} onClick={() => setCat(c)}>{c ? c[0].toUpperCase() + c.slice(1) : 'All categories'}</button>)}</div>
          <span className="small">Showing {shown.length} of {events.length} signals {anyF && <button className="lnk" style={{ marginLeft: 8 }} onClick={clear}>Clear filters</button>}</span>
        </div>
      </div>
      <div className="c s12">
        {shown.length ? shown.map((e) => {
          const age = daysSince(e.detected_at)
          const hit = (data?.suppliers || []).filter((s) => s.region === e.region).sort((a, b) => b.risk - a.risk).slice(0, 4)
          return (
            <div key={e.id} className="fi sigrow">
              <div><CatChip t={e.event_type} /><div className="small" style={{ marginTop: 8 }}>{shortDate(e.detected_at)}<br />{daysOld(age)}</div></div>
              <div>
                <b style={{ fontSize: 16, fontWeight: 650 }}>{e.raw_url ? <a href={e.raw_url} target="_blank" rel="noreferrer">{e.headline}</a> : e.headline}</b>
                {e.summary && <p className="small" style={{ margin: '4px 0 0' }}>{e.summary}</p>}
                <div className="small" style={{ margin: '4px 0 10px' }}>
                  {srcLabel(e.source)}, {e.region}, {catLabel(e.event_type).toLowerCase()}{e.confidence != null ? `, confidence ${(e.confidence * (e.confidence <= 1 ? 100 : 1)).toFixed(0)}%` : ''}, sentiment {e.sentiment_score.toFixed(2)}{e.classification_source ? `, classified by ${e.classification_source}` : ''}
                </div>
                {hit.length > 0 && <div className="chips">{hit.map((s) => <button key={s.id} style={{ minHeight: 30, fontSize: 12.5 }} onClick={() => go.supplier(s.id)}>{s.name}</button>)}</div>}
              </div>
              <div style={{ textAlign: 'right' }}><div className="small">Severity</div><div className="bigv" style={{ fontSize: 44 }}>{e.severity != null ? e.severity.toFixed(0) : '–'}</div></div>
            </div>
          )
        }) : (
          <p className="empty"><b style={{ color: 'var(--ink)' }}>No signals match these filters.</b> <button className="lnk" onClick={clear}>Clear filters</button></p>
        )}
      </div>
    </div>
  )
}

function DayBars({ events }: { events: RiskEvent[] }) {
  const [ref, W] = useWidth<SVGSVGElement>(900)
  const n = 30, H = 150, L = 28, B = H - 24, T = 10
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const days = Array.from({ length: n }, (_, i) => {
    const d0 = today.getTime() - (n - 1 - i) * 86400000
    return events.filter((e) => { const t = new Date(e.detected_at).getTime(); return t >= d0 && t < d0 + 86400000 })
  })
  const maxC = Math.max(2, ...days.map((d) => d.length))
  const bw = (W - L) / n, Y = (v: number) => B - ((B - T) * v) / maxC
  return (
    <svg ref={ref} className="chart" viewBox={`0 0 ${W} ${H}`} style={{ height: H }} role="img" aria-label="Signals detected per day by category">
      {[0, Math.round(maxC / 2), maxC].map((v) => (
        <g key={v}><line x1={L} x2={W} y1={Y(v)} y2={Y(v)} stroke="rgba(20,22,28,.08)" /><text x={L - 8} y={Y(v) + 4} fontSize="11" textAnchor="end" fill="#5B5E66">{v}</text></g>
      ))}
      {days.map((es, i) => {
        let y0 = B
        const h = (B - T) / maxC
        return es.map((e) => {
          const r = <rect key={e.id} x={L + i * bw + 2} y={y0 - h + 1} width={Math.max(1, bw - 4)} height={Math.max(1, h - 2)} rx="2" fill={CAT[catKey(e.event_type)]} data-tip={`<b>${e.headline.replace(/"/g, '')}</b>${e.event_type}, ${shortDate(e.detected_at)}`} />
          y0 -= h
          return r
        })
      })}
      {[-29, -21, -14, -7, 0].map((d) => (
        <text key={d} x={L + (d + n - 1) * bw + bw / 2} y={H - 6} fontSize="11" textAnchor="middle" fill="#5B5E66">{d === 0 ? 'Today' : `${d}d`}</text>
      ))}
    </svg>
  )
}
