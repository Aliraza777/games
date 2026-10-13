import type { VehicleId } from '../../game/config';

/** Small side-view silhouettes for the garage cards. */
export function VehicleArt({ id }: { id: VehicleId }) {
  return (
    <svg className={`vehicle-art vehicle-${id}`} viewBox="0 0 120 60" aria-hidden>
      {id === 'car' && (
        <>
          <path className="va-body" d="M14 38 H106 V30 L94 24 H74 L62 14 H38 L28 24 H14 Z" />
          <path className="va-glass" d="M40 17 H60 L68 24 H34 Z" />
          <circle className="va-wheel" cx="34" cy="42" r="9" />
          <circle className="va-wheel" cx="88" cy="42" r="9" />
        </>
      )}
      {id === 'bike' && (
        <>
          <circle className="va-wheel" cx="28" cy="42" r="12" />
          <circle className="va-wheel" cx="92" cy="42" r="12" />
          <path className="va-frame" d="M28 42 L52 28 L82 24 L92 42 M52 28 L60 42 L28 42" />
          <path className="va-rider" d="M52 26 L58 12 L78 22" />
          <circle className="va-helmet" cx="60" cy="9" r="6" />
        </>
      )}
      {id === 'truck' && (
        <>
          <path className="va-body" d="M10 30 H110 V22 L100 18 H76 L68 6 H40 L32 18 H10 Z" />
          <path className="va-glass" d="M42 9 H66 L72 18 H38 Z" />
          <circle className="va-wheel va-big" cx="30" cy="42" r="15" />
          <circle className="va-wheel va-big" cx="90" cy="42" r="15" />
        </>
      )}
    </svg>
  );
}
