import { motion, type HTMLMotionProps } from 'motion/react';
import type { ReactNode } from 'react';
import { sound } from '../../audio/soundscape';

interface Props extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: 'primary' | 'soft' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  hint?: string;
  children?: ReactNode;
}

/** Calm buttons: a gentle lift on hover, a soft press — no bounce. */
export function Button({ variant = 'soft', size = 'md', icon, hint, children, className, onClick, ...rest }: Props) {
  return (
    <motion.button
      type="button"
      className={`btn btn-${variant} btn-${size}${className ? ` ${className}` : ''}`}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 260, damping: 30 }}
      onClick={(e) => {
        sound.ensure();
        sound.ui();
        onClick?.(e);
      }}
      {...rest}
    >
      {icon}
      {children != null && <span>{children}</span>}
      {hint && <kbd className="kbd">{hint}</kbd>}
    </motion.button>
  );
}
