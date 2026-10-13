import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, type ReactNode } from 'react';

/** Bottom sheet on phones, centred dialog on larger screens. Esc closes. */
export function Sheet({ open, onClose, label, children }: { open: boolean; onClose: () => void; label: string; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => panel.current?.querySelector<HTMLElement>('[data-autofocus], button')?.focus(), 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
      // Keep Tab inside the dialog.
      if (e.key === 'Tab' && panel.current) {
        const items = panel.current.querySelectorAll<HTMLElement>('button, a[href], input, [tabindex]:not([tabindex="-1"])');
        if (!items.length) return;
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey, true);
      prev?.focus?.();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="sheet-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          onClick={onClose}
        >
          <motion.div
            ref={panel}
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-label={label}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 170, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
