import { describe, expect, it } from 'vitest';
import { jitterRate, pickVariant } from './variants';

describe('pickVariant', () => {
  it('returns 0 when there is a single file', () => {
    expect(pickVariant(1, 0)).toBe(0);
  });

  it('never repeats the previous variant', () => {
    for (let i = 0; i < 200; i++) {
      const previous = i % 3;
      expect(pickVariant(3, previous)).not.toBe(previous);
    }
  });

  it('covers every other variant', () => {
    expect(pickVariant(3, 1, () => 0)).toBe(0);
    expect(pickVariant(3, 1, () => 0.99)).toBe(2);
  });
});

describe('jitterRate', () => {
  it('stays within bounds', () => {
    expect(jitterRate(0.05, () => 0)).toBeCloseTo(0.95);
    expect(jitterRate(0.05, () => 1)).toBeCloseTo(1.05);
    expect(jitterRate(0, Math.random)).toBe(1);
  });
});
