import React from 'react'
import { Loader2 } from 'lucide-react'

interface LoadingStateProps {
  message?: string
  className?: string
  minHeight?: string
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading operational data...',
  className = '',
  minHeight = 'min-h-[240px]',
}) => {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center p-8 text-slate-400 ${minHeight} ${className}`}
    >
      <Loader2 className="h-8 w-8 animate-spin text-[#3DD6C4] mb-3" />
      <p className="text-sm font-medium tracking-wide text-slate-300">{message}</p>
      <span className="sr-only">Loading</span>
    </div>
  )
}
