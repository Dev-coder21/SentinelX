import React from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  badge?: React.ReactNode
  actions?: React.ReactNode
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  badge,
  actions,
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-5 border-b border-[#1E2E4E]">
      <div>
        <div className="flex items-center space-x-2.5">
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight font-sans">{title}</h1>
          {badge}
        </div>
        {subtitle && <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl">{subtitle}</p>}
      </div>

      {actions && <div className="flex items-center space-x-2 self-start sm:self-center">{actions}</div>}
    </div>
  )
}
