import type { Engine } from '../engine/Engine';
import type { ModeId } from '../types';
import type { Mode } from './BaseMode';
import { FlickMode } from './FlickMode';
import { FlowMode } from './FlowMode';
import { PrecisionMode } from './PrecisionMode';
import { ReflexMode } from './ReflexMode';
import { TrackMode } from './TrackMode';
import { ZenMode } from './ZenMode';

const MODES: Record<ModeId, new (e: Engine) => Mode> = {
  flick: FlickMode,
  track: TrackMode,
  precision: PrecisionMode,
  reflex: ReflexMode,
  flow: FlowMode,
  zen: ZenMode,
};

export function createMode(id: ModeId, engine: Engine): Mode {
  return new MODES[id](engine);
}
