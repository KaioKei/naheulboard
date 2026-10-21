/** Minimal typed event emitter (no dependency). */
export class Emitter<T> {
  private listeners = new Set<(event: T) => void>();

  /** Subscribes and returns an unsubscribe function. */
  on(listener: (event: T) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: T): void {
    for (const listener of this.listeners) listener(event);
  }
}

/**
 * What the audio layer tells the UI.
 * - started / stopped: for sounds with a lasting state (musique, ambiance)
 * - fired: a one-shot was played (son), for a visual flash
 */
export type PlaybackEvent =
  | { type: 'started'; soundId: string }
  | { type: 'stopped'; soundId: string }
  | { type: 'fired'; soundId: string };
