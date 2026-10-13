import { motion, type HTMLMotionProps } from 'motion/react';
import { useRef, type PointerEvent, type ReactNode } from 'react';
import { audio } from '../../audio/AudioManager';
import { spring } from '../../theme/motion';

type Variant = 'primary' | 'ghost' | 'subtle' | 'danger';

interface Props extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  kbd?: string;
  icon?: ReactNode;
  children?: ReactNode;
}

/** Lifts on hover, squashes on press, and ripples out from where you clicked. */
export function Button({
  variant = 'ghost',
  size = 'md',
  kbd,
  icon,
  children,
  className,
  onPointerDown,
  onPointerEnter,
  onClick,
  ...rest
}: Props) {
  const ref = useRef<HTMLButtonElement>(null);

  const ripple = (e: PointerEvent<HTMLButtonElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const span = document.createElement('span');
    span.className = 'ripple';
    span.style.left = `${e.clientX - rect.left}px`;
    span.style.top = `${e.clientY - rect.top}px`;
    el.appendChild(span);
    span.addEventListener('animationend', () => span.remove());
  };

  return (
    <motion.button
      ref={ref}
      type="button"
      className={`btn btn-${variant} btn-${size}${className ? ` ${className}` : ''}`}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      transition={spring.snappy}
      onPointerDown={(e) => {
        ripple(e);
        onPointerDown?.(e);
      }}
      onPointerEnter={(e) => {
        audio.uiHover();
        onPointerEnter?.(e);
      }}
      onClick={(e) => {
        audio.ensure();
        audio.uiClick();
        onClick?.(e);
      }}
      {...rest}
    >
      {icon}
      {children != null && <span className="btn-label">{children}</span>}
      {kbd && <Kbd>{kbd}</Kbd>}
    </motion.button>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}
