import { keyLabel } from '../../lib/format';
import { isTouchDevice, useProgress } from '../../store/progress';
import { Sheet } from './Sheet';

export function HowToPlay() {
  const keys = useProgress((s) => s.settings.keys);
  const touchButtons = useProgress((s) => s.settings.touchButtons);
  const k = (a: keyof typeof keys) => keys[a].map(keyLabel).join(' / ');
  const touch = isTouchDevice();
  return (
    <div className="help">
      <p className="lead">Pieces fall into the well. Fill a whole row to clear it. Don't let the stack reach the top.</p>
      {touch && !touchButtons ? (
        <ul className="controls">
          <li><b>Drag ← →</b><span>move</span></li>
          <li><b>Tap</b><span>rotate</span></li>
          <li><b>Two-finger tap</b><span>rotate back</span></li>
          <li><b>Drag down</b><span>soft drop</span></li>
          <li><b>Flick down</b><span>hard drop</span></li>
          <li><b>Swipe up</b><span>hold</span></li>
        </ul>
      ) : (
        <ul className="controls">
          <li><b>{k('left')} {k('right')}</b><span>move (hold to slide)</span></li>
          <li><b>{k('cw')}</b><span>rotate</span></li>
          <li><b>{k('ccw')}</b><span>rotate back</span></li>
          <li><b>{k('softDrop')}</b><span>soft drop</span></li>
          <li><b>{k('hardDrop')}</b><span>hard drop</span></li>
          <li><b>{k('hold')}</b><span>hold a piece for later</span></li>
        </ul>
      )}
      <h3>Score big</h3>
      <ul className="tips">
        <li><b>Quad:</b> clear 4 rows at once with the long piece.</li>
        <li><b>T-spin:</b> rotate the T into a tight slot at the last moment.</li>
        <li><b>Back-to-back:</b> chain quads and T-spins for ×1.5.</li>
        <li><b>Combo:</b> clear lines with consecutive pieces.</li>
      </ul>
    </div>
  );
}

export function HelpSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title="How to play" onClose={onClose}>
      <HowToPlay />
      <button type="button" className="btn primary block" onClick={onClose} autoFocus>
        Got it
      </button>
    </Sheet>
  );
}
