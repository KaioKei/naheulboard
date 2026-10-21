import { el } from '../ui/dom';
import type { Atlas, Carte, Zone } from './types';

const KEY_CARTE = 'mj-carte';
const SVG_NS = 'http://www.w3.org/2000/svg';

/** Accent-insensitive, case-insensitive text, for the search box. */
function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Builds an SVG node the same way ui/dom's el() builds an HTML one. */
function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  props: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(props)) node.setAttribute(key, String(value));
  return node;
}

/** The point a zone's name is pinned to, in percentages of the image. */
function centre(zone: Zone): { x: number; y: number } {
  const c = zone.coords;
  if (zone.forme === 'circle') return { x: c[0] ?? 50, y: c[1] ?? 50 };
  if (zone.forme === 'rect') {
    return { x: ((c[0] ?? 0) + (c[2] ?? 0)) / 2, y: ((c[1] ?? 0) + (c[3] ?? 0)) / 2 };
  }
  let x = 0;
  let y = 0;
  for (let i = 0; i + 1 < c.length; i += 2) {
    x += c[i] ?? 0;
    y += c[i + 1] ?? 0;
  }
  const points = c.length / 2;
  return { x: x / points, y: y / points };
}

/**
 * The Cartes tab: a map on screen, a menu to jump between maps, a search box,
 * and clickable regions that open the map of the region you clicked.
 *
 * Everything it shows comes from public/maps/maps.json (see the README next to
 * it). The zone editor at the bottom of the tab produces the JSON to paste back
 * into that file, which is how new zones get their coordinates.
 */
export class MapsView {
  private readonly byId = new Map<string, Carte>();
  /** child id -> parent id, from the zones. Used by the breadcrumb and the menu tree. */
  private readonly parents = new Map<string, string>();
  private readonly enfants = new Map<string, Carte[]>();
  private readonly racines: Carte[] = [];

  private readonly recherche = el('input', {
    type: 'search',
    id: 'carte-q',
    class: 'carte-q',
    placeholder: 'Chercher une carte…',
    autocomplete: 'off',
    'aria-label': 'Chercher une carte',
  });
  private readonly menu = el('nav', { class: 'carte-liste', 'aria-label': 'Cartes' });
  private readonly fil = el('nav', { class: 'carte-fil', 'aria-label': 'Chemin' });
  private readonly img = el('img', { class: 'carte-img', alt: '' });
  private readonly calque = svg('svg', { class: 'carte-zones', viewBox: '0 0 100 100', preserveAspectRatio: 'none' });
  private readonly etiquettes = el('div', { class: 'carte-noms', 'aria-hidden': 'true' });
  private readonly frame = el('figure', { class: 'carte-frame' });
  private readonly souci = el('p', { class: 'carte-souci', role: 'status', hidden: 'hidden' });
  private readonly compte = el('span', { class: 'carte-compte' });
  private readonly boutonZones = el('button', {
    type: 'button',
    class: 'btn small',
    'aria-pressed': 'false',
    title: 'Montre toutes les zones cliquables (raccourci : maintenir Tab)',
  }, ['Zones']);
  private readonly boutonEdit = el('button', {
    type: 'button',
    class: 'btn small quiet',
    'aria-pressed': 'false',
    title: 'Relève les coordonnées à coller dans maps.json',
  }, ['Éditer les zones']);
  private readonly editeur = el('div', { class: 'carte-editeur', hidden: 'hidden' });
  private readonly sortie = el('textarea', {
    class: 'carte-sortie',
    rows: '3',
    readonly: 'readonly',
    spellcheck: 'false',
    'aria-label': 'Coordonnées à coller dans maps.json',
  });

  private courante: Carte | undefined;
  private tousAffiches = false;
  private edition = false;
  private points: number[] = [];
  private depart: { x: number; y: number } | undefined;
  private readonly apercu = svg('rect', { class: 'carte-apercu', x: 0, y: 0, width: 0, height: 0 });

  /**
   * @param view  the <section id="v-cartes"> of index.html
   * @param atlas the validated contents of public/maps/maps.json
   * @param base  URL prefix for the image files (public/maps/)
   */
  constructor(private readonly view: HTMLElement, atlas: Atlas, private readonly base: string) {
    for (const carte of atlas.cartes) this.byId.set(carte.id, carte);
    this.lierParents(atlas);
    this.monter();
    this.ouvrir(this.premiere(atlas.defaut), false);
  }

  /* ---------- Hierarchy ---------- */

  /**
   * Where each map sits in the menu. An explicit `parent` is taken first and
   * always wins: it files a map in a branch without making it the target of a
   * zone (the first floor of the château belongs with the ground floor, but is
   * not a region you click on a map). Failing that, a zone makes its target a
   * child of the map it is drawn on — first one wins, and a link that would
   * close a loop is ignored, since the menu and the breadcrumb need a tree.
   */
  private lierParents(atlas: Atlas): void {
    for (const carte of atlas.cartes) {
      if (carte.parent) this.parents.set(carte.id, carte.parent);
    }
    for (const carte of atlas.cartes) {
      for (const zone of carte.zones) {
        if (zone.cible === carte.id || this.parents.has(zone.cible)) continue;
        if (this.descendDe(carte.id, zone.cible)) continue;
        this.parents.set(zone.cible, carte.id);
      }
    }
    for (const carte of atlas.cartes) {
      const parent = this.parents.get(carte.id);
      if (parent === undefined) this.racines.push(carte);
      else this.enfants.set(parent, [...(this.enfants.get(parent) ?? []), carte]);
    }
  }

  /** True when `id` is `ancetre` or one of its descendants. */
  private descendDe(id: string, ancetre: string): boolean {
    const vus = new Set<string>();
    let cur: string | undefined = id;
    while (cur !== undefined && !vus.has(cur)) {
      if (cur === ancetre) return true;
      vus.add(cur);
      cur = this.parents.get(cur);
    }
    return false;
  }

  /** The breadcrumb trail, from the top-most map down to this one. */
  private chemin(carte: Carte): Carte[] {
    const trail: Carte[] = [carte];
    const vus = new Set<string>([carte.id]);
    let parent = this.parents.get(carte.id);
    while (parent !== undefined && !vus.has(parent)) {
      const c = this.byId.get(parent);
      if (!c) break;
      trail.unshift(c);
      vus.add(parent);
      parent = this.parents.get(parent);
    }
    return trail;
  }

  private premiere(defaut: string): Carte | undefined {
    let voulue: string | null = null;
    try {
      voulue = localStorage.getItem(KEY_CARTE);
    } catch {
      voulue = null;
    }
    return (voulue ? this.byId.get(voulue) : undefined) ?? this.byId.get(defaut) ?? this.racines[0];
  }

  /* ---------- Layout ---------- */

  private monter(): void {
    this.img.addEventListener('load', () => {
      this.souci.hidden = true;
      this.frame.classList.remove('charge');
    });
    this.img.addEventListener('error', () => {
      this.frame.classList.remove('charge');
      this.souci.hidden = false;
      this.souci.textContent = `⚠️ Fichier introuvable : public/maps/${this.courante?.fichier ?? ''}`;
    });

    this.calque.append(this.apercu);
    this.frame.append(this.img, this.calque, this.etiquettes);

    const outils = el('div', { class: 'carte-outils' }, [this.compte, this.boutonZones, this.boutonEdit]);
    const copier = el('button', { type: 'button', class: 'btn small' }, ['Copier']);
    const vider = el('button', { type: 'button', class: 'btn small quiet' }, ['Recommencer']);
    this.editeur.append(
      el('p', { class: 'hint' }, [
        'Glisse sur la carte pour un rectangle, ou clique plusieurs points pour un polygone. ' +
          'Colle le résultat dans la liste "zones" de la carte, dans public/maps/maps.json, puis remplace "cible".',
      ]),
      this.sortie,
      el('div', { class: 'carte-editeur-actions' }, [copier, vider]),
    );

    this.view.replaceChildren(
      el('div', { class: 'cartes' }, [
        el('aside', { class: 'carte-menu' }, [this.recherche, this.menu]),
        el('div', { class: 'carte-scene' }, [
          el('div', { class: 'carte-head' }, [this.fil, outils]),
          this.souci,
          // Above the map, not under it: a map fills the screen, and the
          // coordinates have to be readable the moment the drag ends.
          this.editeur,
          this.frame,
          el('p', { class: 'hint carte-aide' }, [
            'Clique une région encadrée pour ouvrir sa carte. Maintiens Tab pour voir toutes les régions cliquables.',
          ]),
        ]),
      ]),
    );

    this.recherche.addEventListener('input', () => this.renderMenu());
    this.recherche.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const premier = this.menu.querySelector<HTMLButtonElement>('button[data-carte]');
      premier?.click();
    });

    this.menu.addEventListener('click', (e) => {
      const b = (e.target as Element | null)?.closest<HTMLElement>('button[data-carte]');
      const carte = b?.dataset.carte !== undefined ? this.byId.get(b.dataset.carte) : undefined;
      if (carte) this.ouvrir(carte);
    });
    this.fil.addEventListener('click', (e) => {
      const b = (e.target as Element | null)?.closest<HTMLElement>('button[data-carte]');
      const carte = b?.dataset.carte !== undefined ? this.byId.get(b.dataset.carte) : undefined;
      if (carte) this.ouvrir(carte);
    });

    this.boutonZones.addEventListener('click', () => this.montrerZones(!this.tousAffiches));
    this.boutonEdit.addEventListener('click', () => this.modeEdition(!this.edition));
    copier.addEventListener('click', () => {
      this.sortie.select();
      void navigator.clipboard?.writeText(this.sortie.value).catch(() => {});
    });
    vider.addEventListener('click', () => {
      this.points = [];
      this.sortie.value = '';
    });

    this.calque.addEventListener('click', (e) => {
      if (this.edition) return;
      const forme = (e.target as Element | null)?.closest<Element>('[data-cible]');
      const cible = forme?.getAttribute('data-cible');
      const carte = cible ? this.byId.get(cible) : undefined;
      if (carte) this.ouvrir(carte);
    });
    this.calque.addEventListener('mouseover', (e) => this.survol(e, true));
    this.calque.addEventListener('mouseout', (e) => this.survol(e, false));

    this.frame.addEventListener('pointerdown', (e) => this.editerDebut(e));
    this.frame.addEventListener('pointermove', (e) => this.editerBouge(e));
    this.frame.addEventListener('pointerup', (e) => this.editerFin(e));

    // Holding Tab reveals every clickable region. Only while this tab is on
    // screen, and never while the keyboard is being used to walk the menu.
    window.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab' || !this.visible() || this.dansLeMenu()) return;
      e.preventDefault();
      if (!e.repeat) this.montrerZones(true, false);
    });
    window.addEventListener('keyup', (e) => {
      if (e.key === 'Tab' && this.tousAffiches && this.boutonZones.getAttribute('aria-pressed') === 'false') {
        this.montrerZones(false, false);
      }
    });
    // Alt-Tabbing away mid-press would otherwise leave every zone lit up.
    window.addEventListener('blur', () => {
      if (this.boutonZones.getAttribute('aria-pressed') === 'false') this.montrerZones(false, false);
    });
  }

  private visible(): boolean {
    return !this.view.hidden && !document.querySelector('dialog[open]');
  }

  private dansLeMenu(): boolean {
    const actif = document.activeElement;
    return actif instanceof Element && (this.menu.contains(actif) || actif === this.recherche);
  }

  /* ---------- Showing a map ---------- */

  /** Opens a map: swaps the image, redraws the zones, updates menu and breadcrumb. */
  ouvrir(carte: Carte | undefined, memoriser = true): void {
    if (!carte) return;
    this.courante = carte;
    this.frame.classList.add('charge');
    this.souci.hidden = true;
    this.img.src = this.base + carte.fichier;
    this.img.alt = `Carte : ${carte.nom}`;
    this.renderZones(carte);
    this.renderFil(carte);
    this.renderMenu();
    this.points = [];
    this.sortie.value = '';
    if (memoriser) {
      try {
        localStorage.setItem(KEY_CARTE, carte.id);
      } catch {
        /* navigation privée : tant pis, la carte par défaut reviendra */
      }
    }
  }

  private renderZones(carte: Carte): void {
    this.calque.replaceChildren(this.apercu);
    this.etiquettes.replaceChildren();

    carte.zones.forEach((zone, i) => {
      const cible = this.byId.get(zone.cible);
      const forme = this.formeDe(zone);
      forme.setAttribute('class', 'carte-zone');
      forme.setAttribute('data-cible', zone.cible);
      forme.setAttribute('data-i', String(i));
      forme.setAttribute('vector-effect', 'non-scaling-stroke');
      forme.setAttribute('role', 'link');
      forme.setAttribute('aria-label', `${zone.nom} — ouvrir ${cible?.nom ?? zone.cible}`);
      const titre = svg('title', {});
      titre.textContent = `${zone.nom} → ${cible?.nom ?? zone.cible}`;
      forme.append(titre);
      this.calque.append(forme);

      const { x, y } = centre(zone);
      this.etiquettes.append(
        el('span', { class: 'carte-nom', 'data-i': String(i), style: `left:${x}%;top:${y}%` }, [zone.nom]),
      );
    });

    this.compte.textContent = carte.zones.length
      ? `${carte.zones.length} région${carte.zones.length > 1 ? 's' : ''} cliquable${carte.zones.length > 1 ? 's' : ''}`
      : 'aucune région cliquable';
  }

  private formeDe(zone: Zone): SVGElement {
    const c = zone.coords;
    if (zone.forme === 'circle') {
      // The overlay is stretched to the image, so a circle shows as an ellipse
      // on a non-square map: the radius is a percentage of each axis.
      return svg('ellipse', { cx: c[0] ?? 0, cy: c[1] ?? 0, rx: c[2] ?? 0, ry: c[2] ?? 0 });
    }
    if (zone.forme === 'poly') {
      const pts: string[] = [];
      for (let i = 0; i + 1 < c.length; i += 2) pts.push(`${c[i]},${c[i + 1]}`);
      return svg('polygon', { points: pts.join(' ') });
    }
    const [x1 = 0, y1 = 0, x2 = 0, y2 = 0] = c;
    return svg('rect', { x: x1, y: y1, width: Math.max(0, x2 - x1), height: Math.max(0, y2 - y1) });
  }

  private renderFil(carte: Carte): void {
    const trail = this.chemin(carte);
    this.fil.replaceChildren(
      ...trail.flatMap((c, i) => {
        const dernier = i === trail.length - 1;
        const bouton = el(
          'button',
          {
            type: 'button',
            class: dernier ? 'carte-crumb actuel' : 'carte-crumb',
            'data-carte': c.id,
            ...(dernier ? { 'aria-current': 'page' } : {}),
          },
          [c.nom],
        );
        return i === 0 ? [bouton] : [el('span', { class: 'carte-sep', 'aria-hidden': 'true' }, ['›']), bouton];
      }),
    );
  }

  /* ---------- Menu and search ---------- */

  private renderMenu(): void {
    const q = norm(this.recherche.value.trim());
    this.menu.replaceChildren();

    if (q) {
      const trouvees = [...this.byId.values()].filter((c) =>
        norm(`${c.nom} ${c.groupe} ${c.mots}`).includes(q),
      );
      if (trouvees.length === 0) {
        this.menu.append(el('p', { class: 'hint' }, ['Aucune carte ne correspond.']));
        return;
      }
      this.menu.append(
        el('p', { class: 'carte-groupe' }, [`${trouvees.length} résultat${trouvees.length > 1 ? 's' : ''}`]),
        ...trouvees.map((c) =>
          this.entree(c, 0, this.chemin(c).slice(0, -1).map((p) => p.nom).join(' › ')),
        ),
      );
      return;
    }

    let groupe: string | undefined;
    for (const racine of this.racines) {
      if (racine.groupe && racine.groupe !== groupe) {
        groupe = racine.groupe;
        this.menu.append(el('p', { class: 'carte-groupe' }, [groupe]));
      }
      this.ajouterBranche(racine, 0);
    }
  }

  private ajouterBranche(carte: Carte, niveau: number): void {
    this.menu.append(this.entree(carte, niveau));
    for (const enfant of this.enfants.get(carte.id) ?? []) this.ajouterBranche(enfant, niveau + 1);
  }

  private entree(carte: Carte, niveau: number, sous = ''): HTMLElement {
    const actuel = carte.id === this.courante?.id;
    return el(
      'button',
      {
        type: 'button',
        class: actuel ? 'carte-entree actuelle' : 'carte-entree',
        'data-carte': carte.id,
        style: niveau ? `padding-left:${10 + niveau * 14}px` : '',
        ...(actuel ? { 'aria-current': 'true' } : {}),
      },
      sous ? [el('b', {}, [carte.nom]), el('small', {}, [sous])] : [el('b', {}, [carte.nom])],
    );
  }

  /* ---------- Hover and reveal ---------- */

  private survol(e: Event, dedans: boolean): void {
    const forme = (e.target as Element | null)?.closest<Element>('[data-i]');
    const i = forme?.getAttribute('data-i');
    if (i === null || i === undefined) return;
    forme?.classList.toggle('survol', dedans);
    this.etiquettes.querySelector(`.carte-nom[data-i="${i}"]`)?.classList.toggle('on', dedans);
  }

  /** Reveals every zone at once. `collant` tells the button apart from the Tab key. */
  private montrerZones(actif: boolean, collant = true): void {
    this.tousAffiches = actif;
    this.frame.classList.toggle('zones-on', actif);
    if (collant) this.boutonZones.setAttribute('aria-pressed', String(actif));
  }

  /* ---------- Zone editor ---------- */

  private modeEdition(actif: boolean): void {
    this.edition = actif;
    this.editeur.hidden = !actif;
    this.frame.classList.toggle('edition', actif);
    this.boutonEdit.setAttribute('aria-pressed', String(actif));
    this.points = [];
    this.sortie.value = '';
    if (actif) this.montrerZones(true);
  }

  /** Pointer position as percentages of the image, rounded to a tenth. */
  private pourcents(e: PointerEvent): { x: number; y: number } {
    const r = this.img.getBoundingClientRect();
    const clamp = (v: number): number => Math.round(Math.min(100, Math.max(0, v)) * 10) / 10;
    return { x: clamp(((e.clientX - r.left) / r.width) * 100), y: clamp(((e.clientY - r.top) / r.height) * 100) };
  }

  private editerDebut(e: PointerEvent): void {
    if (!this.edition || e.button !== 0) return;
    e.preventDefault();
    this.depart = this.pourcents(e);
    this.frame.setPointerCapture(e.pointerId);
  }

  private editerBouge(e: PointerEvent): void {
    if (!this.edition || !this.depart) return;
    const p = this.pourcents(e);
    this.apercu.setAttribute('x', String(Math.min(this.depart.x, p.x)));
    this.apercu.setAttribute('y', String(Math.min(this.depart.y, p.y)));
    this.apercu.setAttribute('width', String(Math.abs(p.x - this.depart.x)));
    this.apercu.setAttribute('height', String(Math.abs(p.y - this.depart.y)));
  }

  private editerFin(e: PointerEvent): void {
    if (!this.edition || !this.depart) return;
    const a = this.depart;
    const b = this.pourcents(e);
    this.depart = undefined;
    this.apercu.setAttribute('width', '0');
    this.apercu.setAttribute('height', '0');
    if (this.frame.hasPointerCapture(e.pointerId)) this.frame.releasePointerCapture(e.pointerId);

    const glisse = Math.abs(b.x - a.x) > 1 && Math.abs(b.y - a.y) > 1;
    if (glisse) {
      this.points = [];
      this.ecrireZone('rect', [Math.min(a.x, b.x), Math.min(a.y, b.y), Math.max(a.x, b.x), Math.max(a.y, b.y)]);
      return;
    }
    this.points.push(b.x, b.y);
    if (this.points.length >= 6) this.ecrireZone('poly', this.points);
    else this.sortie.value = `${this.points.length / 2} point(s) : clique encore (3 minimum pour un polygone).`;
  }

  private ecrireZone(forme: 'rect' | 'poly', coords: number[]): void {
    this.sortie.value = `{ "cible": "id-de-la-carte-a-ouvrir", "nom": "Nom de la région", "forme": "${forme}", "coords": [${coords.join(', ')}] }`;
  }
}
