import type { SoundDef } from '../../model/types';
import type { PlaybackEvent } from '../Emitter';
import type { SampleLoader } from '../SampleLoader';
import { pickVariant } from '../variants';
import type { Voice } from '../voices';

/** What every player receives from the engine. */
export interface PlayerEnv {
  ctx: AudioContext;
  loader: SampleLoader;
  /** The channel bus this player must connect its voices to. */
  output: AudioNode;
  emit: (event: PlaybackEvent) => void;
}

/**
 * One behaviour per channel. Add a new behaviour = add a class implementing this.
 */
export interface ChannelPlayer {
  /** Called when the pictogram is clicked. */
  trigger(sound: SoundDef): void;
  /** Fades out everything this player is playing. */
  stopAll(fadeSeconds: number): void;
}

/** Remembers the last variant used per sound, to avoid immediate repeats. */
export class VariantMemory {
  private readonly last = new Map<string, number>();

  next(sound: SoundDef): string {
    const index = pickVariant(sound.files.length, this.last.get(sound.id));
    this.last.set(sound.id, index);
    return sound.files[index]!;
  }
}

/**
 * Tracks long-running voices by sound id and emits started/stopped,
 * including when a voice ends by itself (e.g. file error).
 */
export class VoiceRegistry {
  private readonly voices = new Map<string, Voice>();

  constructor(private readonly emit: (event: PlaybackEvent) => void) {}

  has(soundId: string): boolean {
    return this.voices.has(soundId);
  }

  add(soundId: string, voice: Voice): void {
    this.voices.set(soundId, voice);
    this.emit({ type: 'started', soundId });
    void voice.done.then(() => {
      if (this.voices.get(soundId) === voice) {
        this.voices.delete(soundId);
        this.emit({ type: 'stopped', soundId });
      }
    });
  }

  stop(soundId: string, fadeSeconds: number): void {
    const voice = this.voices.get(soundId);
    if (!voice) return;
    this.voices.delete(soundId);
    this.emit({ type: 'stopped', soundId });
    voice.stop(fadeSeconds);
  }

  stopAll(fadeSeconds: number): void {
    for (const soundId of [...this.voices.keys()]) this.stop(soundId, fadeSeconds);
  }
}
