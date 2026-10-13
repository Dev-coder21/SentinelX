/** Interactive 3D risk field for the Overview page. Peaks are each supplier's current score. */
import { useEffect, useRef } from 'react'
import { makeWorld } from '@/shared/world'
import { tx, tz, ampOf } from '@/shared/landMask'
import { RM, clamp, rCol, bandName } from '@/shared/core'
import { showTip, hideTip } from '@/shared/tip'
import type { Model } from './data'

export function FieldView({ model, onOpen }: { model: Model; onOpen: (id: string) => void }) {
  const box = useRef<HTMLDivElement>(null)
  const labs = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = box.current, labels = labs.current
    if (!host || !labels) return
    // A fresh canvas per mount: a disposed WebGL context cannot be reused.
    const canvas = document.createElement('canvas')
    canvas.setAttribute('aria-label', "3D risk field. Peak height is each supplier's risk score.")
    host.prepend(canvas)
    const S = model.suppliers
    // Draw the corridors' busiest supplier pairs as shipping lanes.
    const lanes: [number, number][] = []
    const topBy = (r: string) => S.filter((s) => s.region === r).sort((a, b) => b.spend - a.spend).map((s) => s.idx)
    const R = model.regions.map(topBy)
    for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) if (R[i][0] != null && R[j][0] != null) lanes.push([R[i][0], R[j][0]])
    const W: any = makeWorld(canvas, { bg: 0xF7F6F1 }, { S, lanes })
    if (!W) { canvas.remove(); return }
    const els = S.map((s) => {
      const d = document.createElement('div')
      d.className = 'lab'
      d.style.opacity = '0'
      d.innerHTML = `<div class="st"></div><div class="bx"><i></i><b class="num"></b><span>${s.name.split(' ').slice(0, 2).join(' ')}</span></div>`
      labels.appendChild(d)
      return d
    })
    const F = { yaw: -0.15, dist: 14, tx: tx(60), tz: tz(30), drag: null as null | { x: number; tx: number; moved: boolean }, hover: -1, scr: [] as number[][] }
    const onDown = (e: PointerEvent) => { F.drag = { x: e.clientX, tx: F.tx, moved: false }; canvas.setPointerCapture(e.pointerId) }
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top
      if (F.drag) { const dx = e.clientX - F.drag.x; if (Math.abs(dx) > 3) F.drag.moved = true; F.tx = F.drag.tx - dx * 0.02; return }
      let b = -1, bd = 24
      F.scr.forEach(([sx, sy], i) => { const d = Math.hypot(sx - x, sy - y); if (d < bd) { bd = d; b = i } })
      F.hover = b
      canvas.style.cursor = b >= 0 ? 'pointer' : 'grab'
      if (b >= 0) showTip(`<b>${S[b].name}</b>Risk <span class="tv">${S[b].risk.toFixed(1)}</span>, ${bandName(S[b].risk).toLowerCase()}`, e.clientX, e.clientY)
      else hideTip()
    }
    const onUp = (e: PointerEvent) => {
      if (F.drag && !F.drag.moved) {
        if (F.hover >= 0) onOpen(S[F.hover].id)
        else { const h = W.pick(e); if (h) W.shock(h.x, h.z, 0.8) }
      }
      F.drag = null
    }
    const onWheel = (e: WheelEvent) => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); F.dist = clamp(F.dist * (e.deltaY < 0 ? 0.92 : 1.08), 7, 26) }
    canvas.style.cursor = 'grab'
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointerleave', hideTip)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    const ro = new ResizeObserver(() => W.resize())
    ro.observe(canvas)
    W.resize()
    let alive = true, vis = true
    const io = new IntersectionObserver((es) => (vis = es[0].isIntersecting))
    io.observe(canvas)
    const t0 = performance.now()
    let shockAt = 1.2
    const frame = (now: number) => {
      if (!alive) return
      requestAnimationFrame(frame)
      if (!vis || document.hidden) return
      const t = (now - t0) / 1000
      S.forEach((s, i) => (W.tgt[i] = ampOf(s.risk)))
      const tilt = 0.85
      W.cam.position.set(F.tx, F.dist * Math.sin(tilt), F.tz + F.dist * Math.cos(tilt))
      W.cam.lookAt(F.tx, 0, F.tz - 0.5)
      W.U.uFogN.value = F.dist * 1.3
      W.U.uFogF.value = F.dist * 2.5
      W.step(RM ? 0 : t, 0.1)
      if (!RM && t > shockAt) {
        const top = [...S].sort((a, b) => b.risk - a.risk)[Math.floor(t / 7) % Math.min(5, S.length)]
        if (top) W.shock(tx(top.lon), tz(top.lat), 0.7)
        shockAt = t + 7
      }
      const w = canvas.clientWidth, h = canvas.clientHeight
      F.scr = S.map((s, i) => W.project(tx(s.lon), W.cur[i] + 0.03, tz(s.lat)))
      const placed: number[][] = []
      ;[...S].sort((a, b) => b.risk - a.risk).forEach((s, rank) => {
        const el = els[s.idx], [x, y, z] = F.scr[s.idx]
        const want = rank < 5 || s.idx === F.hover
        const ok = want && z < 1 && x > 10 && x < w - 200 && y > 50 && y < h && !placed.some((q) => Math.abs(q[0] - x) < 190 && Math.abs(q[1] - y) < 40)
        if (ok) {
          placed.push([x, y])
          el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`
          ;(el.querySelector('b') as HTMLElement).textContent = s.risk.toFixed(0)
          ;(el.querySelector('i') as HTMLElement).style.background = rCol(s.risk)
        }
        el.style.opacity = ok ? '1' : '0'
      })
    }
    requestAnimationFrame(frame)
    return () => {
      alive = false
      ro.disconnect(); io.disconnect()
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointerleave', hideTip)
      canvas.removeEventListener('wheel', onWheel)
      els.forEach((e) => e.remove())
      W.dispose()
      canvas.remove()
    }
  }, [model, onOpen])

  return (
    <div className="fieldbox" ref={box}>
      <div ref={labs} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }} />
      <div className="legend fl"><span><i style={{ background: 'var(--low)' }} />Low</span><span><i style={{ background: 'var(--mid)' }} />Elevated</span><span><i style={{ background: 'var(--high)' }} />Critical</span></div>
    </div>
  )
}
