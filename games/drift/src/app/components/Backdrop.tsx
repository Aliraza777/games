/** Slow aurora behind the menus — pure CSS, paused under reduced motion. */
export function Backdrop() {
  return (
    <div className="backdrop" aria-hidden>
      <span className="aurora a1" />
      <span className="aurora a2" />
      <span className="aurora a3" />
    </div>
  );
}
