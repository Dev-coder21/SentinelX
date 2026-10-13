/** Floating tooltip shared by the app pages. Any element with a data-tip attribute shows it on hover. */
const el = () => document.getElementById('tip')

export function showTip(html: string, x: number, y: number) {
  const tip = el()
  if (!tip) return
  tip.innerHTML = html
  tip.style.opacity = '1'
  const w = tip.offsetWidth, h = tip.offsetHeight
  tip.style.transform = `translate(${Math.min(x + 14, innerWidth - w - 8)}px,${y - h - 12 < 8 ? y + 16 : y - h - 12}px)`
}

export function hideTip() {
  const tip = el()
  if (tip) tip.style.opacity = '0'
}

/** Installs the document-level data-tip handler. Returns an uninstall function. */
export function installTips(): () => void {
  const onMove = (e: PointerEvent) => {
    const target = e.target as Element | null
    const t = target && target.closest ? (target.closest('[data-tip]') as HTMLElement | null) : null
    if (t) showTip(t.dataset.tip || '', e.clientX, e.clientY)
    else if (!target?.closest?.('canvas,.hov')) hideTip()
  }
  document.addEventListener('pointermove', onMove)
  return () => document.removeEventListener('pointermove', onMove)
}
