import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { apiClient } from '@/api/client'
import { ago } from '@/shared/core'
import { installTips, hideTip } from '@/shared/tip'
import { wipe } from '@/shared/wipe'
import { useModel } from './data'
import { ErrorState, Loading } from './ui'

export interface ShellCtx { toast: (m: string) => void }

const NAV = [
  { to: '/app', end: true, label: 'Overview', icon: <><rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" /><rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" /></> },
  { to: '/app/network', label: 'Network', icon: <><circle cx="5" cy="6" r="2.5" /><circle cx="19" cy="6" r="2.5" /><circle cx="12" cy="18" r="2.5" /><path d="M7 7.5l3.5 8.5M17 7.5l-3.5 8.5M7.5 6h9" /></> },
  { to: '/app/suppliers', label: 'Suppliers', count: 'crit', icon: <path d="M3 21V9l6-4v4l6-4v4l6-4v16H3z" /> },
  { to: '/app/signals', label: 'Signals', count: 'sig', icon: <path d="M2 12h4l3-8 4 16 3-8h6" /> },
  { to: '/app/optimizer', label: 'Optimizer', icon: <><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" /><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" /></> },
  { to: '/app/validation', label: 'Validation', icon: <path d="M4 12l5 5L20 6" /> },
] as const

const TITLES: Record<string, string> = { '': 'Overview', network: 'Network', suppliers: 'Suppliers', signals: 'Signals', optimizer: 'Optimizer', validation: 'Validation' }

const Mark = () => (
  <svg viewBox="0 0 26 26" fill="none" aria-hidden="true"><path d="M2 20c3-1 4-6 7-6s3 3 5 3 3-9 5-9 3 7 5 8" stroke="currentColor" strokeWidth="2" /><path d="M2 24h22" stroke="currentColor" strokeWidth="2" /><circle cx="19" cy="7.5" r="2.6" fill="#FF4F00" /></svg>
)

export function AppShell() {
  const model = useModel()
  const { data } = model
  const loc = useLocation()
  const nav = useNavigate()
  const pg = useRef<HTMLDivElement>(null)
  const [health, setHealth] = useState<'ok' | 'down' | 'checking'>('checking')
  const [palOpen, setPalOpen] = useState(false)
  const [toastMsg, setToastMsg] = useState<{ t: string; k: number } | null>(null)
  const toast = useCallback((t: string) => setToastMsg({ t, k: Date.now() }), [])

  useEffect(() => installTips(), [])
  useEffect(() => {
    document.body.classList.add('locked')
    return () => document.body.classList.remove('locked')
  }, [])
  useEffect(() => {
    let alive = true
    const check = () => apiClient.getHealth().then(() => alive && setHealth('ok')).catch(() => alive && setHealth('down'))
    check()
    const id = setInterval(check, 30000)
    return () => { alive = false; clearInterval(id) }
  }, [])
  useEffect(() => {
    if (pg.current) pg.current.scrollTop = 0
    hideTip()
  }, [loc.pathname])
  useEffect(() => {
    if (!toastMsg) return
    const id = setTimeout(() => setToastMsg(null), 2600)
    return () => clearTimeout(id)
  }, [toastMsg])

  const parts = loc.pathname.replace(/^\/app\/?/, '').split('/')
  const section = parts[0] || ''
  const supId = section === 'suppliers' && parts[1] ? decodeURIComponent(parts[1]) : null
  const sup = supId && data ? data.byId.get(supId) : null
  const title = TITLES[section] ?? 'Page not found'
  useEffect(() => {
    document.title = `${sup ? sup.name : title} · SentinelX`
  }, [sup, title])

  const backToSite = useCallback(() => wipe(() => nav('/')), [nav])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalOpen(true); return }
      if (e.key === 'Escape') {
        if (palOpen) setPalOpen(false)
        else if (supId) nav('/app/suppliers')
        return
      }
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === '/') { e.preventDefault(); setPalOpen(true) }
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [palOpen, supId, nav])

  const counts = {
    crit: data ? data.suppliers.filter((s) => s.risk >= 70).length : null,
    sig: data?.summary ? data.summary.recent_event_count : null,
  }
  const updated = data?.summary?.latest_risk_timestamp ?? null

  let body
  if (model.error && !data) body = <ErrorState what={title.toLowerCase()} message={model.error} onRetry={model.reload} />
  else if (!data) body = <Loading what={supId ? 'this supplier' : title.toLowerCase()} />
  else body = <Outlet context={{ toast } satisfies ShellCtx} />

  return (
    <div id="app" className="open" role="application" aria-label="SentinelX app">
      <aside className="sb">
        <span className="mark"><Mark />SentinelX</span>
        <nav aria-label="App sections">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={'end' in n}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">{n.icon}</svg>
              {n.label}
              {'count' in n && counts[n.count] != null && (
                <span className={'ct' + (n.count === 'crit' ? ' hot' : '')}>{counts[n.count]}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="sep" />
        <div className="foot">
          <button onClick={backToSite}>Back to the site</button>
        </div>
      </aside>
      <div className="main">
        <div className="tb">
          <button className="tbb mclose" onClick={backToSite} aria-label="Back to the site">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
          <div className="crumb">
            {supId ? (<><button onClick={() => nav('/app/suppliers')}>Suppliers</button><span className="small">/</span><h1>{sup ? sup.name : 'Supplier'}</h1></>) : <h1>{title}</h1>}
          </div>
          <div className="time">
            <button className="pl" onClick={() => { model.reload(); toast('Refreshing data from the API') }} aria-label="Reload data from the API" data-tip="Reload data from the API">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" /></svg>
            </button>
            <div className="lbl"><b>Scores updated</b><span>{model.loading ? 'loading…' : ago(updated)}</span></div>
          </div>
          <span className="status" tabIndex={0}
            data-tip={health === 'ok' ? '<b>Backend connected</b>/health is responding. Scores refresh on the backend schedule.' : health === 'down' ? '<b>Backend not reachable</b>/health did not respond. Start the API with docker compose up.' : '<b>Checking the backend</b>'}>
            <i style={health === 'ok' ? { background: '#1baf7a', boxShadow: '0 0 0 3px rgba(27,175,122,.2)' } : health === 'down' ? { background: '#D93A12', boxShadow: '0 0 0 3px rgba(217,58,18,.2)' } : undefined} />
            <span className="lb">{health === 'ok' ? 'Live' : health === 'down' ? 'Offline' : 'Checking'}</span>
          </span>
          <button className="tbb" onClick={() => setPalOpen(true)} aria-label="Search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            <span className="lb">Search</span><kbd>⌘K</kbd>
          </button>
        </div>
        <div className="pg" ref={pg}>{body}</div>
      </div>
      <div id="tip" role="tooltip" />
      {palOpen && <Palette onClose={() => setPalOpen(false)} />}
      <div className={'toast' + (toastMsg ? ' on' : '')} role="status">{toastMsg?.t}</div>
    </div>
  )
}

function Palette({ onClose }: { onClose: () => void }) {
  const { data } = useModel()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)
  const items = useMemo(() => {
    const s = q.trim().toLowerCase()
    const pages = Object.entries(TITLES).filter(([, l]) => !s || l.toLowerCase().includes(s))
      .map(([k, l]) => ({ l, k: 'Page', go: () => nav(k ? `/app/${k}` : '/app') }))
    const sups = (data?.suppliers || []).filter((x) => !s || `${x.name} ${x.country} ${x.category}`.toLowerCase().includes(s))
      .sort((a, b) => b.risk - a.risk)
      .map((x) => ({ l: x.name, k: `${x.country}, risk ${x.risk.toFixed(0)}`, go: () => nav(`/app/suppliers/${x.id}`) }))
    return [...pages, ...sups].slice(0, 12)
  }, [q, data, nav])
  const pick = (i: number) => { items[i]?.go(); onClose() }
  return (
    <div id="pal" className="on" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="box">
        <input autoFocus placeholder="Find a supplier, or jump to a page" aria-label="Search" autoComplete="off" value={q}
          onChange={(e) => { setQ(e.target.value); setIdx(0) }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (items.length) setIdx((idx + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length) }
            if (e.key === 'Enter') pick(idx)
            if (e.key === 'Escape') { e.stopPropagation(); onClose() }
          }} />
        <ul role="listbox">
          {items.length ? items.map((it, i) => (
            <li key={it.l + i} role="option" aria-selected={i === idx} className={i === idx ? 'act' : ''} onClick={() => pick(i)}><span>{it.l}</span><small>{it.k}</small></li>
          )) : <li><span>Nothing matches. Try a country such as Taiwan.</span></li>}
        </ul>
      </div>
    </div>
  )
}
