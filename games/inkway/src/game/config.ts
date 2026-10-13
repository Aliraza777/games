/** All tuning lives here. Units: meters, seconds, kilograms (planck/Box2D scale). */

export type InkKind = 'road' | 'bounce' | 'boost';
export type VehicleId = 'car' | 'bike' | 'truck';

export interface InkSpec {
  kind: InkKind;
  label: string;
  key: '1' | '2' | '3';
  color: string;
  /** Ink spent per meter drawn. */
  cost: number;
  friction: number;
  restitution: number;
  /** Surface conveyor speed in m/s (boost). */
  tangentSpeed: number;
  hint: string;
}

export const INKS: Record<InkKind, InkSpec> = {
  road: {
    kind: 'road',
    label: 'Road',
    key: '1',
    color: '#46f0ff',
    cost: 1,
    friction: 0.95,
    restitution: 0,
    tangentSpeed: 0,
    hint: 'Solid and grippy',
  },
  bounce: {
    kind: 'bounce',
    label: 'Bounce',
    key: '2',
    color: '#ff4fd8',
    cost: 1.6,
    friction: 0.6,
    restitution: 1.05,
    tangentSpeed: 0,
    hint: 'A trampoline — launches you',
  },
  boost: {
    kind: 'boost',
    label: 'Boost',
    key: '3',
    color: '#ffd23f',
    cost: 2,
    friction: 0.9,
    restitution: 0,
    tangentSpeed: 16,
    hint: 'A conveyor that hurls you forward',
  },
};

export const INK_ORDER: InkKind[] = ['road', 'bounce', 'boost'];

export interface VehicleSpec {
  id: VehicleId;
  name: string;
  tagline: string;
  stats: { speed: number; grip: number; flip: number };
  color: string;
  chassis: { w: number; h: number; density: number };
  wheel: { r: number; x: [number, number]; y: number; density: number; friction: number };
  motor: { torque: number; maxSpeed: number };
  suspension: { hz: number; damping: number };
  /** Lean torque per kg, on the ground and in the air. */
  tilt: { ground: number; air: number };
  /** Upward impulse per kg for a hop. */
  hop: number;
  /** Crash sensor (local coords): touching ground with this ends the run. */
  head: { x: number; y: number; r: number };
}

export const VEHICLES: Record<VehicleId, VehicleSpec> = {
  car: {
    id: 'car',
    name: 'Car',
    tagline: 'Balanced and forgiving',
    stats: { speed: 3, grip: 3, flip: 2 },
    color: '#46f0ff',
    chassis: { w: 2.6, h: 0.6, density: 2 },
    wheel: { r: 0.48, x: [-0.95, 0.95], y: -0.5, density: 1, friction: 1 },
    motor: { torque: 20, maxSpeed: 34 },
    suspension: { hz: 4.5, damping: 0.7 },
    tilt: { ground: 1.5, air: 6 },
    hop: 5.5,
    head: { x: 0, y: 0.62, r: 0.3 },
  },
  bike: {
    id: 'bike',
    name: 'Bike',
    tagline: 'Fast, light, flips like a dream',
    stats: { speed: 4, grip: 2, flip: 4 },
    color: '#ff4fd8',
    chassis: { w: 1.6, h: 0.35, density: 2.4 },
    wheel: { r: 0.5, x: [-0.85, 0.85], y: -0.45, density: 0.8, friction: 1 },
    motor: { torque: 10, maxSpeed: 39 },
    suspension: { hz: 5, damping: 0.65 },
    tilt: { ground: 2.5, air: 10 },
    hop: 6,
    head: { x: 0.05, y: 1.25, r: 0.28 },
  },
  truck: {
    id: 'truck',
    name: 'Monster truck',
    tagline: 'Huge wheels eat messy lines',
    stats: { speed: 2, grip: 4, flip: 1 },
    color: '#ffd23f',
    chassis: { w: 3.0, h: 0.8, density: 1.6 },
    wheel: { r: 0.82, x: [-1.2, 1.2], y: -0.75, density: 0.9, friction: 1.1 },
    motor: { torque: 45, maxSpeed: 17 },
    suspension: { hz: 3.5, damping: 0.7 },
    tilt: { ground: 1.2, air: 4.5 },
    hop: 5,
    head: { x: 0, y: 0.85, r: 0.35 },
  },
};

export const VEHICLE_ORDER: VehicleId[] = ['car', 'bike', 'truck'];

export const GRAVITY = -14;

export const TANK = {
  max: 100,
  dropRefill: 18,
  flipRefill: 12,
  /** Ink per second while wheels are on solid terrain. */
  trickle: 1.6,
};

/** Minimum spacing between sampled stroke points (m). */
export const SAMPLE_SPACING = 0.55;
/** You can't draw within this distance of your vehicle (m) — no self-traps. */
export const NO_DRAW_RADIUS = 1.9;
/** Stroke points further apart than this get filled in (fast mouse flicks). */
export const MAX_SEGMENT = 2.5;
export const MAX_STROKES = 48;

export const FOCUS = { max: 100, drain: 30, regen: 12, timeScale: 0.35 };

export const SCORE = { perMeter: 1, star: 50, flip: 150, bigAir: 60, bigAirTime: 1.4 };
