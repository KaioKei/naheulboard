/**
 * Domain model of the Cartes tab. Pure data, no DOM code here.
 *
 * Everything comes from public/maps/maps.json, which the GM edits by hand:
 * see public/maps/README.md. Field names are French, like the GM screen's own
 * data files (src/mj/data/*.json), because that is what gets typed by hand.
 */

/** The shapes a clickable zone can take. Order here = order in the doc. */
export const FORMES = ['rect', 'poly', 'circle'] as const;
export type Forme = (typeof FORMES)[number];

export function isForme(value: unknown): value is Forme {
  return typeof value === 'string' && (FORMES as readonly string[]).includes(value);
}

/** How many numbers each shape needs, and what they mean. */
export const COORDS_ATTENDUES: Record<Forme, string> = {
  rect: 'x1, y1, x2, y2 (deux coins opposés)',
  poly: 'x1, y1, x2, y2, … (au moins 3 points, soit 6 nombres)',
  circle: 'cx, cy, r (centre et rayon)',
};

/**
 * A clickable region drawn over a map, opening another map.
 *
 * Coordinates are percentages of the image (0 = left/top, 100 = right/bottom),
 * so they stay valid whatever the screen size or the file's resolution.
 */
export interface Zone {
  /** Id of the map this zone opens. */
  cible: string;
  /** Name shown on hover and when every zone is revealed. */
  nom: string;
  forme: Forme;
  /** Percentages, 0..100. Meaning depends on `forme` (see COORDS_ATTENDUES). */
  coords: number[];
}

/** One map: an image file plus the zones drawn over it. */
export interface Carte {
  /** Unique, stable identifier (kebab-case). Referenced by zones and by `defaut`. */
  id: string;
  /** Name shown in the menu and the breadcrumb. */
  nom: string;
  /** Path relative to public/maps/, e.g. "valtordu/chateau_valtordu_rdc.png". */
  fichier: string;
  /** Heading this map is filed under in the menu. Empty string = no heading. */
  groupe: string;
  /**
   * Id of the map this one is filed under in the menu, for a map that belongs
   * to a branch without being the target of a zone — another floor of the same
   * building, say. Empty string = worked out from the zones instead.
   */
  parent: string;
  /** Free text, searched along with the name. Never displayed. */
  mots: string;
  zones: Zone[];
}

export interface Atlas {
  /** Id of the map opened when the tab is first shown. */
  defaut: string;
  cartes: Carte[];
}
