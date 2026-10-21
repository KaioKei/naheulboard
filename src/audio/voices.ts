import { rampTo } from './fades';

/**
 * A voice is one sound currently playing, with its own gain node.
 * Two implementations:
 * - buffer voices: decoded in memory, instant start, for short one-shots
 * - stream voices: <audio> element streamed from disk, for long loops/music
 */
export interface Voice {
  /** Resolves once the voice is silent and its audio nodes are released. */
  readonly done: Promise<void>;
  /** Fades out then stops. Calling it twice is harmless. */
  stop(fadeSeconds: number): void;
}

export interface VoiceOptions {
  /** Target gain, 0..1. */
  volume: number;
  loop?: boolean;
  /** Fade-in duration in seconds (0 = immediate). */
  fadeIn?: number;
  /** 1 = normal speed/pitch. Buffer voices only. */
  playbackRate?: number;
}

export function playBuffer(ctx: AudioContext, buffer: AudioBuffer, destination: AudioNode, options: VoiceOptions): Voice {
  const gain = ctx.createGain();
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = options.loop ?? false;
  source.playbackRate.value = options.playbackRate ?? 1;
  source.connect(gain).connect(destination);
  applyFadeIn(ctx, gain, options);

  const done = new Promise<void>((resolve) => {
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      resolve();
    };
  });
  source.start();

  let stopped = false;
  return {
    done,
    stop(fadeSeconds) {
      if (stopped) return;
      stopped = true;
      rampTo(gain.gain, ctx, 0, fadeSeconds);
      try {
        source.stop(ctx.currentTime + fadeSeconds + 0.02);
      } catch {
        // Already ended on its own: nothing to do.
      }
    },
  };
}

export function playStream(ctx: AudioContext, url: string, destination: AudioNode, options: VoiceOptions): Voice {
  const element = new Audio(url);
  element.loop = options.loop ?? false;
  element.preload = 'auto';
  const source = ctx.createMediaElementSource(element);
  const gain = ctx.createGain();
  source.connect(gain).connect(destination);
  applyFadeIn(ctx, gain, options);

  let resolveDone!: () => void;
  const done = new Promise<void>((resolve) => (resolveDone = resolve));

  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    element.pause();
    element.removeAttribute('src');
    element.load(); // frees the network/decoder resources
    source.disconnect();
    gain.disconnect();
    resolveDone();
  };

  element.addEventListener('ended', release);
  element.addEventListener('error', () => {
    if (released) return;
    console.error(`[naheulboard] lecture impossible : ${url}`);
    release();
  });
  element.play().catch((error: unknown) => {
    if (released) return;
    console.error(`[naheulboard] lecture refusée : ${url}`, error);
    release();
  });

  let stopping = false;
  return {
    done,
    stop(fadeSeconds) {
      if (stopping || released) return;
      stopping = true;
      rampTo(gain.gain, ctx, 0, fadeSeconds);
      window.setTimeout(release, fadeSeconds * 1000 + 50);
    },
  };
}

function applyFadeIn(ctx: AudioContext, gain: GainNode, options: VoiceOptions): void {
  const fadeIn = options.fadeIn ?? 0;
  if (fadeIn > 0) {
    gain.gain.value = 0;
    rampTo(gain.gain, ctx, options.volume, fadeIn);
  } else {
    gain.gain.value = options.volume;
  }
}
