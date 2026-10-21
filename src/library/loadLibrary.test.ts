import { describe, expect, it } from 'vitest';
import { LibraryError, parseLibrary } from './loadLibrary';

const validSound = { id: 'epee', label: 'Épée', icon: '⚔️', channel: 'son', files: ['sons/epee-1.wav'] };

describe('parseLibrary', () => {
  it('accepts a valid library and applies defaults', () => {
    const lib = parseLibrary({ sounds: [validSound] });
    expect(lib.sounds).toHaveLength(1);
    expect(lib.sounds[0]?.volume).toBe(1);
    expect(lib.scenes).toEqual([]);
  });

  it('reports every problem at once', () => {
    try {
      parseLibrary({
        sounds: [
          { ...validSound, channel: 'fanfare' },
          { ...validSound, files: [] },
          { ...validSound, volume: 3 },
        ],
      });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(LibraryError);
      const problems = (e as LibraryError).problems;
      expect(problems.some((p) => p.includes('channel'))).toBe(true);
      expect(problems.some((p) => p.includes('files'))).toBe(true);
      expect(problems.some((p) => p.includes('volume'))).toBe(true);
      expect(problems.some((p) => p.includes('double'))).toBe(true);
    }
  });

  it('checks that scenes reference existing sounds of the right channel', () => {
    expect(() =>
      parseLibrary({
        sounds: [validSound],
        scenes: [{ id: 'donjon', label: 'Donjon', music: 'epee', ambiances: ['inconnu'] }],
      }),
    ).toThrow(LibraryError);
  });
});
