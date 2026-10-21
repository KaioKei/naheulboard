import {
  COORDS_ATTENDUES,
  FORMES,
  isForme,
  type Atlas,
  type Carte,
  type Forme,
  type Zone,
} from './types';

/**
 * Thrown when maps.json is malformed. Lists every problem at once, so one
 * reload is enough to fix a whole batch of typos.
 */
export class AtlasError extends Error {
  constructor(readonly problems: string[]) {
    super(`maps.json invalide :\n- ${problems.join('\n- ')}`);
    this.name = 'AtlasError';
  }
}

/** Fetches and validates public/maps/maps.json. */
export async function loadAtlas(url: string): Promise<Atlas> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new AtlasError([`impossible de charger ${url} (HTTP ${response.status})`]);
  }
  let raw: unknown;
  try {
    raw = await response.json();
  } catch (e) {
    throw new AtlasError([`JSON mal formé : ${(e as Error).message}`]);
  }
  return parseAtlas(raw);
}

/**
 * Turns untrusted JSON into a typed Atlas, applying defaults.
 * Pure function: easy to unit-test.
 */
export function parseAtlas(raw: unknown): Atlas {
  const problems: string[] = [];
  const root = asRecord(raw);
  if (!root) throw new AtlasError(['la racine doit être un objet { "defaut": "…", "cartes": [...] }']);

  const cartes = parseCartes(root.cartes, problems);
  const ids = new Set(cartes.map((c) => c.id));

  verifierParents(cartes, ids, problems);

  // Zones can only be checked once every map is known: they point at each other.
  for (const carte of cartes) {
    carte.zones = carte.zones.filter((zone) => {
      if (ids.has(zone.cible)) return true;
      problems.push(`cartes["${carte.id}"].zones : carte inconnue "${zone.cible}"`);
      return false;
    });
  }

  let defaut = '';
  if (root.defaut === undefined) {
    defaut = cartes[0]?.id ?? '';
  } else if (typeof root.defaut !== 'string' || !ids.has(root.defaut)) {
    problems.push(`"defaut" doit être l'id d'une carte déclarée (reçu : ${JSON.stringify(root.defaut)})`);
  } else {
    defaut = root.defaut;
  }

  if (cartes.length === 0) problems.push('"cartes" doit contenir au moins une carte');
  if (problems.length > 0) throw new AtlasError(problems);
  return { defaut, cartes };
}

/**
 * An explicit `parent` has to name a real map, and the chain of them has to end
 * somewhere: a map that is its own ancestor would hide its whole branch from
 * the menu.
 */
function verifierParents(cartes: Carte[], ids: Set<string>, problems: string[]): void {
  const parents = new Map<string, string>();
  for (const carte of cartes) {
    if (!carte.parent) continue;
    if (carte.parent === carte.id) {
      problems.push(`cartes["${carte.id}"].parent : une carte ne peut pas être son propre parent`);
      carte.parent = '';
    } else if (!ids.has(carte.parent)) {
      problems.push(`cartes["${carte.id}"].parent : carte inconnue "${carte.parent}"`);
      carte.parent = '';
    } else {
      parents.set(carte.id, carte.parent);
    }
  }
  for (const carte of cartes) {
    const vus = new Set<string>([carte.id]);
    let cur = parents.get(carte.id);
    while (cur !== undefined) {
      if (vus.has(cur)) {
        problems.push(`cartes["${carte.id}"].parent : chaîne de parents circulaire (${[...vus, cur].join(' → ')})`);
        carte.parent = '';
        break;
      }
      vus.add(cur);
      cur = parents.get(cur);
    }
  }
}

function parseCartes(raw: unknown, problems: string[]): Carte[] {
  if (!Array.isArray(raw)) {
    problems.push('"cartes" doit être un tableau');
    return [];
  }
  const seen = new Set<string>();
  const cartes: Carte[] = [];

  raw.forEach((item, index) => {
    const where = `cartes[${index}]`;
    const o = asRecord(item);
    if (!o) {
      problems.push(`${where} doit être un objet`);
      return;
    }
    const id = requireString(o.id, `${where}.id`, problems);
    const nom = requireString(o.nom, `${where}.nom`, problems);
    const fichier = requireString(o.fichier, `${where}.fichier`, problems);
    const groupe = typeof o.groupe === 'string' ? o.groupe : '';
    const parent = typeof o.parent === 'string' ? o.parent : '';
    const mots = typeof o.mots === 'string' ? o.mots : '';

    if (id) {
      if (seen.has(id)) problems.push(`id en double : "${id}"`);
      seen.add(id);
    }
    const zones = parseZones(o.zones, id ? `cartes["${id}"]` : where, problems);
    if (id && nom && fichier) cartes.push({ id, nom, fichier, groupe, parent, mots, zones });
  });
  return cartes;
}

function parseZones(raw: unknown, where: string, problems: string[]): Zone[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    problems.push(`${where}.zones doit être un tableau`);
    return [];
  }
  const zones: Zone[] = [];

  raw.forEach((item, index) => {
    const at = `${where}.zones[${index}]`;
    const o = asRecord(item);
    if (!o) {
      problems.push(`${at} doit être un objet`);
      return;
    }
    const cible = requireString(o.cible, `${at}.cible`, problems);
    const nom = requireString(o.nom, `${at}.nom`, problems);

    const forme: Forme = o.forme === undefined ? 'rect' : isForme(o.forme) ? o.forme : 'rect';
    if (o.forme !== undefined && !isForme(o.forme)) {
      problems.push(`${at}.forme doit valoir ${FORMES.map((f) => `"${f}"`).join(', ')}`);
      return;
    }
    const coords = parseCoords(o.coords, forme, at, problems);
    if (cible && nom && coords) zones.push({ cible, nom, forme, coords });
  });
  return zones;
}

function parseCoords(raw: unknown, forme: Forme, at: string, problems: string[]): number[] | undefined {
  if (!Array.isArray(raw) || raw.some((v) => typeof v !== 'number' || !Number.isFinite(v))) {
    problems.push(`${at}.coords doit être un tableau de nombres : ${COORDS_ATTENDUES[forme]}`);
    return undefined;
  }
  const coords = raw as number[];
  const ok =
    forme === 'rect' ? coords.length === 4 : forme === 'circle' ? coords.length === 3 : coords.length >= 6 && coords.length % 2 === 0;
  if (!ok) {
    problems.push(`${at}.coords : ${coords.length} nombre(s) pour une forme "${forme}", attendu ${COORDS_ATTENDUES[forme]}`);
    return undefined;
  }
  if (coords.some((v) => v < -50 || v > 150)) {
    problems.push(`${at}.coords : les valeurs sont des pourcentages de l'image, entre 0 et 100`);
    return undefined;
  }
  // A rectangle given corner-wise in any order still has to come out normalized.
  if (forme === 'rect') {
    const [x1 = 0, y1 = 0, x2 = 0, y2 = 0] = coords;
    return [Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2)];
  }
  return coords;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function requireString(value: unknown, where: string, problems: string[]): string | undefined {
  if (typeof value === 'string' && value.trim().length > 0) return value;
  problems.push(`${where} est obligatoire (texte non vide)`);
  return undefined;
}
