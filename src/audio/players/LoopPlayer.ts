import type { SoundDef } from '../../model/types';
import { playStream } from '../voices';
import { type ChannelPlayer, type PlayerEnv, VariantMemory, VoiceRegistry } from './ChannelPlayer';

export const LOOP_FADE_SECONDS = 1.5;

/**
 * Ambiance: independent loops that stack. Each click toggles one on/off.
 */
export class LoopPlayer implements ChannelPlayer {
  private readonly voices: VoiceRegistry;
  private readonly variants = new VariantMemory();

  constructor(private readonly env: PlayerEnv) {
    this.voices = new VoiceRegistry(env.emit);
  }

  trigger(sound: SoundDef): void {
    if (this.voices.has(sound.id)) {
      this.voices.stop(sound.id, LOOP_FADE_SECONDS);
      return;
    }
    const url = this.env.loader.url(this.variants.next(sound));
    const voice = playStream(this.env.ctx, url, this.env.output, {
      volume: sound.volume,
      loop: true,
      fadeIn: LOOP_FADE_SECONDS,
    });
    this.voices.add(sound.id, voice);
  }

  stopAll(fadeSeconds: number): void {
    this.voices.stopAll(fadeSeconds);
  }
}
