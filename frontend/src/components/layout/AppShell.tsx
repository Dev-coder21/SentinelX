import React from 'react'
import { Outlet } from 'react-router-dom'
import { Navbar } from './Navbar'

export const AppShell: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-100 flex flex-col font-sans selection:bg-[#3DD6C4]/30 selection:text-[#3DD6C4]">
      {/* Top Bar Navigation */}
      <Navbar />

      {/* Main Page Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>

      {/* Professional Command Center Footer */}
      <footer className="border-t border-[#1E2C48] bg-[#0A0F1D] py-4 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 font-mono">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-[#3DD6C4] animate-pulse" />
            <span className="text-slate-300 font-medium">SentinelX Risk Intelligence Platform</span>
            <span className="text-slate-400">| Linear Programming Prioritization</span>
          </div>
          <div className="text-slate-400">
            <span>Model v1.0 • Connected to Live Database</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
