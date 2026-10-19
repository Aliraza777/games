/**
 * Touch controls over the well:
 *   drag sideways → move a cell per step     drag down slowly → soft drop
 *   flick down    → hard drop                swipe up         → hold
 *   tap           → rotate clockwise         two-finger tap   → rotate counter-clockwise
 */
export interface GestureHandlers {
  cellPx: () => number;
  shift: (dir: -1 | 1) => void;
  softStep: () => void;
  hardDrop: () => void;
  rotate: (dir: 1 | -1) => void;
  hold: () => void;
  enabled: () => boolean;
}

export function attachGestures(el: HTMLElement, h: GestureHandlers): () => void {
  const pointers = new Set<number>();
  let s: { id: number; x: number; y: number; t: number; ax: number; ay: number; moved: boolean; multi: boolean; vy: number; ly: number; lt: number } | null = null;

  const down = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' || !h.enabled()) return;
    e.preventDefault();
    pointers.add(e.pointerId);
    if (pointers.size === 1) {
      s = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp, ax: e.clientX, ay: e.clientY, moved: false, multi: false, vy: 0, ly: e.clientY, lt: e.timeStamp };
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // Not all pointers can be captured (e.g. already released); gestures still work.
      }
    } else if (s) s.multi = true;
  };

  const move = (e: PointerEvent) => {
    if (!s || e.pointerId !== s.id || !h.enabled()) return;
    e.preventDefault();
    const step = h.cellPx() * 0.9;
    let dx = e.clientX - s.ax;
    while (dx >= step) { h.shift(1); s.ax += step; dx -= step; s.moved = true; }
    while (dx <= -step) { h.shift(-1); s.ax -= step; dx += step; s.moved = true; }
    // Soft drop only on a mostly vertical, steady drag.
    let dy = e.clientY - s.ay;
    const vertical = Math.abs(e.clientY - s.y) > Math.abs(e.clientX - s.x) * 1.2;
    if (vertical) while (dy >= step * 1.1) { h.softStep(); s.ay += step * 1.1; dy -= step * 1.1; s.moved = true; }
    else s.ay = e.clientY;
    const dt = e.timeStamp - s.lt;
    if (dt > 0) s.vy = 0.6 * s.vy + 0.4 * ((e.clientY - s.ly) / dt);
    s.ly = e.clientY;
    s.lt = e.timeStamp;
  };

  const up = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    if (!s || e.pointerId !== s.id) return;
    const g = s;
    s = null;
    if (!h.enabled()) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    const dt = e.timeStamp - g.t;
    const cell = h.cellPx();
    if (!g.moved && Math.abs(dx) < 12 && Math.abs(dy) < 12 && dt < 350) h.rotate(g.multi ? -1 : 1);
    else if (dy > cell * 1.5 && g.vy > 0.7 && Math.abs(dy) > Math.abs(dx)) h.hardDrop();
    else if (dy < -cell * 2 && Math.abs(dy) > Math.abs(dx) * 1.4 && dt < 600) h.hold();
  };

  const cancel = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    if (s?.id === e.pointerId) s = null;
  };

  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', cancel);
  return () => {
    el.removeEventListener('pointerdown', down);
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointercancel', cancel);
  };
}
