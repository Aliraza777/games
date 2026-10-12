import { AnimatePresence, motion } from 'motion/react';
import { useApp } from '../../store/app';
import { spring } from '../../theme/motion';

export function Toasts() {
  const toasts = useApp((s) => s.toasts);
  const dismiss = useApp((s) => s.dismissToast);
  return (
    <div className="toasts" role="status" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.button
            key={t.id}
            layout
            className="toast"
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={spring.snappy}
            onClick={() => dismiss(t.id)}
          >
            {t.text}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
