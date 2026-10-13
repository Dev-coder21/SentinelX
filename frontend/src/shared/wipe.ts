/** Stair-step wipe used when moving between the landing page and the app. */
import { RM } from './core'

declare const gsap: any

let busy = false

export function wipe(mid: () => void) {
  const host = document.getElementById('wipe')
  if (RM || typeof gsap === 'undefined' || !host || busy) {
    mid()
    return
  }
  busy = true
  const bars = host.querySelectorAll('i')
  gsap
    .timeline({ onComplete: () => (busy = false) })
    .set(bars, { transformOrigin: 'bottom' })
    .to(bars, { scaleY: 1, duration: 0.4, ease: 'power3.in', stagger: 0.03 })
    .add(() => {
      mid()
      window.scrollTo(0, 0)
    })
    .set(bars, { transformOrigin: 'top' })
    .to(bars, { scaleY: 0, duration: 0.5, ease: 'power3.out', stagger: 0.03, delay: 0.12 })
}
