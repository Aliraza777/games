/** Wordmark with a little falling T as the "A". */
export function Logo({ small = false }: { small?: boolean }) {
  return (
    <h1 className={`logo ${small ? 'small' : ''}`} aria-label="Stackfall">
      <span aria-hidden="true">STACK</span>
      <span className="logo-mark" aria-hidden="true">
        <i style={{ gridArea: '1 / 1' }} />
        <i style={{ gridArea: '1 / 2' }} />
        <i style={{ gridArea: '1 / 3' }} />
        <i style={{ gridArea: '2 / 2' }} />
      </span>
      <span aria-hidden="true">FALL</span>
    </h1>
  );
}
