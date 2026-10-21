import type { SoundDef } from '../../model/types';
import { jitterRate } from '../variants';
import { playBuffer, type Voice } from '../voices';
import { type ChannelPlayer, type PlayerEnv, VariantMemory } from './ChannelPlayer';

export interface OneShotOptions {
  /** Random pitch/speed variation, e.g. 0.05 = ±5 %. */
  pitchJitter: number;
  /** Hooks around each voice, used by StingerPlayer for ducking. */
  onVoiceStart?: () => void;
  onVoiceEnd?: () => void;
}

/**
 * Bruitage: short sounds played once, overlapping freely,
 * with a random variant and a slight pitch change on each click.
 */
export class OneShotPlayer implements ChannelPlayer {
  private readonly active = new Set<Voice>();
  private readonly variants = new VariantMemory();
  /** Incremented by stopAll so that sounds still loading are dropped. */
  private generation = 0;

  constructor(
    private readonly env: PlayerEnv,
    private readonly options: OneShotOptions,
  ) {}

  trigger(sound: SoundDef): void {
    const file = this.variants.next(sound);
    const generation = this.generation;
    this.env.emit({ type: 'fired', soundId: sound.id });

    this.env.loader
      .load(file)
      .then((buffer) => {
        if (generation !== this.generation) return;
        const voice = playBuffer(this.env.ctx, buffer, this.env.output, {
          volume: sound.volume,
          playbackRate: jitterRate(this.options.pitchJitter),
        });
        this.active.add(voice);
        this.options.onVoiceStart?.();
        void voice.done.then(() => {
          this.active.delete(voice);
          this.options.onVoiceEnd?.();
        });
      })
      .catch((error: unknown) => console.error(`[naheulboard] impossible de jouer ${file}`, error));
  }

  stopAll(fadeSeconds: number): void {
    this.generation++;
    for (const voice of this.active) voice.stop(fadeSeconds);
  }
}
