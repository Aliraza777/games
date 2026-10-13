export function Logo() {
  return (
    <div className="logo" aria-label="Pulse">
      <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden>
        <circle className="logo-pulse" cx="16" cy="16" r="13" />
        <circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" strokeWidth="2.5" />
        <circle cx="16" cy="16" r="5.5" fill="none" stroke="currentColor" strokeOpacity=".5" strokeWidth="2" />
        <circle cx="16" cy="16" r="2.2" fill="currentColor" />
      </svg>
      <span>Pulse</span>
    </div>
  );
}
