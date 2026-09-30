import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  SlidersHorizontal,
  DollarSign,
  TrendingUp,
  ShieldCheck,
  Play,
  Loader2,
  AlertCircle,
  Network,
  ExternalLink,
  Info,
  Clock,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react'
import { apiClient, ApiError } from '@/api/client'
import { useApi } from '@/hooks/useApi'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { LoadingState } from '@/components/common/LoadingState'
import { EmptyState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/common/PageHeader'
import { RiskBadge } from '@/components/common/RiskBadge'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import type { PrioritizeResponse } from '@/types/api'

// Animated currency counter settling strictly on the exact API value
const AnimatedCurrency: React.FC<{
  value: number
  duration?: number
  reducedMotion?: boolean
}> = ({ value, duration = 0.28, reducedMotion = false }) => {
  const [displayValue, setDisplayValue] = useState<number>(0)

  useEffect(() => {
    if (reducedMotion) return

    let startTime: number | null = null
    const startVal = 0
    let frameId: number

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const elapsed = (timestamp - startTime) / (duration * 1000)
      const progress = Math.min(elapsed, 1)
      // Ease out cubic
      const ease = 1 - Math.pow(1 - progress, 3)
      const current = Math.round(startVal + (value - startVal) * ease)
      setDisplayValue(current)

      if (progress < 1) {
        frameId = requestAnimationFrame(step)
      } else {
        setDisplayValue(value)
      }
    }

    frameId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frameId)
  }, [value, duration, reducedMotion])

  if (reducedMotion) {
    return <span>${value.toLocaleString()}</span>
  }

  return <span>${displayValue.toLocaleString()}</span>
}

export const PrioritizationPage: React.FC = () => {
  useDocumentTitle('Mitigation Prioritization')
  const reducedMotion = usePrefersReducedMotion()

  const fetchLatestPlan = useCallback(() => apiClient.getLatestMitigationPlan(), [])
  const { data: initialPlan, loading: initialLoading } = useApi(fetchLatestPlan, [])

  const [newRunPlan, setNewRunPlan] = useState<PrioritizeResponse | null>(null)
  const activePlan = newRunPlan || initialPlan
  const planOrigin = newRunPlan ? 'new_run' : initialPlan ? 'persisted' : null

  // Form inputs
  const [budgetInput, setBudgetInput] = useState<string>('500000')
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Quick preset options
  const budgetPresets = [
    { label: '$100K', value: 100000 },
    { label: '$250K', value: 250000 },
    { label: '$500K', value: 500000 },
    { label: '$1.0M', value: 1000000 },
  ]

  const handleBudgetChange = (value: string) => {
    setBudgetInput(value)
    if (submitError) setSubmitError(null)
  }

  const handleSelectPreset = (value: number) => {
    setBudgetInput(String(value))
    if (submitError) setSubmitError(null)
  }

  const handleRunOptimization = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setSubmitError(null)

    const raw = budgetInput.trim().replace(/[$,]/g, '')
    if (!raw) {
      setSubmitError('Please enter a capital budget constraint amount.')
      return
    }

    const budgetNum = Number(raw)

    if (isNaN(budgetNum) || !isFinite(budgetNum)) {
      setSubmitError('Please enter a valid numeric budget constraint (e.g. $500,000).')
      return
    }

    if (budgetNum < 0) {
      setSubmitError('Budget constraint cannot be negative. Please enter a non-negative amount (≥ $0).')
      return
    }

    if (budgetNum > 1000000000) {
      setSubmitError('Budget constraint exceeds maximum operational ceiling ($1,000,000,000).')
      return
    }

    setSubmitting(true)
    try {
      const response = await apiClient.prioritize({
        budget: budgetNum,
        strategy: 'max_revenue',
      })
      setNewRunPlan(response)
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setSubmitError(err.detail || err.message)
      } else if (err instanceof Error) {
        setSubmitError(err.message)
      } else {
        setSubmitError('Linear programming optimizer failed to execute.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  // Derived budget utilization metrics
  const utilization = useMemo(() => {
    if (!activePlan || activePlan.budget <= 0) return { pct: 0, used: 0, remaining: 0, total: 0 }
    const total = activePlan.budget
    const used = activePlan.total_budget_used
    const remaining = Math.max(0, activePlan.remaining_budget)
    const pct = Math.min(100, Math.max(0, (used / total) * 100))
    return { pct, used, remaining, total }
  }, [activePlan])

  if (initialLoading && !activePlan) {
    return <LoadingState message="Retrieving latest persisted mitigation plan..." />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mitigation Prioritization Engine"
        subtitle="Constrained Linear Programming (PuLP Knapsack) allocating capital to maximize expected protected revenue under budget limits."
      />

      {/* 1. Mitigation Budget Input & Solver Controls */}
      <div className="bg-[#0D1628] border border-[#1E2E4E] rounded-lg p-5">
        <form onSubmit={handleRunOptimization} className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <SlidersHorizontal className="w-4 h-4 text-[#3DD6C4]" />
              <h3 className="text-sm font-semibold text-white">Solver Parameters &amp; Capital Constraint</h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              Formulation: 0-1 Binary Knapsack LP (PuLP CBC)
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-end">
            {/* Input field */}
            <div className="space-y-1 lg:col-span-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="mitigation-budget-input"
                  className="text-xs font-mono text-slate-300 block font-medium"
                >
                  Capital Recovery Budget (USD)
                </label>
                <div className="flex items-center space-x-1.5">
                  <span className="text-[10px] font-mono text-slate-400">Presets:</span>
                  {budgetPresets.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      disabled={submitting}
                      onClick={() => handleSelectPreset(preset.value)}
                      className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#080E1C] hover:bg-[#121D34] text-slate-300 hover:text-[#3DD6C4] border border-[#1E2E4E] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative">
                <DollarSign className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="mitigation-budget-input"
                  type="text"
                  inputMode="numeric"
                  disabled={submitting}
                  value={budgetInput}
                  onChange={(e) => handleBudgetChange(e.target.value)}
                  placeholder="500000"
                  className="w-full pl-9 pr-4 py-2.5 bg-[#080E1C] border border-[#1E2E4E] rounded-md text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#3DD6C4] focus:border-[#3DD6C4] disabled:opacity-50"
                />
              </div>
            </div>

            {/* Run Button */}
            <div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-md bg-[#121D34] hover:bg-[#172644] text-[#3DD6C4] border border-[#233B62] hover:border-[#3DD6C4]/60 text-sm font-mono font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Executing PuLP Solver...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    <span>Run Optimization</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Validation / API Error Alert */}
          {submitError && (
            <div
              role="alert"
              className="p-3 rounded-md bg-rose-950/60 border border-rose-800/60 text-rose-300 text-xs flex items-center space-x-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}
        </form>
      </div>

      {/* 2. Results Container */}
      {!activePlan ? (
        <EmptyState
          icon={<SlidersHorizontal className="w-6 h-6 text-[#3DD6C4]" />}
          title="No Optimization Plan Yet"
          description="Enter an available recovery budget above and execute the mathematical optimizer to derive the highest-value supplier mitigation portfolio."
        />
      ) : (
        <div className="space-y-6">
          {/* Plan Origin Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-2.5 rounded-md bg-[#080E1C] border border-[#1E2E4E] text-xs font-mono">
            <div className="flex items-center space-x-2">
              {planOrigin === 'new_run' ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                  <span className="font-bold text-[#10B981] uppercase tracking-wide">
                    New Optimization Result
                  </span>
                  <span className="text-slate-400">• Status: {activePlan.optimization_status}</span>
                </>
              ) : (
                <>
                  <Clock className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="font-bold text-indigo-300 uppercase tracking-wide">
                    Latest Persisted Decision Plan
                  </span>
                  <span className="text-slate-400">
                    • Persisted at: {new Date(activePlan.generated_at).toLocaleString()}
                  </span>
                </>
              )}
            </div>

            {activePlan.plan_id && (
              <span className="text-[11px] text-slate-400">
                Plan ID: <code>{activePlan.plan_id.slice(0, 8)}...</code>
              </span>
            )}
          </div>

          {/* Value Protected Hero & Key Decision KPIs */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Primary Hero: Expected Protected Revenue */}
            <div className="lg:col-span-2 bg-[#0D1628] border border-[#1E2E4E] rounded-lg p-6 relative overflow-hidden flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  Expected Protected Business Value
                </span>
                <span className="text-xs font-mono font-bold bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 px-2 py-0.5 rounded">
                  Maximized Objective
                </span>
              </div>

              <div className="my-2">
                <div className="text-3xl sm:text-4xl lg:text-5xl font-bold font-mono tracking-tight text-emerald-400">
                  <AnimatedCurrency
                    value={activePlan.total_expected_protected_revenue}
                    reducedMotion={reducedMotion}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Total revenue shielded from supply disruption across{' '}
                  <strong className="text-slate-200">{activePlan.selected_count}</strong> prioritized
                  supplier actions under the ${activePlan.budget.toLocaleString()} capital cap.
                </p>
              </div>

              <div className="pt-3 border-t border-[#1E2E4E] flex items-center justify-between text-xs font-mono text-slate-400">
                <span>PuLP Objective Value:</span>
                <span className="font-semibold text-slate-200">
                  ${activePlan.objective_value.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Decision Portfolio Counts */}
            <div className="bg-[#0D1628] border border-[#1E2E4E] rounded-lg p-6 flex flex-col justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-2">
                <ShieldCheck className="w-4 h-4 text-[#3DD6C4]" />
                Portfolio Summary
              </span>

              <div className="space-y-3 my-1">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-slate-400">Prioritized Actions:</span>
                  <span className="text-2xl font-bold font-mono text-white">
                    {activePlan.selected_count} Nodes
                  </span>
                </div>
                <div className="flex items-baseline justify-between text-xs font-mono">
                  <span className="text-slate-400">Requested Budget:</span>
                  <span className="text-slate-300">${activePlan.budget.toLocaleString()}</span>
                </div>
                <div className="flex items-baseline justify-between text-xs font-mono">
                  <span className="text-slate-400">Capital Allocated:</span>
                  <span className="text-[#3DD6C4] font-semibold">
                    ${activePlan.total_budget_used.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-baseline justify-between text-xs font-mono">
                  <span className="text-slate-400">Budget Cushion:</span>
                  <span className="text-slate-300">
                    ${activePlan.remaining_budget.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="pt-2 text-[11px] text-slate-400 border-t border-[#1E2E4E]">
                Exact binary knapsack allocation guaranteeing 0 budget overshoot.
              </div>
            </div>
          </div>

          {/* 3. Animated Budget Utilization Bar */}
          <div className="bg-[#0D1628] border border-[#1E2E4E] rounded-lg p-5 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-[#3DD6C4]" />
                Capital Budget Utilization
              </span>
              <span className="text-slate-200 font-bold">
                {utilization.pct.toFixed(1)}% Allocated
              </span>
            </div>

            {/* Visual Animated Track */}
            <div className="w-full h-3 bg-[#080E1C] border border-[#1E2E4E] rounded-full overflow-hidden p-0.5">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${utilization.pct}%` }}
                transition={{
                  duration: reducedMotion ? 0 : 0.25,
                  ease: 'easeOut',
                }}
                className={`h-full rounded-full ${
                  utilization.pct >= 90
                    ? 'bg-gradient-to-r from-[#3DD6C4] to-[#10B981]'
                    : utilization.pct >= 50
                      ? 'bg-gradient-to-r from-[#6366F1] to-[#3DD6C4]'
                      : 'bg-[#3DD6C4]'
                }`}
              />
            </div>

            {/* Metric pill breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs font-mono">
              <div className="p-2.5 rounded-md bg-[#080E1C] border border-[#1E2E4E] flex justify-between items-center">
                <span className="text-slate-400">Total Cap:</span>
                <span className="font-semibold text-white">
                  ${utilization.total.toLocaleString()}
                </span>
              </div>
              <div className="p-2.5 rounded-md bg-[#080E1C] border border-[#1E2E4E] flex justify-between items-center">
                <span className="text-slate-400">Used:</span>
                <span className="font-semibold text-[#3DD6C4]">
                  ${utilization.used.toLocaleString()}
                </span>
              </div>
              <div className="p-2.5 rounded-md bg-[#080E1C] border border-[#1E2E4E] flex justify-between items-center">
                <span className="text-slate-400">Remaining Cushion:</span>
                <span className="font-semibold text-slate-300">
                  ${utilization.remaining.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* 4. Selected Supplier Mitigation Actions */}
          {activePlan.selected_count === 0 ? (
            /* Meaningful Zero-Selection State */
            <div className="bg-[#0D1628] border border-[#1E2E4E] rounded-lg p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto text-amber-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-white">
                No Mitigation Actions Selected Under Budget
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                The requested capital budget of ${activePlan.budget.toLocaleString()} was either $0
                or insufficient to execute the minimum required technical mitigation action for any
                at-risk supplier in this network. Try entering a larger budget constraint (e.g. $100,000+).
              </p>
              <button
                type="button"
                onClick={() => setBudgetInput('250000')}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-[#121D34] hover:bg-[#172644] text-[#3DD6C4] border border-[#1E2E4E] text-xs font-mono transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Try $250,000 Budget</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    Optimal Prioritized Supplier Actions ({activePlan.selected_count})
                  </h3>
                  <p className="text-xs text-slate-400">
                    Decision sequence: Risk Status → Mitigation Cost → Protected Value → Efficiency ROI Multiple → Rationale
                  </p>
                </div>
                <span className="text-xs font-mono text-slate-400 bg-[#080E1C] border border-[#1E2E4E] px-2.5 py-1 rounded">
                  Ranked by Solver Objective
                </span>
              </div>

              {/* Action Cards Grid */}
              <div className="space-y-3.5">
                {activePlan.selected_suppliers.map((item, index) => {
                  const isTopPriority = index === 0
                  return (
                    <motion.div
                      key={item.supplier_id}
                      initial={reducedMotion ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: reducedMotion ? 0 : 0.18,
                        delay: reducedMotion ? 0 : Math.min(index * 0.03, 0.15),
                      }}
                      className={`bg-[#0D1628] border ${
                        isTopPriority ? 'border-[#3DD6C4]/50 shadow-sm' : 'border-[#1E2E4E]'
                      } hover:border-[#283E66] rounded-lg p-5 transition-all`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                        {/* Left: Supplier Identity & Critical Metrics */}
                        <div className="space-y-3 flex-1">
                          {/* Title Bar */}
                          <div className="flex flex-wrap items-center gap-2.5">
                            <span className="text-xs font-mono font-bold bg-[#121F38] text-slate-300 px-2 py-0.5 rounded border border-[#1E2E4E]">
                              #{index + 1}
                            </span>
                            <h4 className="text-lg font-bold text-white tracking-tight">
                              {item.supplier_name}
                            </h4>
                            {isTopPriority && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#3DD6C4]/10 text-[#3DD6C4] border border-[#3DD6C4]/30">
                                Top Priority
                              </span>
                            )}
                            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-rose-950/60 text-rose-300 border border-rose-800/60">
                              Tier {item.criticality_tier}
                            </span>
                            <RiskBadge score={item.current_risk_score} size="sm" />
                          </div>

                        {/* Financial & Operational Parameters */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
                          <div className="p-2 rounded-md bg-[#080E1C] border border-[#1E2E4E]">
                            <span className="text-[10px] text-slate-400 block uppercase">
                              Mitigation Cost
                            </span>
                            <span className="text-sm font-bold text-white">
                              ${item.mitigation_cost.toLocaleString()}
                            </span>
                          </div>

                          <div className="p-2 rounded-md bg-[#080E1C] border border-[#1E2E4E]">
                            <span className="text-[10px] text-slate-400 block uppercase">
                              Protected Revenue
                            </span>
                            <span className="text-sm font-bold text-emerald-400">
                              ${item.expected_protected_revenue.toLocaleString()}
                            </span>
                          </div>

                          <div className="p-2 rounded-md bg-[#080E1C] border border-[#1E2E4E]">
                            <span className="text-[10px] text-slate-400 block uppercase">
                              Value-Efficiency
                            </span>
                            <span className="text-sm font-bold text-indigo-400">
                              {item.efficiency_ratio.toFixed(1)}x ROI
                            </span>
                          </div>

                          <div className="p-2 rounded-md bg-[#080E1C] border border-[#1E2E4E]">
                            <span className="text-[10px] text-slate-400 block uppercase">
                              Spend Exposure
                            </span>
                            <span className="text-sm font-bold text-slate-300">
                              ${item.annual_spend.toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {/* Deterministic Explanation Callout */}
                        <div className="p-3 rounded-md bg-[#080E1C] border border-[#1E2E4E] text-xs leading-relaxed space-y-1">
                          <div className="flex items-center space-x-1.5 text-slate-400 font-mono text-[10px] uppercase tracking-wider font-semibold">
                            <Info className="w-3.5 h-3.5 text-[#3DD6C4]" />
                            <span>Mathematical Justification (Deterministic)</span>
                          </div>
                          <p className="text-slate-200">{item.reason}</p>
                        </div>
                      </div>

                      {/* Right: Operational Actions */}
                      <div className="flex sm:flex-row lg:flex-col items-center sm:justify-end gap-2 shrink-0 pt-2 lg:pt-0">
                        {/* Inspect in Network */}
                        <Link
                          to={`/network?select=${item.supplier_id}`}
                          className="w-full inline-flex items-center justify-center space-x-1.5 px-3 py-2 rounded-md bg-[#121D34] hover:bg-[#172644] text-[#3DD6C4] border border-[#1E2E4E] hover:border-[#3DD6C4]/40 text-xs font-mono font-medium transition-colors"
                          title="Locate and focus this node on the interactive dependency graph"
                        >
                          <Network className="w-3.5 h-3.5" />
                          <span>Inspect in Network</span>
                        </Link>

                        {/* View Supplier Detail */}
                        <Link
                          to={`/suppliers/${item.supplier_id}`}
                          className="w-full inline-flex items-center justify-center space-x-1.5 px-3 py-2 rounded-md bg-[#121D34] hover:bg-[#172644] text-slate-200 hover:text-white border border-[#1E2E4E] text-xs font-mono font-medium transition-colors"
                          title="Open historical telemetry, contributing factors, and dependencies"
                        >
                          <span>Telemetry Detail</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
