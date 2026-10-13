import { useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { apiClient, ApiError } from '@/api/client'
import type { PrioritizeResponse } from '@/types/api'
import { clamp, money, dateTime } from '@/shared/core'
import { showTip, hideTip } from '@/shared/tip'
import { useModel, type Model } from '../data'
import { EmptyState, ScoreChip, useEnter, useGo, useWidth } from '../ui'
import type { ShellCtx } from '../AppShell'

const MAXB = 3_000_000

function validBudget(raw: string): { err?: string; v?: number } {
  const v = String(raw).trim().replace(/[$,\s]/g, '')
  if (!v) return { err: 'Enter a budget amount.' }
  const n = Number(v)
  if (!isFinite(n)) return { err: 'Enter a number, for example 500000.' }
  if (n <= 0) return { err: 'Budget must be more than zero.' }
  if (n > 1e9) return { err: "Budget can't be more than $1,000,000,000." }
  return { v: n }
}

/** Best protection achievable at each budget, using the same costs and effectiveness as the backend solver. */
function frontier(m: Model) {
  const items = m.suppliers.filter((s) => s.protected > 0).map((s) => ({ c: Math.max(1, Math.round(s.cost / 5000)), v: s.protected }))
  const cap = Math.round(MAXB / 5000)
  const dp = new Float64Array(cap + 1)
  items.forEach((x) => { for (let b = cap; b >= x.c; b--) dp[b] = Math.max(dp[b], dp[b - x.c] + x.v) })
  for (let b = 1; b <= cap; b++) dp[b] = Math.max(dp[b], dp[b - 1])
  return Array.from({ length: 61 }, (_, i) => ({ b: (MAXB * i) / 60, v: dp[Math.round((cap * i) / 60)] }))
}

export function OptimizerPage() {
  const { data } = useModel()
  const { toast } = useOutletContext<ShellCtx>()
  const go = useGo()
  const ref = useRef<HTMLDivElement>(null)
  const [plan, setPlan] = useState<PrioritizeResponse | null>(null)
  const [planState, setPlanState] = useState<'loading' | 'none' | 'ok' | 'error'>('loading')
  const [draft, setDraft] = useState(500000)
  const [text, setText] = useState('500000')
  const [err, setErr] = useState('')
  const [solving, setSolving] = useState(false)
  useEnter(ref, 'optimizer')

  useEffect(() => {
    apiClient.getLatestMitigationPlan()
      .then((p) => { setPlan(p); setPlanState('ok'); setDraft(p.budget); setText(String(Math.round(p.budget))) })
      .catch((e: ApiError) => setPlanState(e.status === 404 ? 'none' : 'error'))
  }, [])

  const F = useMemo(() => (data ? frontier(data) : []), [data])
  if (!data) return null

  const setB = (v: number) => { setDraft(v); setText(String(Math.round(v))); setErr('') }
  const run = async () => {
    const r = validBudget(text)
    if (r.err) { setErr(r.err); return }
    setSolving(true)
    try {
      const p = await apiClient.prioritize({ budget: r.v! })
      setPlan(p); setPlanState('ok'); setDraft(p.budget)
      toast(`Plan saved: ${p.selected_count} suppliers funded for ${money(p.budget)}`)
    } catch (e) {
      const m = (e as ApiError).detail || (e as Error).message
      setErr(m)
      toast("The solver didn't return a plan")
    } finally { setSolving(false) }
  }
  const diff = plan && Math.abs(plan.budget - draft) > 1
  const funded = plan ? [...plan.selected_suppliers].sort((a, b) => b.efficiency_ratio - a.efficiency_ratio) : []
  const n = data.suppliers.length

  return (
    <div className="pgi" ref={ref}>
      <div className="c s5">
        <div className="ch-h"><h3>Mitigation budget</h3><span className="small">0-1 knapsack, solved by PuLP and CBC</span></div>
        <div className="bigv">{money(draft)}</div>
        <input type="range" min={0} max={MAXB} step={10000} value={Math.min(MAXB, draft)} aria-label="Mitigation budget in US dollars"
          style={{ ['--p' as string]: `${(Math.min(MAXB, draft) / MAXB) * 100}%` }} onChange={(e) => setB(+e.target.value)} />
        <div className="presets">{[100000, 250000, 500000, 1000000].map((v) => <button key={v} onClick={() => setB(v)}>{money(v)}</button>)}</div>
        <div>
          <label htmlFor="bexact" className="small">Exact budget in US dollars</label>
          <div className="brow" style={{ marginTop: 6 }}>
            <input id="bexact" inputMode="decimal" value={text} aria-describedby="berr" aria-invalid={err ? true : undefined}
              onChange={(e) => { setText(e.target.value); const r = validBudget(e.target.value); setErr(r.err || ''); if (r.v != null) setDraft(r.v) }}
              onKeyDown={(e) => { if (e.key === 'Enter' && !err && !solving) run() }} />
            <button className="btn" onClick={run} disabled={solving || !!err}>{solving ? 'Solving…' : 'Run solver'}</button>
          </div>
          <p className="err" id="berr" role="alert">{err}</p>
        </div>
        <p className="small" style={{ margin: 0 }}>
          {solving ? `Solving a 0-1 knapsack over ${n} suppliers with CBC.` : plan ? (diff ? 'This budget differs from your latest plan. Run the solver to replace it.' : 'Matches your latest plan.') : 'Set a budget, then run the solver to create a plan.'}
        </p>
      </div>
      <div className="c s7">
        <div className="ch-h"><h3>What each extra dollar buys</h3><span className="small">Best possible protection at every budget. Click to set the budget.</span></div>
        <Frontier F={F} draft={draft} plan={plan} onPick={setB} />
      </div>
      {planState === 'loading' ? <div className="sk s12" style={{ height: 220 }} /> : plan ? (
        <div className="c s12" style={{ overflowX: 'auto' }}>
          <div className="ch-h"><h3>Latest plan</h3><span className="small">Saved {dateTime(plan.generated_at)}, budget {money(plan.budget)}, status {plan.optimization_status}</span></div>
          <div className="kv4" style={{ gridTemplateColumns: 'repeat(4,minmax(0,1fr))' }}>
            <div><span>Revenue protected</span><b>{money(plan.total_expected_protected_revenue)}</b></div>
            <div><span>Suppliers funded</span><b>{plan.selected_count} of {n}</b></div>
            <div><span>Spent</span><b>{money(plan.total_budget_used)}</b></div>
            <div><span>Return on spend</span><b>{plan.total_budget_used ? (plan.total_expected_protected_revenue / plan.total_budget_used).toFixed(1) : '0'}×</b></div>
          </div>
          <table className="tblx" style={{ minWidth: 820 }}>
            <thead><tr><th>Supplier</th><th>Risk</th><th className="r">Cost</th><th className="r">Protects</th><th>Return on spend</th><th>Why</th><th /></tr></thead>
            <tbody>
              {funded.length ? funded.map((x) => (
                <tr key={x.supplier_id} onClick={() => go.supplier(x.supplier_id)} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') go.supplier(x.supplier_id) }}>
                  <td><b style={{ fontWeight: 650 }}>{x.supplier_name}</b><br /><span className="small">Tier {x.criticality_tier}</span></td>
                  <td><ScoreChip r={x.current_risk_score} /></td>
                  <td className="r">{money(x.mitigation_cost)}</td>
                  <td className="r">{money(x.expected_protected_revenue)}</td>
                  <td><div className="rb"><b className="num" style={{ minWidth: 48 }}>{x.efficiency_ratio.toFixed(1)}×</b><span className="tr" style={{ width: 160 }}><i style={{ width: `${Math.min(100, (x.efficiency_ratio / 30) * 100)}%`, background: '#14161C' }} /></span></div></td>
                  <td className="small" style={{ whiteSpace: 'normal', minWidth: 240 }}>{x.reason}</td>
                  <td><button className="lnk" onClick={(e) => { e.stopPropagation(); go.network(x.supplier_id) }}>Locate in network</button></td>
                </tr>
              )) : <tr><td colSpan={7} style={{ padding: '20px 14px' }}><b>Nothing was funded.</b> The budget is below the cheapest mitigation. Raise it and run the solver again.</td></tr>}
            </tbody>
          </table>
        </div>
      ) : planState === 'error' ? (
        <EmptyState title="Couldn't load the latest plan" action={<button className="btn" onClick={run}>Run the solver now</button>}>The <code>/mitigation-plans/latest</code> endpoint didn't respond. You can still run the solver.</EmptyState>
      ) : (
        <div className="c s12 state" style={{ padding: 40 }}><h2 style={{ fontSize: 26 }}>No plan yet</h2><p>Set a budget and run the solver. The result is saved by the backend as your latest plan at <code>/mitigation-plans/latest</code>.</p></div>
      )}
    </div>
  )
}

function Frontier({ F, draft, plan, onPick }: { F: { b: number; v: number }[]; draft: number; plan: PrioritizeResponse | null; onPick: (b: number) => void }) {
  const [ref, Wf] = useWidth<SVGSVGElement>()
  const [hi, setHi] = useState<number | null>(null)
  const H = 260, L = 56, R2 = 14, T = 14, B = H - 28
  const mxv = Math.max(1, F[F.length - 1]?.v || 1) * 1.05
  const X = (b: number) => L + ((Wf - L - R2) * Math.min(b, MAXB)) / MAXB
  const Y = (v: number) => B - ((B - T) * v) / mxv
  const d = F.map((p, i) => (i ? 'L' : 'M') + X(p.b).toFixed(1) + ' ' + Y(p.v).toFixed(1)).join(' ')
  const idx = (e: React.PointerEvent | React.MouseEvent) => {
    const r = (e.currentTarget as SVGRectElement).ownerSVGElement!.getBoundingClientRect()
    return clamp(Math.round(((e.clientX - r.left - L) / (r.width - L - R2)) * 60), 0, 60)
  }
  return (
    <svg ref={ref} className="chart" viewBox={`0 0 ${Wf} ${H}`} style={{ height: H }} role="img" aria-label="Protected revenue by budget">
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <g key={f}><line x1={L} x2={Wf - R2} y1={Y(f * mxv)} y2={Y(f * mxv)} stroke="rgba(20,22,28,.08)" /><text x={L - 8} y={Y(f * mxv) + 4} fontSize="11" textAnchor="end" fill="#5B5E66">{money(f * mxv)}</text></g>
      ))}
      {[0, 0.5, 1, 1.5, 2, 2.5, 3].map((m) => <text key={m} x={X(m * 1e6)} y={H - 8} fontSize="11" textAnchor="middle" fill="#5B5E66">{money(m * 1e6)}</text>)}
      <path d={`${d} L${X(MAXB)} ${B} L${X(0)} ${B}Z`} fill="#14161C" opacity=".06" />
      <path d={d} fill="none" stroke="#14161C" strokeWidth="2" />
      <line x1={X(draft)} x2={X(draft)} y1={T} y2={B} stroke="#FF4F00" strokeWidth="2" />
      <text x={Math.min(X(draft) + 6, Wf - 90)} y={T + 12} fontSize="11" fontWeight="700" fill="#14161C">Draft {money(draft)}</text>
      {plan && (<g>
        <circle cx={X(plan.budget)} cy={Y(plan.total_expected_protected_revenue)} r="6" fill="#14161C" stroke="#F7F6F1" strokeWidth="2" />
        <text x={Math.min(X(plan.budget) + 10, Wf - 160)} y={Y(plan.total_expected_protected_revenue) + 18} fontSize="12" fontWeight="700" fill="#14161C">Plan: {money(plan.total_expected_protected_revenue)}</text>
      </g>)}
      {hi != null && <line x1={X(F[hi].b)} x2={X(F[hi].b)} y1={T} y2={B} stroke="#14161C" strokeDasharray="2 3" />}
      <rect className="hov" x={L} y={T} width={Math.max(0, Wf - L - R2)} height={B - T} fill="transparent" style={{ cursor: 'pointer' }}
        onPointerMove={(e) => { const i = idx(e); setHi(i); showTip(`<b>Budget ${money(F[i].b)}</b>Protects <span class="tv">${money(F[i].v)}</span><br>Click to use this budget`, e.clientX, e.clientY) }}
        onPointerLeave={() => { setHi(null); hideTip() }} onClick={(e) => onPick(F[idx(e)].b)} />
    </svg>
  )
}
