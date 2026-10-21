import { CHANNELS, type Channel, type SoundDef } from '../model/types';
import { Ducker } from './Ducker';
import { Emitter, type PlaybackEvent } from './Emitter';
import { rampTo } from './fades';
import { LoopPlayer } from './players/LoopPlayer';
import { MusicPlayer } from './players/MusicPlayer';
import { StingerPlayer } from './players/StingerPlayer';
import type { ChannelPlayer, PlayerEnv } from './players/ChannelPlayer';
import { SampleLoader } from './SampleLoader';

export type VolumeTarget = Channel | 'master';

/** Starting gains. Music and ambiances low: they must sit under the voices. */
export const DEFAULT_VOLUMES: Record<VolumeTarget, number> = {
  master: 0.8,
  musique: 0.35,
  ambiance: 0.45,
  son: 0.8,
};

export const PANIC_FADE_SECONDS = 1;

/** Channels whose sounds are short and preloaded in memory. */
const PRELOADED_CHANNELS: readonly Channel[] = ['son'];

/**
 * Audio graph:
 *
 *   voices ─▶ bus[musique] ─▶ duck stage ─┐
 *   voices ─▶ bus[ambiance] ──────────────┼─▶ master ─▶ limiter ─▶ speakers
 *   voices ─▶ bus[son] ───────────────────┘
 *
 * The UI only talks to this class. It knows nothing about the DOM.
 */
export class AudioEngine {
  readonly events = new Emitter<PlaybackEvent>();

  private readonly ctx: AudioContext;
  private readonly loader: SampleLoader;
  private readonly master: GainNode;
  private readonly buses: Record<Channel, GainNode>;
  private readonly players: Record<Channel, ChannelPlayer>;
  private readonly volumes: Record<VolumeTarget, number> = { ...DEFAULT_VOLUMES };

  constructor(soundsBaseUrl: string) {
    this.ctx = new AudioContext({ latencyHint: 'interactive' });
    this.loader = new SampleLoader(this.ctx, soundsBaseUrl);

    // Gentle limiter: stacking many sounds should not clip.
    const limiter = this.ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;
    limiter.connect(this.ctx.destination);

    this.master = this.createGain(DEFAULT_VOLUMES.master, limiter);

    // The music bus goes through an extra stage that "sons" can lower.
    const duckStage = this.createGain(1, this.master);

    this.buses = {
      musique: this.createGain(DEFAULT_VOLUMES.musique, duckStage),
      ambiance: this.createGain(DEFAULT_VOLUMES.ambiance, this.master),
      son: this.createGain(DEFAULT_VOLUMES.son, this.master),
    };

    this.players = {
      musique: new MusicPlayer(this.env('musique')),
      ambiance: new LoopPlayer(this.env('ambiance')),
      son: new StingerPlayer(this.env('son'), new Ducker(this.ctx, duckStage)),
    };
  }

  /** Plays / toggles a sound according to its channel's behaviour. */
  trigger(sound: SoundDef): void {
    // Browsers keep audio suspended until a user gesture: resume on first click.
    if (this.ctx.state !== 'running') void this.ctx.resume();
    this.players[sound.channel].trigger(sound);
  }

  /**
   * Decodes short sounds in advance so that the first click is instant.
   * Returns the files that could not be loaded.
   */
  async preload(sounds: SoundDef[]): Promise<string[]> {
    const files = sounds.filter((s) => PRELOADED_CHANNELS.includes(s.channel)).flatMap((s) => s.files);
    const results = await Promise.allSettled(files.map((f) => this.loader.load(f)));
    return files.filter((_, i) => results[i]?.status === 'rejected');
  }

  getVolume(target: VolumeTarget): number {
    return this.volumes[target];
  }

  /** Gain 0..1 for a channel bus or the master. */
  setVolume(target: VolumeTarget, gain: number): void {
    this.volumes[target] = gain;
    const node = target === 'master' ? this.master : this.buses[target];
    rampTo(node.gain, this.ctx, gain, 0.05);
  }

  /** Panic button: everything fades out. */
  stopAll(fadeSeconds = PANIC_FADE_SECONDS): void {
    for (const channel of CHANNELS) this.players[channel].stopAll(fadeSeconds);
  }

  private env(channel: Channel): PlayerEnv {
    return {
      ctx: this.ctx,
      loader: this.loader,
      output: this.buses[channel],
      emit: (event) => this.events.emit(event),
    };
  }

  private createGain(value: number, destination: AudioNode): GainNode {
    const node = this.ctx.createGain();
    node.gain.value = value;
    node.connect(destination);
    return node;
  }
}
