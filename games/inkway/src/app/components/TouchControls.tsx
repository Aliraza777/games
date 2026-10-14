import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { clamp } from '../../lib/math';
import { capturePointer } from '../../lib/device';

export interface TouchApi {
  setVirtual: (v: Partial<{ throttle: number; lean: number; hop: boolean; focus: boolean }>) => void;
}

const RADIUS = 52;
const DEAD = 0.18;

/**
 * Two-thumb touch mode. The left thumb drives with a single stick (→ gas,
 * ← brake, ↑/↓ lean — diagonals do both), the right finger draws on the
 * screen. Hop and Slow sit within reach of the drawing thumb.
 */
export function TouchControls({ api }: { api: TouchApi }) {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0, active: false });

  const update = (e: ReactPointerEvent) => {
    const r = base.current!.getBoundingClientRect();
    let dx = (e.clientX - (r.left + r.width / 2)) / RADIUS;
    let dy = (e.clientY - (r.top + r.height / 2)) / RADIUS;
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    setKnob({ x: dx * RADIUS, y: dy * RADIUS, active: true });
    const throttle = Math.abs(dx) < DEAD ? 0 : dx > 0 ? clamp((dx - DEAD) / (1 - DEAD) + 0.35, 0, 1) : -1;
    const lean = Math.abs(dy) < DEAD + 0.1 ? 0 : -Math.sign(dy);
    api.setVirtual({ throttle, lean });
    navigatorVibrate(throttle !== 0 || lean !== 0);
  };

  const release = () => {
    setKnob({ x: 0, y: 0, active: false });
    api.setVirtual({ throttle: 0, lean: 0 });
  };

  return (
    <div className="touch-controls" onContextMenu={(e) => e.preventDefault()}>
      <div
        ref={base}
        className={`stick${knob.active ? ' is-active' : ''}`}
        role="slider"
        aria-label="Drive stick: right for gas, left to brake, up or down to lean"
        aria-valuenow={Math.round((knob.x / RADIUS) * 100)}
        onPointerDown={(e) => {
          capturePointer(e.currentTarget, e.pointerId);
          update(e);
        }}
        onPointerMove={(e) => knob.active && update(e)}
        onPointerUp={release}
        onPointerCancel={release}
      >
        <span className="stick-arrow up" aria-hidden>↺</span>
        <span className="stick-arrow right" aria-hidden>GAS</span>
        <span className="stick-arrow left" aria-hidden>BRAKE</span>
        <span className="stick-arrow down" aria-hidden>↻</span>
        <span className="stick-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
      </div>
      <div className="touch-actions">
        <button
          type="button"
          className="touch-btn"
          onPointerDown={(e) => {
            e.preventDefault();
            api.setVirtual({ hop: true });
          }}
        >
          Hop
        </button>
        <button
          type="button"
          className="touch-btn touch-slow"
          onPointerDown={(e) => {
            e.preventDefault();
            api.setVirtual({ focus: true });
          }}
          onPointerUp={() => api.setVirtual({ focus: false })}
          onPointerCancel={() => api.setVirtual({ focus: false })}
        >
          Slow
        </button>
      </div>
    </div>
  );
}

let lastBuzz = false;
function navigatorVibrate(engaged: boolean) {
  if (engaged && !lastBuzz && 'vibrate' in navigator) navigator.vibrate(6);
  lastBuzz = engaged;
}

/** Visual legend for touch controls (pause menu, title screen). */
export function TouchLegend() {
  return (
    <ul className="touch-legend">
      <li>
        <b>Left thumb · stick</b> → gas, ← brake, ↑ ↓ lean & flip
      </li>
      <li>
        <b>Right finger</b> draws the road — time slows while you draw
      </li>
      <li>
        <b>Hop</b> jumps, hold <b>Slow</b> for extra slow-motion
      </li>
      <li>Tap the colored inks to switch road / bounce / boost</li>
    </ul>
  );
}
