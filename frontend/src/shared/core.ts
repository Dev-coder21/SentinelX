// Shared constants and helpers for the SentinelX UI: risk bands, colours, formatting.

declare const gsap: any

export const RM: boolean =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
export const hasG = () => typeof gsap !== 'undefined'
export const anim: boolean = !RM
export const clamp = (v: number, a = 0, b = 100) => Math.max(a, Math.min(b, v))

/** Backend fusion constants (app/nlp/risk_fusion.py). */
export const LAMBDA = Math.log(2) / 14
export const MULT: Record<number, number> = { 1: 1.3, 2: 1.1, 3: 0.9 }
export const rec = (d: number) => Math.max(0.1, Math.min(1, Math.exp(-LAMBDA * Math.max(0, d))))

export const REGIONS = ['East Asia', 'Southeast Asia', 'North America', 'Europe']

/** Event category colours. Backend event_type values map onto these keys. */
export const CAT: Record<string, string> = {
  weather: '#2a78d6',
  logistics: '#1baf7a',
  labor: '#e87ba4',
  supply: '#008300',
  geopolitical: '#8e5bd8',
  other: '#7A7D85',
}
export const CATS = Object.keys(CAT)

/** Normalise a backend event_type (e.g. "supply_shortage", "Weather") to a colour key. */
export function catKey(t: string | null | undefined): string {
  const v = String(t || '').toLowerCase()
  if (v.includes('weather') || v.includes('storm') || v.includes('flood') || v.includes('heat')) return 'weather'
  if (v.includes('logist') || v.includes('port') || v.includes('shipping') || v.includes('transport')) return 'logistics'
  if (v.includes('labor') || v.includes('labour') || v.includes('strike')) return 'labor'
  if (v.includes('supply') || v.includes('shortage') || v.includes('material')) return 'supply'
  if (v.includes('geo') || v.includes('polit') || v.includes('sanction') || v.includes('trade')) return 'geopolitical'
  return 'other'
}
export const catLabel = (t: string | null | undefined) => {
  const v = String(t || 'other').replace(/_/g, ' ')
  return v.charAt(0).toUpperCase() + v.slice(1)
}

export const band = (r: number) => (r >= 70 ? 2 : r >= 40 ? 1 : 0)
export const bandName = (r: number) => ['Low', 'Elevated', 'Critical'][band(r)]
export const rCol = (r: number) => ['#1F3BFF', '#DE9E00', '#D93A12'][band(r)]
export const nCol = (r: number) => ['#7B90FF', '#FFB22E', '#FF6A2B'][band(r)]

export const money = (v: number) =>
  v >= 1e6
    ? '$' + (v / 1e6).toFixed(v >= 1e7 ? 1 : 2).replace(/\.?0+$/, '') + 'M'
    : v >= 1e3
      ? '$' + Math.round(v / 1e3) + 'k'
      : '$' + Math.round(v)

export function ago(iso: string | null | undefined): string {
  if (!iso) return 'never'
  const t = new Date(iso).getTime()
  if (isNaN(t)) return 'unknown'
  const s = (Date.now() - t) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  if (s < 86400) return `${Math.round(s / 3600)} h ago`
  const d = Math.round(s / 86400)
  return `${d} day${d === 1 ? '' : 's'} ago`
}
export const daysSince = (iso: string | null | undefined) => {
  const t = iso ? new Date(iso).getTime() : NaN
  return isNaN(t) ? 0 : Math.max(0, (Date.now() - t) / 86400000)
}
export const shortDate = (iso: string | null | undefined) => {
  const d = iso ? new Date(iso) : null
  return d && !isNaN(d.getTime()) ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''
}
export const dateTime = (iso: string | null | undefined) => {
  const d = iso ? new Date(iso) : null
  return d && !isNaN(d.getTime())
    ? d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : ''
}

/** Human label for a backend signal source. */
export const srcLabel = (s: string | null | undefined) => {
  const v = String(s || '').toLowerCase()
  if (v === 'news' || v.includes('gdelt')) return 'GDELT news'
  if (v === 'weather' || v.includes('meteo')) return 'Open-Meteo weather'
  return s || 'Unknown source'
}
export const daysOld = (d: number) => (d < 1 ? 'today' : `${Math.round(d)} day${Math.round(d) === 1 ? '' : 's'} old`)
