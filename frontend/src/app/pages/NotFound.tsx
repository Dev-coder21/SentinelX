import { useGo } from '../ui'

export function NotFoundPage() {
  const go = useGo()
  return (
    <div className="pgi">
      <div className="c s12 state" style={{ padding: '64px 48px' }}>
        <div className="bigv" style={{ fontSize: 'clamp(96px,14vw,200px)' }}>404</div>
        <h2>That page doesn't exist</h2>
        <p>The address may be mistyped, or the page has moved.</p>
        <button className="btn" onClick={() => go.page('overview')}>Go to the overview</button>
      </div>
    </div>
  )
}
