import React from 'react'
import { Link } from 'react-router-dom'
import { ShieldAlert, Home } from 'lucide-react'

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center text-center p-8 space-y-4">
      <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-2">
        <ShieldAlert className="w-8 h-8" />
      </div>

      <div className="space-y-1">
        <span className="text-xs font-mono uppercase tracking-wider text-rose-400 font-semibold">
          Error 404 • Resource Not Located
        </span>
        <h1 className="text-2xl font-bold text-white tracking-tight">
          Page Not Found in SentinelX Network
        </h1>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          The requested route does not exist in the SentinelX command center interface.
        </p>
      </div>

      <div className="pt-4 flex items-center space-x-3">
        <Link
          to="/dashboard"
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-md bg-[#121D34] hover:bg-[#172644] text-[#3DD6C4] border border-[#1E2E4E] hover:border-[#3DD6C4]/50 text-sm font-medium transition-colors"
        >
          <Home className="w-4 h-4" />
          <span>Return to Dashboard</span>
        </Link>
      </div>
    </div>
  )
}
