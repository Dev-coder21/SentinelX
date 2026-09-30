import React from 'react'
import { Inbox } from 'lucide-react'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  className?: string
  minHeight?: string
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
  minHeight = 'min-h-[220px]',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center bg-[#111A2E]/40 border border-[#1E2C48] rounded-xl ${minHeight} ${className}`}
    >
      <div className="w-12 h-12 rounded-full bg-[#1A253E] flex items-center justify-center mb-3 text-slate-400">
        {icon || <Inbox className="w-6 h-6" />}
      </div>
      <h3 className="text-base font-medium text-slate-200 mb-1">{title}</h3>
      {description && <p className="text-sm text-slate-400 max-w-sm mb-5">{description}</p>}
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center px-4 py-2 rounded-lg bg-[#1E2C48] hover:bg-[#25375A] text-slate-200 border border-[#2B3E63] text-sm font-medium transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
