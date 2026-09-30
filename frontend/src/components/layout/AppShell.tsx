import React from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Navbar } from './Navbar'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'

export const AppShell: React.FC = () => {
  const location = useLocation()
  const reducedMotion = usePrefersReducedMotion()

  return (
    <div className="min-h-screen bg-[#080E1C] text-slate-100 flex flex-col font-sans">
      {/* Top Bar Navigation */}
      <Navbar />

      {/* Main Page Area with subtle route transition */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: reducedMotion ? 0 : 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reducedMotion ? 0 : 0.2,
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          <Outlet />
        </motion.div>
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
