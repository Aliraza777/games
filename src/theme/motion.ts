/** Shared motion language for the UI. Game objects use their own fixed-time tweens. */
export const spring = {
  snappy: { type: 'spring', stiffness: 300, damping: 25 },
  soft: { type: 'spring', stiffness: 180, damping: 22 },
  bouncy: { type: 'spring', stiffness: 420, damping: 14 },
} as const;

export const pageVariants = {
  initial: { opacity: 0, y: 14, scale: 0.99 },
  animate: { opacity: 1, y: 0, scale: 1, transition: spring.soft },
  exit: { opacity: 0, scale: 1.01, transition: { duration: 0.16 } },
};

export const staggerChildren = (stagger = 0.05, delay = 0.05) => ({
  animate: { transition: { staggerChildren: stagger, delayChildren: delay } },
});

export const riseIn = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: spring.snappy },
};
