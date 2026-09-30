import React from 'react'
import { Outlet } from 'react-router-dom'
import { Navbar } from './Navbar'

export const AppShell: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#080E1C] text-slate-100 flex flex-col font-sans">
      {/* Top Bar Navigation */}
      <Navbar />

      {/* Main Page Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>

      {/* Professional Command Center Footer */}
      <footer className="border-t border-[#16233B] bg-[#070B16] py-3 text-[11px] text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 font-mono">
          <div className="flex items-center space-x-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
            <span className="text-slate-400 font-medium">SentinelX Risk Intelligence Platform</span>
            <span className="text-slate-600 hidden md:inline">|</span>
            <span className="text-slate-500 hidden md:inline">Linear Programming Prioritization Engine</span>
          </div>
          <div className="text-slate-500">
            <span>Production Database Live • Deterministic NLP & Weather Fusion</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
