/** Small presentational pieces shared by the app pages. */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { CAT, catKey, catLabel, clamp, rCol, bandName, RM } from '@/shared/core'
import { hideTip, showTip } from '@/shared/tip'

declare const gsap: any

export const ScoreChip = ({ r }: { r: number }) => (
  <span className="score"><i style={{ background: rCol(r) }} />{r.toFixed(1)}</span>
)
export const BandChip = ({ r }: { r: number }) => (
  <span className="band"><i style={{ background: rCol(r) }} />{bandName(r)}</span>
)
export const CatChip = ({ t }: { t: string }) => (
  <span className="cat"><i style={{ background: CAT[catKey(t)] }} />{catLabel(t)}</span>
)

/** Fades and lifts the direct children of the page grid in when it mounts. */
export function useEnter(ref: React.RefObject<HTMLElement | null>, key: unknown) {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || RM || typeof gsap === 'undefined') return
    const t = gsap.from(el.children, { y: 16, opacity: 0, duration: 0.5, stagger: 0.04, ease: 'power3.out', clearProps: 'transform,opacity' })
    return () => t.kill()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
}

export function Spark({ vals, col = '#14161C', w = 100, h = 34, style }: { vals: number[]; col?: string; w?: number; h?: number; style?: React.CSSProperties }) {
  if (vals.length < 2) return <svg viewBox={`0 0 ${w} ${h}`} aria-hidden="true" style={style} />
  const mx = Math.max(...vals), mn = Math.min(...vals)
  const X = (i: number) => (i / (vals.length - 1)) * w
  const Y = (v: number) => h - 3 - ((v - mn) / (mx - mn || 1)) * (h - 8)
  const d = vals.map((v, j) => (j ? 'L' : 'M') + X(j).toFixed(1) + ' ' + Y(v).toFixed(1)).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true" style={style}>
      <path d={`${d} L${w} ${h} L0 ${h}Z`} fill={col} opacity=".1" />
      <path d={d} fill="none" stroke={col} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/** Measures an element's width and re-renders when it changes. */
export function useWidth<T extends HTMLElement | SVGElement>(fallback = 700) {
  const ref = useRef<T | null>(null)
  const [w, setW] = useState(fallback)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setW(Math.max(200, Math.round(el.getBoundingClientRect().width))))
    ro.observe(el)
    setW(Math.max(200, Math.round(el.getBoundingClientRect().width)))
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

export interface Series { name: string; v: number[]; col: string; area?: boolean }
export interface Marker { x: number; col: string; tip: string }

/** Time-series line chart. xs are timestamps (ms); values share one y axis. */
export function LineChart({ xs, series, h = 240, max = 100, threshold, markers = [], fmt, label }: {
  xs: number[]; series: Series[]; h?: number; max?: number; threshold?: number; markers?: Marker[]; fmt?: (v: number) => string; label: string
}) {
  const [ref, W2] = useWidth<SVGSVGElement>()
  const [hi, setHi] = useState<number | null>(null)
  const L = 40, R2 = 12, T = 12, B = h - 26
  const n = xs.length
  if (n < 2) {
    return <p className="empty">Not enough history yet. Scores appear here after a few refreshes.</p>
  }
  const x0 = xs[0], x1 = xs[n - 1]
  const X = (t: number) => L + ((W2 - L - R2) * (t - x0)) / (x1 - x0 || 1)
  const Y = (v: number) => B - ((B - T) * clamp(v, 0, max)) / max
  const ticks = 5
  const tickTs = Array.from({ length: ticks }, (_, i) => x0 + ((x1 - x0) * i) / (ticks - 1))
  const f = fmt || ((v: number) => String(Math.round(v)))
  const onMove = (e: React.PointerEvent) => {
    const r = (e.currentTarget as SVGRectElement).ownerSVGElement!.getBoundingClientRect()
    const t = x0 + ((e.clientX - r.left - L) / (r.width - L - R2)) * (x1 - x0)
    let bi = 0
    xs.forEach((x, i) => { if (Math.abs(x - t) < Math.abs(xs[bi] - t)) bi = i })
    setHi(bi)
    const d = new Date(xs[bi])
    showTip(`<b>${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</b>` +
      series.map((s) => `${s.name}: <span class="tv">${f(s.v[bi])}</span>`).join('<br>'), e.clientX, e.clientY)
  }
  return (
    <svg ref={ref} className="chart" viewBox={`0 0 ${W2} ${h}`} style={{ height: h }} role="img" aria-label={label}>
      {[0, 0.25, 0.5, 0.75, 1].map((q) => (
        <g key={q}>
          <line x1={L} x2={W2 - R2} y1={Y(q * max)} y2={Y(q * max)} stroke="rgba(20,22,28,.08)" />
          <text x={L - 8} y={Y(q * max) + 4} fontSize="11" textAnchor="end" fill="#5B5E66">{f(q * max)}</text>
        </g>
      ))}
      {tickTs.map((t, i) => (
        <text key={i} x={X(t)} y={h - 6} fontSize="11" textAnchor={i === 0 ? 'start' : i === ticks - 1 ? 'end' : 'middle'} fill="#5B5E66">
          {new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
        </text>
      ))}
      {threshold != null && (
        <g>
          <line x1={L} x2={W2 - R2} y1={Y(threshold)} y2={Y(threshold)} stroke="#D93A12" strokeDasharray="4 4" opacity=".7" />
          <text x={L + 6} y={Y(threshold) - 6} fontSize="11" fill="#14161C">Critical, {threshold}</text>
        </g>
      )}
      {series.map((s) => {
        const d = s.v.map((v, j) => (j ? 'L' : 'M') + X(xs[j]).toFixed(1) + ' ' + Y(v).toFixed(1)).join(' ')
        return (
          <g key={s.name}>
            {s.area && <path d={`${d} L${X(x1)} ${B} L${X(x0)} ${B}Z`} fill={s.col} opacity=".08" />}
            <path d={d} fill="none" stroke={s.col} strokeWidth="2" />
            <circle cx={X(x1)} cy={Y(s.v[n - 1])} r="5" fill={s.col} stroke="#F7F6F1" strokeWidth="2" />
          </g>
        )
      })}
      {markers.filter((m) => m.x >= x0 && m.x <= x1).map((m, i) => {
        const x = X(m.x)
        return <rect key={i} x={x - 4} y={B - 4} width="8" height="8" transform={`rotate(45 ${x} ${B})`} fill={m.col} stroke="#F7F6F1" strokeWidth="1.5" data-tip={m.tip} />
      })}
      {hi != null && <line x1={X(xs[hi])} x2={X(xs[hi])} y1={T} y2={B} stroke="#14161C" strokeDasharray="2 3" />}
      <rect className="hov" x={L} y={T} width={Math.max(0, W2 - L - R2)} height={Math.max(0, B - T - 8)} fill="transparent"
        onPointerMove={onMove} onPointerLeave={() => { setHi(null); hideTip() }} />
    </svg>
  )
}

/** Loading skeleton, error and empty states shared by every page. */
export function Loading({ what }: { what: string }) {
  return (
    <div className="pgi" aria-busy="true">
      <p className="small s12" style={{ margin: 0 }}>Loading {what} from the API…</p>
      <div className="sk s12" style={{ height: 130 }} />
      <div className="sk s8" style={{ height: 380 }} />
      <div className="sk s4" style={{ height: 380 }} />
      <div className="sk s6" style={{ height: 220 }} />
      <div className="sk s6" style={{ height: 220 }} />
    </div>
  )
}

export function ErrorState({ what, message, onRetry }: { what: string; message?: string | null; onRetry: () => void }) {
  return (
    <div className="pgi">
      <div className="c s12 state">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#B3260A" strokeWidth="2" aria-hidden="true"><path d="M12 3l10 18H2L12 3z" /><path d="M12 10v5M12 18v.5" /></svg>
        <h2>Couldn't load {what}</h2>
        <p>The SentinelX API didn't respond{message ? <> (<code>{message}</code>)</> : null}. Check that the backend is running with <code>docker compose up</code>, then try again.</p>
        <button className="btn" onClick={onRetry}>Try again</button>
      </div>
    </div>
  )
}

export function EmptyState({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="c s12 state">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#14161C" strokeWidth="1.6" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="1" /><path d="M3 9h18" /></svg>
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </div>
  )
}

/** Navigate helpers used by buttons across pages. */
export function useGo() {
  const nav = useNavigate()
  return {
    supplier: (id: string) => nav(`/app/suppliers/${id}`),
    network: (id?: string) => nav(id ? `/app/network?sel=${encodeURIComponent(id)}` : '/app/network'),
    signals: (region?: string) => nav(region ? `/app/signals?region=${encodeURIComponent(region)}` : '/app/signals'),
    page: (p: string) => nav(p === 'overview' ? '/app' : `/app/${p}`),
  }
}

export function Toast({ msg }: { msg: string | null }) {
  const [shown, setShown] = useState<string | null>(null)
  useEffect(() => {
    if (!msg) return
    setShown(msg)
    const t = setTimeout(() => setShown(null), 2600)
    return () => clearTimeout(t)
  }, [msg])
  return <div className={'toast' + (shown ? ' on' : '')} role="status">{shown}</div>
}
