import { useRef, useState } from 'react'
import { band, money, rCol } from '@/shared/core'
import { useModel, type Sup } from '../data'
import { EmptyState, ScoreChip, useEnter, useGo } from '../ui'

type Key = 'name' | 'region' | 'tier' | 'spend' | 'risk' | 'exposure'

export function SuppliersPage() {
  const { data } = useModel()
  const go = useGo()
  const ref = useRef<HTMLDivElement>(null)
  const [region, setRegion] = useState<string | null>(null)
  const [tier, setTier] = useState<number | null>(null)
  const [bnd, setBnd] = useState<number | null>(null)
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<Key>('risk')
  const [dir, setDir] = useState(-1)
  useEnter(ref, 'suppliers')
  if (!data) return null
  if (!data.suppliers.length) {
    return <div className="pgi" ref={ref}><EmptyState title="No suppliers in the registry">Run <code>python -m app.seed</code> to load the example suppliers.</EmptyState></div>
  }
  const ql = q.trim().toLowerCase()
  const rows = data.suppliers
    .filter((s) => (!region || s.region === region) && (tier == null || s.tier === tier) && (bnd == null || band(s.risk) === bnd) && (!ql || `${s.name} ${s.country} ${s.category} ${s.region}`.toLowerCase().includes(ql)))
    .sort((a, b) => {
      const x = a[sort], y = b[sort]
      return (typeof x === 'string' ? x.localeCompare(y as string) : (x as number) - (y as number)) * dir
    })
  const anyF = region || tier != null || bnd != null || q
  const clear = () => { setRegion(null); setTier(null); setBnd(null); setQ('') }
  const th = (k: Key, l: string, r = false) => (
    <th className={r ? 'r' : ''} aria-sort={sort === k ? (dir < 0 ? 'descending' : 'ascending') : undefined}>
      <button onClick={() => { if (sort === k) setDir(-dir); else { setSort(k); setDir(['name', 'region', 'tier'].includes(k) ? 1 : -1) } }}>{l}{sort === k ? (dir < 0 ? ' ↓' : ' ↑') : ''}</button>
    </th>
  )
  const open = (s: Sup) => go.supplier(s.id)
  return (
    <div className="pgi" ref={ref}>
      <div className="s12 fbar">
        <div className="frow"><span className="lbl">Corridor</span>
          <div className="chips">{[null, ...data.regions].map((r) => <button key={r || 'all'} aria-pressed={region === r} onClick={() => setRegion(r)}>{r || 'All'}</button>)}</div>
        </div>
        <div className="frow"><span className="lbl">Tier</span>
          <div className="chips">{[null, 1, 2, 3].map((t) => <button key={t ?? 'all'} aria-pressed={tier === t} onClick={() => setTier(t)}>{t ? `Tier ${t}` : 'All'}</button>)}</div>
          <span className="lbl" style={{ marginLeft: 12 }}>Risk level</span>
          <div className="chips">{[null, 2, 1, 0].map((b) => (
            <button key={b ?? 'all'} aria-pressed={bnd === b} onClick={() => setBnd(b)}>
              {b == null ? 'All' : <><i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: rCol([10, 50, 80][b]), marginRight: 6 }} />{['Low', 'Elevated', 'Critical'][b]}</>}
            </button>
          ))}</div>
        </div>
        <div className="frow" style={{ justifyContent: 'space-between' }}>
          <label className="search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, country, category or corridor" aria-label="Search suppliers" style={{ width: 300, maxWidth: '100%' }} />
          </label>
          <span className="small">Showing {rows.length} of {data.suppliers.length} suppliers {anyF && <button className="lnk" style={{ marginLeft: 8 }} onClick={clear}>Clear filters</button>}</span>
        </div>
      </div>
      <div className="c flush s12" style={{ overflowX: 'auto' }}>
        <table className="tblx">
          <thead><tr>{th('name', 'Supplier')}{th('region', 'Corridor')}<th>Category</th>{th('tier', 'Tier')}{th('spend', 'Annual spend', true)}{th('risk', 'Risk')}{th('exposure', 'Revenue exposed', true)}<th className="r">Product lines</th><th /></tr></thead>
          <tbody>
            {rows.length ? rows.map((s) => (
              <tr key={s.id} tabIndex={0} onClick={() => open(s)} onKeyDown={(e) => { if (e.key === 'Enter') open(s) }}>
                <td><b style={{ fontWeight: 650 }}>{s.name}</b><br /><span className="small">{s.country}</span></td>
                <td>{s.region}</td>
                <td>{s.category}</td>
                <td><span className="tier">T{s.tier}</span></td>
                <td className="r">{money(s.spend)}</td>
                <td>{s.scored ? <div className="rb"><ScoreChip r={s.risk} /><span className="tr"><i style={{ width: `${s.risk}%`, background: rCol(s.risk) }} /></span></div> : <span className="small">Not scored yet</span>}</td>
                <td className="r">{money(s.exposure)}</td>
                <td className="r">{s.deps.length}</td>
                <td><button className="lnk" onClick={(e) => { e.stopPropagation(); go.network(s.id) }}>In network</button></td>
              </tr>
            )) : (
              <tr><td colSpan={9} style={{ padding: '28px 14px' }}><b>No suppliers match these filters.</b> <button className="lnk" onClick={clear}>Clear filters</button></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
