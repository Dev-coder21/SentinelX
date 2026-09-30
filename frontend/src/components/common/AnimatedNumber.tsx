import React, { useState, useEffect, useRef } from 'react'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'

interface AnimatedNumberProps {
  value: number
  decimals?: number
  duration?: number
  prefix?: string
  suffix?: string
  className?: string
}

const AnimatedNumberInner: React.FC<AnimatedNumberProps> = ({
  value,
  decimals = 0,
  duration = 0.25,
  prefix = '',
  suffix = '',
  className,
}) => {
  const [displayValue, setDisplayValue] = useState<number>(value)
  const prevValueRef = useRef<number>(value)

  useEffect(() => {
    const startValue = prevValueRef.current
    const targetValue = value

    if (startValue === targetValue) {
      return
    }

    let startTime: number | null = null
    let frameId: number

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const elapsed = (timestamp - startTime) / (duration * 1000)
      const progress = Math.min(elapsed, 1)

      // Cubic ease-out: 1 - (1 - t)^3
      const ease = 1 - Math.pow(1 - progress, 3)
      const current = startValue + (targetValue - startValue) * ease
      setDisplayValue(current)

      if (progress < 1) {
        frameId = requestAnimationFrame(step)
      } else {
        setDisplayValue(targetValue)
        prevValueRef.current = targetValue
      }
    }

    frameId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frameId)
  }, [value, duration])

  const formatted =
    decimals > 0
      ? displayValue.toFixed(decimals)
      : Math.round(displayValue).toLocaleString()

  return (
    <span className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  )
}

/**
 * AnimatedNumber
 * Smoothly interpolates numeric values on mount or when data updates.
 * Adheres strictly to 150-300ms timing with cubic ease-out.
 * Displays final value instantly without effects when prefers-reduced-motion is active.
 */
export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  decimals = 0,
  duration = 0.25,
  prefix = '',
  suffix = '',
  className,
}) => {
  const reducedMotion = usePrefersReducedMotion()

  if (reducedMotion) {
    const formatted =
      decimals > 0 ? value.toFixed(decimals) : Math.round(value).toLocaleString()
    return (
      <span className={className}>
        {prefix}
        {formatted}
        {suffix}
      </span>
    )
  }

  return (
    <AnimatedNumberInner
      value={value}
      decimals={decimals}
      duration={duration}
      prefix={prefix}
      suffix={suffix}
      className={className}
    />
  )
}
