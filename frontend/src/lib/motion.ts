import type { Transition, Variants } from 'framer-motion'

/**
 * SentinelX Motion Tokens & Transition Presets
 * Purposeful, operational, controlled motion adhering to 150-300ms timings.
 */

export const MOTION_DURATIONS = {
  instant: 0,
  fast: 0.15, // 150ms
  normal: 0.22, // 220ms
  smooth: 0.28, // 280ms
} as const

export const MOTION_EASINGS = {
  // Operational cubic ease-out: brisk start, decelerates cleanly
  easeOut: [0.16, 1, 0.3, 1] as const,
  // Balanced transition for exits and drawers
  easeInOut: [0.4, 0, 0.2, 1] as const,
}

export const TRANSITION_FAST: Transition = {
  duration: MOTION_DURATIONS.fast,
  ease: MOTION_EASINGS.easeOut,
}

export const TRANSITION_NORMAL: Transition = {
  duration: MOTION_DURATIONS.normal,
  ease: MOTION_EASINGS.easeOut,
}

export const TRANSITION_SMOOTH: Transition = {
  duration: MOTION_DURATIONS.smooth,
  ease: MOTION_EASINGS.easeOut,
}

/**
 * Global Page / Route Entrance Variants
 * Subtle vertical micro-translation (4px) combined with fast opacity fade.
 * Zero translation or duration when prefers-reduced-motion is true.
 */
export const getPageMotionVariants = (reducedMotion: boolean): Variants => ({
  initial: {
    opacity: 0,
    y: reducedMotion ? 0 : 4,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: reducedMotion ? 0 : MOTION_DURATIONS.normal,
      ease: MOTION_EASINGS.easeOut,
    },
  },
  exit: {
    opacity: 0,
    y: reducedMotion ? 0 : -4,
    transition: {
      duration: reducedMotion ? 0 : MOTION_DURATIONS.fast,
      ease: MOTION_EASINGS.easeInOut,
    },
  },
})

/**
 * Stagger Container Variants for Data Grids & Feed Items
 */
export const getStaggerContainerVariants = (
  reducedMotion: boolean,
  staggerDelta: number = 0.03
): Variants => ({
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: reducedMotion ? 0 : staggerDelta,
      delayChildren: reducedMotion ? 0 : 0.02,
    },
  },
})

/**
 * Individual Staggered Item Variants
 */
export const getItemFadeVariants = (reducedMotion: boolean): Variants => ({
  hidden: {
    opacity: 0,
    y: reducedMotion ? 0 : 6,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: reducedMotion ? 0 : MOTION_DURATIONS.normal,
      ease: MOTION_EASINGS.easeOut,
    },
  },
})

/**
 * Drawer & Inspector Slide-Over Variants
 */
export const getDrawerVariants = (reducedMotion: boolean): Variants => ({
  hidden: {
    x: reducedMotion ? 0 : '100%',
    opacity: reducedMotion ? 0 : 1,
  },
  visible: {
    x: 0,
    opacity: 1,
    transition: {
      duration: reducedMotion ? 0 : MOTION_DURATIONS.normal,
      ease: MOTION_EASINGS.easeOut,
    },
  },
  exit: {
    x: reducedMotion ? 0 : '100%',
    opacity: reducedMotion ? 0 : 1,
    transition: {
      duration: reducedMotion ? 0 : MOTION_DURATIONS.fast,
      ease: MOTION_EASINGS.easeInOut,
    },
  },
})

/**
 * Modal / Drawer Backdrop Variants
 */
export const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: MOTION_DURATIONS.fast },
  },
  exit: {
    opacity: 0,
    transition: { duration: MOTION_DURATIONS.fast },
  },
}
