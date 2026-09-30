/**
 * SentinelX Centralized Design System Tokens
 * Defines semantic surface tiers, typography hierarchy, chart themes, and interactive states.
 */

export const SURFACE_TIERS = {
  LEVEL_0: '#080E1C', // Application canvas background (deep obsidian navy)
  LEVEL_1: '#0D1628', // Primary operational panels, feeds, and tables
  LEVEL_2: '#121D34', // Secondary elevated containers, nested rows, filter controls
  LEVEL_3: '#172644', // Selected rows, active navigation items, drawer overlays
} as const

export const BORDER_TOKENS = {
  subtle: '#16233B',
  default: '#1E2E4E',
  elevated: '#283E66',
  focusCyan: 'rgba(61, 214, 196, 0.4)',
} as const

export const CHART_THEME = {
  grid: '#16243D',
  axis: '#64748B',
  axisTick: { fontSize: 11, fill: '#64748B' },
  tooltip: {
    backgroundColor: '#0A1120',
    borderColor: '#1E2E4E',
    borderRadius: '6px',
    fontSize: '12px',
    color: '#F8FAFC',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5)',
  },
  avgRisk: '#3DD6C4',
  highRisk: '#F43F5E',
  optimizer: '#6366F1',
} as const
