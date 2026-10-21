import { rampTo } from './fades';

export interface DuckerOptions {
  /** Gain applied while ducked (0.3 = music drops to 30 %). */
  depth: number;
  /** Seconds to go down. */
  attack: number;
  /** Seconds to come back up once the last stinger ends. */
  release: number;
}

export const DEFAULT_DUCKING: DuckerOptions = { depth: 0.3, attack: 0.15, release: 0.8 };

/**
 * Temporarily lowers a gain stage while something important plays.
 * Counts overlapping requests: the music comes back only after the last one.
 */
export class Ducker {
  private active = 0;

  constructor(
    private readonly ctx: AudioContext,
    private readonly stage: GainNode,
    private readonly options: DuckerOptions = DEFAULT_DUCKING,
  ) {}

  engage(): void {
    this.active++;
    if (this.active === 1) rampTo(this.stage.gain, this.ctx, this.options.depth, this.options.attack);
  }

  release(): void {
    this.active = Math.max(0, this.active - 1);
    if (this.active === 0) rampTo(this.stage.gain, this.ctx, 1, this.options.release);
  }
}
