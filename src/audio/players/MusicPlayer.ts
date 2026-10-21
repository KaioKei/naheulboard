import type { SoundDef } from '../../model/types';
import { playStream } from '../voices';
import { type ChannelPlayer, type PlayerEnv, VariantMemory, VoiceRegistry } from './ChannelPlayer';

export const MUSIC_CROSSFADE_SECONDS = 2.5;

/**
 * Musique: exclusive. Clicking a track crossfades from the current one.
 * Clicking the playing track again fades it out.
 */
export class MusicPlayer implements ChannelPlayer {
  private readonly voices: VoiceRegistry;
  private readonly variants = new VariantMemory();

  constructor(private readonly env: PlayerEnv) {
    this.voices = new VoiceRegistry(env.emit);
  }

  trigger(sound: SoundDef): void {
    const wasPlaying = this.voices.has(sound.id);
    this.voices.stopAll(MUSIC_CROSSFADE_SECONDS);
    if (wasPlaying) return;

    const url = this.env.loader.url(this.variants.next(sound));
    const voice = playStream(this.env.ctx, url, this.env.output, {
      volume: sound.volume,
      loop: true,
      fadeIn: MUSIC_CROSSFADE_SECONDS,
    });
    this.voices.add(sound.id, voice);
  }

  stopAll(fadeSeconds: number): void {
    this.voices.stopAll(fadeSeconds);
  }
}
