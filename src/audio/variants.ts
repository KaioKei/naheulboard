/**
 * Picks the index of the variant to play, avoiding the previous one when
 * there is a choice, so that three sword files never play the same twice in a row.
 */
export function pickVariant(count: number, previous: number | undefined, random: () => number = Math.random): number {
  if (count <= 1) return 0;
  if (previous === undefined || previous < 0 || previous >= count) {
    return Math.floor(random() * count);
  }
  // Pick among the (count - 1) others, then shift past `previous`.
  const index = Math.floor(random() * (count - 1));
  return index >= previous ? index + 1 : index;
}

/** Random playback rate around 1, e.g. jitter 0.05 → [0.95, 1.05]. */
export function jitterRate(jitter: number, random: () => number = Math.random): number {
  return 1 + (random() * 2 - 1) * jitter;
}
