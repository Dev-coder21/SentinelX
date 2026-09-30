import React from 'react'
import type { RiskLevel } from '@/types/api'
import { getRiskLevel } from '@/lib/risk'

interface RiskBadgeProps {
  score?: number | null
  level?: RiskLevel | string | null
  showScore?: boolean
  size?: 'sm' | 'md'
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({
  score,
  level,
  showScore = true,
  size = 'md',
}) => {
  const resolvedLevel: RiskLevel =
    (level?.toUpperCase() as RiskLevel) || getRiskLevel(score)

  let colorClasses = 'bg-slate-800 text-slate-300 border-slate-700'
  let dotColor = 'bg-slate-400'

  switch (resolvedLevel) {
    case 'CRITICAL':
      colorClasses = 'bg-rose-950/60 text-rose-300 border-rose-800/60'
      dotColor = 'bg-rose-500'
      break
    case 'HIGH':
      colorClasses = 'bg-orange-950/60 text-orange-300 border-orange-800/60'
      dotColor = 'bg-orange-500'
      break
    case 'MEDIUM':
      colorClasses = 'bg-amber-950/50 text-amber-300 border-amber-800/50'
      dotColor = 'bg-amber-400'
      break
    case 'LOW':
      colorClasses = 'bg-emerald-950/50 text-emerald-300 border-emerald-800/50'
      dotColor = 'bg-emerald-400'
      break
  }

  const sizeClasses =
    size === 'sm'
      ? 'text-[11px] px-2 py-0.5 space-x-1.5'
      : 'text-xs px-2.5 py-1 space-x-2'

  return (
    <span
      className={`inline-flex items-center font-mono font-medium rounded-md border transition-colors duration-200 ${colorClasses} ${sizeClasses}`}
    >
      {resolvedLevel === 'CRITICAL' ? (
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-60 motion-reduce:hidden" />
          <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${dotColor}`} />
        </span>
      ) : resolvedLevel === 'HIGH' ? (
        <span className="relative flex h-1.5 w-1.5">
          <span className={`inline-flex rounded-full h-1.5 w-1.5 ${dotColor} ring-1 ring-orange-400/40`} />
        </span>
      ) : (
        <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      )}
      <span>{resolvedLevel}</span>
      {showScore && typeof score === 'number' && (
        <span className="opacity-80 font-bold">({score.toFixed(1)})</span>
      )}
    </span>
  )
}
