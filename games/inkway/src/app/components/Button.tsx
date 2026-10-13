import { motion, type HTMLMotionProps } from 'motion/react';
import type { ReactNode } from 'react';
import { sfx } from '../../audio/sfx';

interface Props extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: 'primary' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  kbd?: string;
  icon?: ReactNode;
  children?: ReactNode;
}

export function Button({ variant = 'outline', size = 'md', kbd, icon, children, className, onClick, ...rest }: Props) {
  return (
    <motion.button
      type="button"
      className={`btn btn-${variant} btn-${size}${className ? ` ${className}` : ''}`}
      whileHover={{ y: -2, scale: 1.02 }}
      whileTap={{ scale: 0.96, y: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 22 }}
      onClick={(e) => {
        sfx.ensure();
        sfx.ui();
        onClick?.(e);
      }}
      {...rest}
    >
      {icon}
      {children != null && <span>{children}</span>}
      {kbd && <kbd className="kbd">{kbd}</kbd>}
    </motion.button>
  );
}

export function Key({ children, wide, active }: { children: ReactNode; wide?: boolean; active?: boolean }) {
  return <kbd className={`key${wide ? ' key-wide' : ''}${active ? ' is-active' : ''}`}>{children}</kbd>;
}
