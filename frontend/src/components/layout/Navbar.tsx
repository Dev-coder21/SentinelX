import React, { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  ShieldCheck,
  LayoutDashboard,
  Network,
  Building2,
  AlertTriangle,
  SlidersHorizontal,
  Menu,
  X,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
} from 'lucide-react'
import { apiClient } from '@/api/client'
import type { HealthStatus } from '@/types/api'

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/network', label: 'Network Graph', icon: Network },
  { path: '/suppliers', label: 'Suppliers', icon: Building2 },
  { path: '/risk-events', label: 'Risk Events', icon: AlertTriangle },
  { path: '/prioritization', label: 'Prioritization', icon: SlidersHorizontal },
]

export const Navbar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [healthLoading, setHealthLoading] = useState(true)
  const [healthError, setHealthError] = useState(false)
  const location = useLocation()

  useEffect(() => {
    let mounted = true
    const checkHealth = async () => {
      setHealthLoading(true)
      try {
        const res = await apiClient.getHealth()
        if (mounted) {
          setHealth(res)
          setHealthError(false)
        }
      } catch {
        if (mounted) {
          setHealthError(true)
        }
      } finally {
        if (mounted) setHealthLoading(false)
      }
    }

    checkHealth()
    const timer = setInterval(checkHealth, 30000)
    return () => {
      mounted = false
      clearInterval(timer)
    }
  }, [])

  return (
    <header className="border-b border-[#1E2E4E] bg-[#0A1120]/95 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo / Brand */}
          <div className="flex items-center space-x-3">
            <NavLink to="/dashboard" className="flex items-center space-x-2.5 group">
              <div className="h-8 w-8 rounded-md bg-[#0F1C33] border border-[#233B62] flex items-center justify-center transition-colors group-hover:border-[#3DD6C4]/60">
                <ShieldCheck className="h-4.5 w-4.5 text-[#3DD6C4] stroke-[2]" />
              </div>
              <div className="flex items-baseline space-x-1.5">
                <span className="text-base font-bold tracking-tight text-white font-sans">
                  SentinelX
                </span>
                <span className="text-[10px] font-mono uppercase bg-[#121F38] text-slate-400 px-1.5 py-0.5 rounded border border-[#1E2E4E]">
                  Ops
                </span>
              </div>
            </NavLink>
          </div>

          {/* Desktop Nav Items */}
          <nav className="hidden md:flex items-center space-x-1" aria-label="Main Navigation">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              const isActive =
                item.path === '/dashboard'
                  ? location.pathname === '/' || location.pathname === '/dashboard'
                  : location.pathname.startsWith(item.path)

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-[#14233D] text-[#3DD6C4] border border-[#233B62] shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-[#101A2F]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </NavLink>
              )
            })}
          </nav>

          {/* Right Status Indicator */}
          <div className="hidden sm:flex items-center space-x-3">
            <div
              className="flex items-center space-x-2 text-[11px] font-mono px-2.5 py-1 rounded bg-[#0D1628] border border-[#1E2E4E]"
              title="Backend connectivity status"
            >
              <span className="text-slate-500">API:</span>
              {healthLoading ? (
                <span className="flex items-center text-amber-400">
                  <RefreshCw className="h-3 w-3 animate-spin mr-1" /> Connecting
                </span>
              ) : healthError ? (
                <span className="flex items-center text-rose-400">
                  <AlertCircle className="h-3 w-3 mr-1" /> Offline
                </span>
              ) : (
                <span className="flex items-center text-emerald-400 font-medium">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Online
                </span>
              )}
            </div>
          </div>

          {/* Mobile Menu Toggle Button */}
          <div className="flex md:hidden items-center">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-[#14233D] focus:outline-none focus:ring-1 focus:ring-[#3DD6C4]"
              aria-label="Toggle mobile menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-[#1E2E4E] bg-[#0D1628] px-4 pt-2 pb-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive =
              item.path === '/dashboard'
                ? location.pathname === '/' || location.pathname === '/dashboard'
                : location.pathname.startsWith(item.path)

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center space-x-3 px-3 py-2 rounded-md text-xs font-medium ${
                  isActive
                    ? 'bg-[#14233D] text-[#3DD6C4] border border-[#233B62]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#101A2F]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
          <div className="pt-2 border-t border-[#1E2E4E] flex items-center justify-between text-xs font-mono text-slate-400 px-3">
            <span>Backend Status:</span>
            {healthLoading ? (
              <span className="text-amber-400">Connecting...</span>
            ) : healthError ? (
              <span className="text-rose-400">Offline</span>
            ) : (
              <span className="text-emerald-400">Online ({health?.status})</span>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
