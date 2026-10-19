import { useEffect, useRef } from 'react';
import type { PieceType } from '../../game/pieces';
import { drawPreview } from '../../game/render';
import type { Theme } from '../../game/themes';

export function PiecePreview({ type, theme, dimmed = false, className = '' }: { type: PieceType | null; theme: Theme; dimmed?: boolean; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    drawPreview(c, type, theme, dimmed);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => drawPreview(c, type, theme, dimmed)) : null;
    ro?.observe(c);
    return () => ro?.disconnect();
  }, [type, theme, dimmed]);
  return <canvas ref={ref} className={`piece-preview ${className}`} role="img" aria-label={type ? `${type} piece` : 'empty'} />;
}
