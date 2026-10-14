/** Units: meters, seconds (planck/Box2D scale). All tuning lives here. */

export const GRAVITY = -20;
export const STEP = 1 / 60;

export const BIKE = {
  chassis: { w: 1.7, h: 0.32, density: 2.6 },
  /** Rider torso (adds weight up high, so flips feel committed). */
  torso: { x: -0.05, y: 0.62, hw: 0.14, hh: 0.3, density: 0.6 },
  /** Crash sensor: your helmet touching the track ends the attempt. */
  head: { x: 0.05, y: 1.18, r: 0.25 },
  wheel: { r: 0.46, x: [-0.82, 0.82] as const, y: -0.42, density: 1, friction: 1.4 },
  motor: { torque: 16, maxSpeed: 52 },
  suspension: { hz: 5, damping: 0.7 },
  /** Air control: hold to spin backwards at this rate (rad/s); release damps the spin. */
  flipSpeed: 6.4,
  flipResponse: 14,
  releaseDamping: 5,
};

export const LANDING = {
  /** Max angle between bike-up and the track normal, in degrees. */
  perfect: 20,
  good: 45,
  /** Speed boost per flip on landing (m/s), capped. */
  boostPerFlip: 3,
  boostMax: 9,
  perfectBoost: 2,
};

export const SCORE = { flip: 100, perfect: 50, gem: 0 };

/** Wheels off the track for this long counts as airborne (bumps don't). */
export const AIR_GRACE = 0.12;

export interface BikeSkin {
  id: string;
  name: string;
  cost: number;
  body: string;
  accent: string;
  trail: string;
  spokes: number;
}

/** Cosmetic bikes, unlocked with gems (like Rider's collection, but original designs). */
export const SKINS: BikeSkin[] = [
  { id: 'spark', name: 'Spark', cost: 0, body: '#ffffff', accent: '#3df2ff', trail: '#3df2ff', spokes: 3 },
  { id: 'comet', name: 'Comet', cost: 3, body: '#ffe14d', accent: '#ff8a3d', trail: '#ffb84d', spokes: 4 },
  { id: 'ember', name: 'Ember', cost: 6, body: '#ff5a4d', accent: '#ffd23f', trail: '#ff7a3d', spokes: 5 },
  { id: 'volt', name: 'Volt', cost: 10, body: '#b6ff4d', accent: '#3dff9e', trail: '#9eff3d', spokes: 3 },
  { id: 'nova', name: 'Nova', cost: 15, body: '#ff4fd8', accent: '#8f6bff', trail: '#ff4fd8', spokes: 6 },
  { id: 'phantom', name: 'Phantom', cost: 20, body: '#c8d0ff', accent: '#6b7bff', trail: '#8f9bff', spokes: 2 },
  { id: 'prism', name: 'Prism', cost: 26, body: '#ffffff', accent: '#ff4fd8', trail: 'rainbow', spokes: 5 },
  { id: 'eclipse', name: 'Eclipse', cost: 33, body: '#1a1a1a', accent: '#ffd23f', trail: '#ffd23f', spokes: 8 },
];
