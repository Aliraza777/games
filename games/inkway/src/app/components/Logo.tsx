/** The wordmark draws itself like wet ink, then glows. */
export function Logo({ small }: { small?: boolean }) {
  return (
    <svg className={`logo${small ? ' logo-small' : ''}`} viewBox="0 0 520 120" role="img" aria-label="Inkway">
      <defs>
        <linearGradient id="logo-grad" x1="0" x2="1">
          <stop offset="0" stopColor="#46f0ff" />
          <stop offset="0.5" stopColor="#ff4fd8" />
          <stop offset="1" stopColor="#ffd23f" />
        </linearGradient>
      </defs>
      <text x="50%" y="88" textAnchor="middle" className="logo-glow">
        INKWAY
      </text>
      <text x="50%" y="88" textAnchor="middle" className="logo-ink">
        INKWAY
      </text>
      <path className="logo-road" d="M30 108 C 140 96, 200 116, 280 104 S 430 94, 490 106" />
    </svg>
  );
}
