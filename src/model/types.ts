/**
 * Domain model of the soundboard. Pure data, no audio or DOM code here.
 */

/** The three mixing channels. Order here = display order in the UI. */
export const CHANNELS = ['musique', 'ambiance', 'son'] as const;
export type Channel = (typeof CHANNELS)[number];

export function isChannel(value: unknown): value is Channel {
  return typeof value === 'string' && (CHANNELS as readonly string[]).includes(value);
}

/** One clickable sound, as declared in public/library.json. */
export interface SoundDef {
  /** Unique, stable identifier (kebab-case). Referenced by scenes. */
  id: string;
  /** Text shown under the pictogram. */
  label: string;
  /** Pictogram: either an emoji, or a path to an SVG file in public/icons/ (e.g. "armes/epee.svg"). */
  icon: string;
  channel: Channel;
  /**
   * Paths relative to public/sounds/. Several files = variants:
   * one is picked at random on each trigger.
   */
  files: string[];
  /** Per-sound gain, 0..1. Lets you balance loud and quiet files. */
  volume: number;
}

/**
 * A scene bundles what plays in one place of the adventure.
 * Declared in library.json and validated, but not wired to the UI yet (v0.3).
 */
export interface Scene {
  id: string;
  label: string;
  icon: string;
  /** Id of a "musique" sound to crossfade to, if any. */
  music?: string;
  /** Ids of "ambiance" sounds to have running (the others fade out). */
  ambiances: string[];
  /** Ids of sons to show first while this scene is active. */
  pinned: string[];
}

export interface Library {
  sounds: SoundDef[];
  scenes: Scene[];
}
