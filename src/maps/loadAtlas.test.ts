import { describe, expect, it } from 'vitest';
// Vite serves the raw file: the real config gets checked like any other input.
import configReel from '../../public/maps/maps.json?raw';
import { AtlasError, parseAtlas } from './loadAtlas';

const monde = { id: 'monde', nom: 'Le monde', fichier: 'monde.jpg' };
const fangh = { id: 'fangh', nom: 'Fangh', fichier: 'fangh.jpg' };
const zone = { cible: 'fangh', nom: 'Terre de Fangh', forme: 'rect', coords: [10, 10, 30, 30] };

describe('parseAtlas', () => {
  it('accepts a valid atlas and applies defaults', () => {
    const atlas = parseAtlas({ cartes: [{ ...monde, zones: [zone] }, fangh] });
    expect(atlas.defaut).toBe('monde');
    expect(atlas.cartes).toHaveLength(2);
    expect(atlas.cartes[0]?.zones[0]?.cible).toBe('fangh');
    expect(atlas.cartes[1]?.zones).toEqual([]);
    expect(atlas.cartes[1]?.groupe).toBe('');
  });

  it('reports every problem at once', () => {
    try {
      parseAtlas({
        defaut: 'nulle-part',
        cartes: [
          { ...monde, zones: [{ ...zone, cible: 'inconnue' }] },
          { ...monde, nom: '' },
          { id: 'sans-fichier', nom: 'Sans fichier' },
        ],
      });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(AtlasError);
      const problems = (e as AtlasError).problems;
      expect(problems.some((p) => p.includes('carte inconnue'))).toBe(true);
      expect(problems.some((p) => p.includes('nom'))).toBe(true);
      expect(problems.some((p) => p.includes('fichier'))).toBe(true);
      expect(problems.some((p) => p.includes('double'))).toBe(true);
      expect(problems.some((p) => p.includes('defaut'))).toBe(true);
    }
  });

  it('checks the number of coordinates against the shape', () => {
    const bad = (forme: string, coords: number[]): string[] => {
      try {
        parseAtlas({ cartes: [{ ...monde, zones: [{ ...zone, cible: 'monde', forme, coords }] }] });
        return [];
      } catch (e) {
        return (e as AtlasError).problems;
      }
    };
    expect(bad('rect', [1, 2, 3])).toHaveLength(1);
    expect(bad('circle', [1, 2])).toHaveLength(1);
    expect(bad('poly', [1, 2, 3, 4])).toHaveLength(1);
    expect(bad('poly', [1, 2, 3, 4, 5])).toHaveLength(1);
    expect(bad('poly', [1, 2, 3, 4, 5, 6])).toEqual([]);
    expect(bad('rect', [1, 2, 3, 'a' as unknown as number])).toHaveLength(1);
    expect(bad('triangle', [1, 2, 3, 4])).toHaveLength(1);
  });

  it('rejects coordinates that are not percentages', () => {
    expect(() =>
      parseAtlas({ cartes: [{ ...monde, zones: [{ ...zone, cible: 'monde', coords: [0, 0, 1280, 720] }] }] }),
    ).toThrow(AtlasError);
  });

  it('normalizes a rectangle given by any two opposite corners', () => {
    const atlas = parseAtlas({
      cartes: [{ ...monde, zones: [{ ...zone, cible: 'monde', coords: [30, 40, 10, 20] }] }],
    });
    expect(atlas.cartes[0]?.zones[0]?.coords).toEqual([10, 20, 30, 40]);
  });

  it('accepts an explicit parent, which needs no zone pointing at the map', () => {
    const atlas = parseAtlas({
      cartes: [{ ...monde, zones: [] }, { ...fangh, parent: 'monde' }],
    });
    expect(atlas.cartes[1]?.parent).toBe('monde');
    expect(atlas.cartes[0]?.parent).toBe('');
  });

  it('rejects a parent that does not exist, or that loops', () => {
    const problems = (cartes: unknown[]): string[] => {
      try {
        parseAtlas({ defaut: 'monde', cartes });
        return [];
      } catch (e) {
        return (e as AtlasError).problems;
      }
    };
    expect(problems([monde, { ...fangh, parent: 'nulle-part' }])[0]).toContain('carte inconnue');
    expect(problems([monde, { ...fangh, parent: 'fangh' }])[0]).toContain('son propre parent');
    expect(problems([{ ...monde, parent: 'fangh' }, { ...fangh, parent: 'monde' }])[0]).toContain('circulaire');
  });

  it('accepts the atlas actually shipped in public/maps/maps.json', () => {
    const atlas = parseAtlas(JSON.parse(configReel));
    expect(atlas.cartes.length).toBeGreaterThan(0);
    expect(atlas.cartes.some((c) => c.id === atlas.defaut)).toBe(true);
    // Every zone of every map must point at a map that exists, or the GM
    // clicks a region and nothing happens.
    const ids = new Set(atlas.cartes.map((c) => c.id));
    for (const carte of atlas.cartes) {
      for (const zone of carte.zones) expect(ids.has(zone.cible)).toBe(true);
      if (carte.parent) expect(ids.has(carte.parent)).toBe(true);
    }
    // Exactly one map sits at the top of the menu: every other one is filed
    // under a zone target or an explicit parent, so none of them floats loose.
    const filed = new Set([
      ...atlas.cartes.flatMap((c) => c.zones.map((z) => z.cible)),
      ...atlas.cartes.filter((c) => c.parent).map((c) => c.id),
    ]);
    expect(atlas.cartes.filter((c) => !filed.has(c.id)).map((c) => c.id)).toEqual(['carte-monde']);
  });

  it('points at image files that really are in public/maps/', () => {
    // import.meta.glob lists them at build time: no fs, no node types needed.
    const fichiers = new Set(
      Object.keys(import.meta.glob('../../public/maps/**/*.{jpg,jpeg,png,webp,gif,svg}')).map((p) =>
        p.replace('../../public/maps/', ''),
      ),
    );
    for (const carte of parseAtlas(JSON.parse(configReel)).cartes) {
      expect(fichiers, `carte "${carte.id}"`).toContain(carte.fichier);
    }
  });

  it('refuses an atlas with no map at all', () => {
    expect(() => parseAtlas({ cartes: [] })).toThrow(AtlasError);
    expect(() => parseAtlas({ cartes: 'monde.jpg' })).toThrow(AtlasError);
    expect(() => parseAtlas([])).toThrow(AtlasError);
  });
});
