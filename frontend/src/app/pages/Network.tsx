import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Net } from '@/shared/net'
import { MULT, band, money, rCol } from '@/shared/core'
import { showTip, hideTip } from '@/shared/tip'
import { useModel, prodRisk, type Model } from '../data'
import { BandChip, EmptyState, ScoreChip, useGo } from '../ui'

type Node = { id: number; kind: 's' | 'p'; s?: Model['suppliers'][number]; name?: string; pi?: number }

export function NetworkPage() {
  const { data } = useModel()
  if (!data) return null
  if (!data.suppliers.length || !data.deps.length) {
    return <div className="pgi"><EmptyState title="No dependencies to draw">The network appears once suppliers and their product dependencies are seeded.</EmptyState></div>
  }
  return <Network data={data} />
}

function Network({ data }: { data: Model }) {
  const go = useGo()
  const [params] = useSearchParams()
  const cv = useRef<HTMLCanvasElement>(null)
  const net = useRef<any>(null)
  const S = data.suppliers, NS = S.length
  const [regions, setRegions] = useState(() => new Set(data.regions))
  const [tiers, setTiers] = useState(() => new Set([1, 2, 3]))
  const [bands, setBands] = useState(() => new Set([0, 1, 2]))
  const [focus, setFocus] = useState(-1)
  const [sel, setSel] = useState<Node | null>(null)
  const [q, setQ] = useState('')
  const [ai, setAi] = useState(0)

  useEffect(() => {
    if (!cv.current) return
    const n: any = new Net(cv.current, { pan: true, wheel: true, blast: true, onSelect: (node: Node) => setSel({ ...node }) },
      { S, PRODUCTS: data.products, DEPS: data.deps, REGIONS: data.regions, prodRisk: (p: number) => prodRisk(data, p), showTip, hideTip })
    net.current = n
    const want = params.get('sel')
    const s = want ? S.find((x) => x.id === want || x.name === want) : null
    if (s) {
      const node = n.nodes[s.idx]
      n.sel = node
      setSel({ ...node })
      setTimeout(() => net.current === n && n.center(node), 900)
    }
    return () => { n.destroy(); net.current = null; hideTip() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  useEffect(() => { const n = net.current; if (n) { n.regions = regions; n.tiers = tiers; n.bands = bands; n.focus = focus; n.heat = 0.5 } }, [regions, tiers, bands, focus])

  const toggle = <T,>(set: Set<T>, v: T, on: boolean) => { const c = new Set(set); if (on) c.add(v); else c.delete(v); return c }
  const pickNode = (node: Node) => { const n = net.current; if (!n) return; n.sel = node; n.center(node); setSel({ ...node }); setQ('') }
  const items: Node[] = q.trim() && net.current ? net.current.nodes.filter((n: Node) => (n.kind === 's' ? `${n.s!.name} ${n.s!.country}` : n.name!).toLowerCase().includes(q.trim().toLowerCase())).slice(0, 7) : []
  const dotc = ['#1F3BFF', '#DE9E00', '#D93A12'], bl = ['Low, under 40', 'Elevated, 40 to 69', 'Critical, 70+']

  return (
    <div className="pgi">
      <div className="netpage">
        <div className="rail">
          <div><h4>Find a node</h4>
            <div className="nsearch">
              <label className="search" style={{ minHeight: 38 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
                <input value={q} placeholder="Supplier or product" autoComplete="off" aria-label="Find a node in the network" style={{ width: '100%' }}
                  onChange={(e) => { setQ(e.target.value); setAi(0) }}
                  onKeyDown={(e) => {
                    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && items.length) { e.preventDefault(); setAi((ai + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length) }
                    if (e.key === 'Enter' && items[ai]) pickNode(items[ai])
                    if (e.key === 'Escape') { setQ(''); e.stopPropagation() }
                  }} onBlur={() => setTimeout(() => setQ(''), 150)} />
              </label>
              <div className={'sugg' + (q.trim() ? ' on' : '')} role="listbox">
                {items.length ? items.map((n, i) => (
                  <button key={n.id} role="option" className={i === ai ? 'act' : ''} onMouseDown={(e) => e.preventDefault()} onClick={() => pickNode(n)}>
                    <span>{n.kind === 's' ? n.s!.name : n.name}</span>
                    <span className="small">{n.kind === 's' ? (net.current?.shown(n) ? 'risk ' + n.s!.risk.toFixed(0) : 'hidden by filters') : 'product line'}</span>
                  </button>
                )) : <p className="small" style={{ margin: 0, padding: '10px 12px' }}>No node matches. Try a country such as Japan.</p>}
              </div>
            </div>
          </div>
          <div><h4>Corridors</h4>{data.regions.map((r) => (
            <label key={r} className="ck"><input type="checkbox" checked={regions.has(r)} onChange={(e) => setRegions(toggle(regions, r, e.target.checked))} />{r}<span className="small" style={{ marginLeft: 'auto' }}>{S.filter((s) => s.region === r).length}</span></label>
          ))}</div>
          <div><h4>Risk level</h4>{[2, 1, 0].map((b) => (
            <label key={b} className="ck"><input type="checkbox" checked={bands.has(b)} onChange={(e) => setBands(toggle(bands, b, e.target.checked))} /><i className="dot" style={{ background: dotc[b] }} />{bl[b]}<span className="small" style={{ marginLeft: 'auto' }}>{S.filter((s) => band(s.risk) === b).length}</span></label>
          ))}</div>
          <div><h4>Tier</h4>{[1, 2, 3].map((t) => (
            <label key={t} className="ck"><input type="checkbox" checked={tiers.has(t)} onChange={(e) => setTiers(toggle(tiers, t, e.target.checked))} />Tier {t}<span className="small" style={{ marginLeft: 'auto' }}>×{MULT[t]}</span></label>
          ))}</div>
          <div><h4>Focus a product line</h4>{[-1, ...data.products.map((_, i) => i)].map((p) => (
            <label key={p} className="ck"><input type="radio" name="pf" checked={focus === p} onChange={() => {
              setFocus(p)
              if (p >= 0 && net.current) { const node = net.current.nodes[NS + p]; net.current.sel = node; setSel({ ...node }) }
            }} />{p < 0 ? 'All products' : data.products[p]}</label>
          ))}</div>
          <p className="small" style={{ margin: 0 }}>Node size is annual spend. Line weight is dependency. Select a supplier to highlight its blast radius.</p>
        </div>
        <div className="canvasbox">
          <canvas ref={cv} role="img" aria-label="Supplier dependency network" />
          <div className="nctl">
            <button aria-label="Zoom in" data-tip="Zoom in" onClick={() => net.current?.zoomBy(1.3)}>+</button>
            <button aria-label="Zoom out" data-tip="Zoom out" onClick={() => net.current?.zoomBy(1 / 1.3)}>−</button>
            <button aria-label="Fit the whole graph" data-tip="Fit the whole graph" style={{ fontSize: 12, fontWeight: 700 }} onClick={() => net.current?.fit()}>Fit</button>
            <button aria-label="Centre the selected node" data-tip="Centre the selected node" onClick={() => net.current?.sel && net.current.center(net.current.sel)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /></svg>
            </button>
          </div>
          <div className="nhint small">Drag empty space to pan. Scroll to zoom.</div>
        </div>
        <div className="c" style={{ overflow: 'auto' }}>
          <Detail data={data} sel={sel} onPick={(i) => pickNode(net.current.nodes[i])} go={go} />
        </div>
      </div>
    </div>
  )
}

function Detail({ data, sel, onPick, go }: { data: Model; sel: Node | null; onPick: (i: number) => void; go: ReturnType<typeof useGo> }) {
  const S = data.suppliers
  const h2 = { margin: 0, fontSize: 28, fontVariationSettings: "'wdth' 118", letterSpacing: '-.03em', lineHeight: 1 } as const
  if (!sel) {
    const top = [...S].sort((a, b) => b.deps.length - a.deps.length || b.risk - a.risk).slice(0, 6)
    return (<>
      <div className="ch-h"><h3>Most connected suppliers</h3></div>
      <p className="small" style={{ margin: 0 }}>A failure here reaches the most product lines. Click any node for details.</p>
      <div className="att">{top.map((s) => (
        <button key={s.id} className="ar" onClick={() => onPick(s.idx)}><span className="st" style={{ background: rCol(s.risk) }} /><span style={{ minWidth: 0 }}><span className="t">{s.name}</span><small>{s.deps.length} product lines, {s.country}</small></span><ScoreChip r={s.risk} /></button>
      ))}</div>
    </>)
  }
  if (sel.kind === 'p') {
    const ds = data.deps.filter((d) => d[0] === sel.pi).map((d) => ({ s: S[d[1]], w: d[2] })).sort((a, b) => b.w * b.s.risk - a.w * a.s.risk)
    return (<>
      <span className="small">Product line</span><h2 style={h2}>{sel.name}</h2>
      <div className="kv4"><div><span>Weighted risk</span><b>{prodRisk(data, sel.pi!).toFixed(1)}</b></div><div><span>Suppliers</span><b>{ds.length}</b></div></div>
      <div className="ch-h"><h3>Biggest risk contributors</h3></div>
      <div className="att">{ds.map((d) => (
        <button key={d.s.id} className="ar" onClick={() => go.supplier(d.s.id)}><span className="st" style={{ background: rCol(d.s.risk) }} /><span style={{ minWidth: 0 }}><span className="t">{d.s.name}</span><small>dependency {d.w.toFixed(2)}, contributes {(d.w * d.s.risk).toFixed(0)}</small></span><ScoreChip r={d.s.risk} /></button>
      ))}</div>
    </>)
  }
  const s = sel.s!
  const peers = new Set<number>()
  s.deps.forEach((d) => data.deps.filter((x) => x[0] === d.p).forEach((x) => peers.add(x[1])))
  return (<>
    <span className="small">{s.region}, {s.country}</span><h2 style={h2}>{s.name}</h2>
    <div className="rowx"><BandChip r={s.risk} /><span className="bigv" style={{ fontSize: 64 }}>{s.risk.toFixed(1)}</span></div>
    <div className="kv4">
      <div><span>Blast radius</span><b>{s.deps.length} product line{s.deps.length === 1 ? '' : 's'}</b></div>
      <div><span>Shared with</span><b>{Math.max(0, peers.size - 1)} suppliers</b></div>
      <div><span>Annual spend</span><b>{money(s.spend)}</b></div>
      <div><span>Revenue exposed</span><b>{money(s.exposure)}</b></div>
    </div>
    <div className="ch-h"><h3>Feeds</h3></div>
    {s.deps.map((d) => (
      <div key={d.p} className="pbar" style={{ gridTemplateColumns: 'minmax(0,1fr) 80px 40px' }}><span>{data.products[d.p]}</span><span className="tr"><i style={{ width: `${d.w * 100}%`, background: '#14161C' }} /></span><b>{d.w.toFixed(2)}</b></div>
    ))}
    <div className="acts"><button className="btn" onClick={() => go.supplier(s.id)}>Open supplier</button><button className="btn ghost" onClick={() => go.signals(s.region)}>Signals in {s.region}</button></div>
  </>)
}
