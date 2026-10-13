import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { wipe } from '@/shared/wipe'
import { loadModel, getModelSnapshot } from '@/app/data'
import markup from './markup'
import { mountLanding } from './engine'

/** The marketing / story page. The markup is static and driven imperatively by engine.ts. */
export function LandingPage() {
  const root = useRef<HTMLDivElement>(null)
  const nav = useNavigate()
  useEffect(() => {
    const el = root.current
    if (!el) return
    document.title = 'SentinelX · Supply-chain risk intelligence'
    el.innerHTML = markup
    window.scrollTo(0, 0)
    // Warm the app data while people read the story.
    loadModel()
    const cleanup = mountLanding(el, {
      onOpen: (page: string, supplierName?: string) => {
        wipe(() => {
          if (page === 'supplier' && supplierName) {
            loadModel().then(() => {
              const s = getModelSnapshot()?.suppliers.find((x) => x.name === supplierName)
              nav(s ? `/app/suppliers/${s.id}` : '/app/suppliers')
            })
          } else nav(page && page !== 'overview' ? `/app/${page}` : '/app')
        })
      },
    })
    return () => {
      cleanup()
      el.innerHTML = ''
    }
  }, [nav])
  return <div ref={root} className="landing-root" />
}
