/**
 * Fetches and decodes short audio files into memory, once.
 * Used for one-shots (sons) so they start instantly on click.
 * Long files (musiques, ambiances) are streamed instead, see voices.ts.
 */
export class SampleLoader {
  private readonly cache = new Map<string, Promise<AudioBuffer>>();

  constructor(
    private readonly ctx: AudioContext,
    private readonly baseUrl: string,
  ) {}

  /** Full URL of a file declared in library.json. */
  url(file: string): string {
    return this.baseUrl + file;
  }

  load(file: string): Promise<AudioBuffer> {
    let pending = this.cache.get(file);
    if (!pending) {
      pending = fetch(this.url(file))
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status} pour ${file}`);
          return r.arrayBuffer();
        })
        .then((data) => this.ctx.decodeAudioData(data));
      // Do not cache failures: a fixed file can be retried.
      pending.catch(() => this.cache.delete(file));
      this.cache.set(file, pending);
    }
    return pending;
  }
}
