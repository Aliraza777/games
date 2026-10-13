import type { SVGProps } from 'react';

const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

type P = SVGProps<SVGSVGElement>;

export const IconClose = (p: P) => (
  <svg {...base} {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
export const IconSettings = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="17" r="2" />
  </svg>
);
export const IconJourney = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 21c-4-3-7-6.5-7-10.5a7 7 0 0 1 14 0c0 4-3 7.5-7 10.5z" />
    <path d="M12 7v7M9.5 11.5L12 14l2.5-2.5" />
  </svg>
);
export const IconLeaf = (p: P) => (
  <svg {...base} {...p}>
    <path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z" />
    <path d="M5 19l7-7" />
  </svg>
);
export const IconBack = (p: P) => (
  <svg {...base} {...p}>
    <path d="M15 18l-6-6 6-6" />
  </svg>
);
export const IconPlay = (p: P) => (
  <svg {...base} {...p}>
    <path d="M8 5.5v13l10-6.5z" fill="currentColor" stroke="none" />
  </svg>
);
export const IconInfo = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </svg>
);
