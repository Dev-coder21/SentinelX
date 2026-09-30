import React from 'react'

interface StatCardProps {
  label: string
  value: React.ReactNode
  subtext?: string
  icon?: React.ReactNode
  badge?: React.ReactNode
  variant?: 'default' | 'critical' | 'warning' | 'success' | 'info'
  className?: string
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subtext,
  icon,
  badge,
  variant = 'default',
  className = '',
}) => {
  let borderClass = 'border-[#1E2E4E]'
  let textClass = 'text-white'

  if (variant === 'critical') {
    borderClass = 'border-rose-900/50'
    textClass = 'text-rose-400'
  } else if (variant === 'warning') {
    borderClass = 'border-amber-900/50'
    textClass = 'text-amber-400'
  } else if (variant === 'success') {
    borderClass = 'border-emerald-900/50'
    textClass = 'text-emerald-400'
  } else if (variant === 'info') {
    borderClass = 'border-[#233B62]'
    textClass = 'text-[#3DD6C4]'
  }

  return (
    <div
      className={`bg-[#0D1628] border ${borderClass} rounded-lg p-4 relative overflow-hidden transition-colors ${className}`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
          {label}
        </span>
        {icon && <div className="text-slate-400">{icon}</div>}
      </div>

      <div className="flex items-baseline space-x-2">
        <span className={`text-2xl font-bold font-mono tracking-tight ${textClass}`}>
          {value}
        </span>
        {badge}
      </div>

      {subtext && <p className="text-[11px] text-slate-400 mt-1.5 line-clamp-1">{subtext}</p>}
    </div>
  )
}
