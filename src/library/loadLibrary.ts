import { CHANNELS, isChannel, type Library, type Scene, type SoundDef } from '../model/types';

/** Thrown when library.json is malformed. Lists every problem at once. */
export class LibraryError extends Error {
  constructor(readonly problems: string[]) {
    super(`library.json invalide :\n- ${problems.join('\n- ')}`);
    this.name = 'LibraryError';
  }
}

/** Fetches and validates library.json. */
export async function loadLibrary(url: string): Promise<Library> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new LibraryError([`impossible de charger ${url} (HTTP ${response.status})`]);
  }
  let raw: unknown;
  try {
    raw = await response.json();
  } catch (e) {
    throw new LibraryError([`JSON mal formé : ${(e as Error).message}`]);
  }
  return parseLibrary(raw);
}

/**
 * Turns untrusted JSON into a typed Library, applying defaults.
 * Pure function: easy to unit-test.
 */
export function parseLibrary(raw: unknown): Library {
  const problems: string[] = [];
  const root = asRecord(raw);
  if (!root) throw new LibraryError(['la racine doit être un objet { "sounds": [...], "scenes": [...] }']);

  const sounds = parseSounds(root.sounds, problems);
  const scenes = parseScenes(root.scenes, sounds, problems);

  if (problems.length > 0) throw new LibraryError(problems);
  return { sounds, scenes };
}

function parseSounds(raw: unknown, problems: string[]): SoundDef[] {
  if (!Array.isArray(raw)) {
    problems.push('"sounds" doit être un tableau');
    return [];
  }
  const seen = new Set<string>();
  const sounds: SoundDef[] = [];

  raw.forEach((item, index) => {
    const where = `sounds[${index}]`;
    const o = asRecord(item);
    if (!o) {
      problems.push(`${where} doit être un objet`);
      return;
    }
    const id = requireString(o.id, `${where}.id`, problems);
    const label = requireString(o.label, `${where}.label`, problems);
    const icon = typeof o.icon === 'string' && o.icon.length > 0 ? o.icon : '🔊';

    if (!isChannel(o.channel)) {
      problems.push(`${where}.channel doit valoir ${CHANNELS.map((c) => `"${c}"`).join(', ')}`);
    }
    const files = Array.isArray(o.files) ? o.files.filter((f): f is string => typeof f === 'string' && f.length > 0) : [];
    if (files.length === 0) problems.push(`${where}.files doit contenir au moins un chemin de fichier`);

    let volume = 1;
    if (o.volume !== undefined) {
      if (typeof o.volume === 'number' && o.volume >= 0 && o.volume <= 1) volume = o.volume;
      else problems.push(`${where}.volume doit être un nombre entre 0 et 1`);
    }

    if (id) {
      if (seen.has(id)) problems.push(`id en double : "${id}"`);
      seen.add(id);
    }
    if (id && label && isChannel(o.channel) && files.length > 0) {
      sounds.push({ id, label, icon, channel: o.channel, files, volume });
    }
  });
  return sounds;
}

function parseScenes(raw: unknown, sounds: SoundDef[], problems: string[]): Scene[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    problems.push('"scenes" doit être un tableau');
    return [];
  }
  const byId = new Map(sounds.map((s) => [s.id, s]));
  const scenes: Scene[] = [];

  raw.forEach((item, index) => {
    const where = `scenes[${index}]`;
    const o = asRecord(item);
    if (!o) {
      problems.push(`${where} doit être un objet`);
      return;
    }
    const id = requireString(o.id, `${where}.id`, problems);
    const label = requireString(o.label, `${where}.label`, problems);
    const icon = typeof o.icon === 'string' && o.icon.length > 0 ? o.icon : '🗺️';

    const checkRef = (ref: unknown, field: string, allowed: string[]): ref is string => {
      if (typeof ref !== 'string') {
        problems.push(`${where}.${field} doit contenir des ids (texte)`);
        return false;
      }
      const sound = byId.get(ref);
      if (!sound) {
        problems.push(`${where}.${field} : son inconnu "${ref}"`);
        return false;
      }
      if (!allowed.includes(sound.channel)) {
        problems.push(`${where}.${field} : "${ref}" est un(e) ${sound.channel}, attendu ${allowed.join(' ou ')}`);
        return false;
      }
      return true;
    };

    let music: string | undefined;
    if (o.music !== undefined && checkRef(o.music, 'music', ['musique'])) music = o.music;
    const ambiances = asArray(o.ambiances).filter((r) => checkRef(r, 'ambiances', ['ambiance'])) as string[];
    const pinned = asArray(o.pinned).filter((r) => checkRef(r, 'pinned', ['son'])) as string[];

    if (id && label) scenes.push({ id, label, icon, music, ambiances, pinned });
  });
  return scenes;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function requireString(value: unknown, where: string, problems: string[]): string | undefined {
  if (typeof value === 'string' && value.trim().length > 0) return value;
  problems.push(`${where} est obligatoire (texte non vide)`);
  return undefined;
}
