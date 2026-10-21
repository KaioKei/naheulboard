/**
 * Moves an AudioParam to `target` over `seconds`, starting from its current
 * value. Safe to call while a previous ramp is still running.
 */
export function rampTo(param: AudioParam, ctx: BaseAudioContext, target: number, seconds: number): void {
  const now = ctx.currentTime;
  param.cancelScheduledValues(now);
  param.setValueAtTime(param.value, now);
  if (seconds <= 0) {
    param.setValueAtTime(target, now);
  } else {
    param.linearRampToValueAtTime(target, now + seconds);
  }
}

/** Slider position (0..1) → gain. Squared curve feels more natural to the ear. */
export function sliderToGain(position: number): number {
  const p = Math.min(1, Math.max(0, position));
  return p * p;
}

export function gainToSlider(gain: number): number {
  return Math.sqrt(Math.min(1, Math.max(0, gain)));
}
