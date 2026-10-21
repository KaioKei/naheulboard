# Naheulbeuk GM Screen — Integration Context

> **Status: integrated.** The screen now lives in `src/mj/` (`mjScreen.js`, `mj.css`,
> `data/*.json`) and the soundboard is its `Musique` tab. The route taken is close to strategy
> **D** below, minus the TypeScript rewrite and the server persistence: the markup moved to
> `index.html`, the stylesheet and the script were kept as they were, the data constants became
> JSON files, and `localStorage` stayed the single source of truth. `src/mj/mjScreen.d.ts`
> states the contract, `context.md` the rules for working on it.
>
> Everything below still describes the ported code faithfully — the data model, the calculation
> rules, the migrations and the final verification checklist are unchanged.

This document describes the `ecran-mj-naheulbeuk.html` file and how to integrate it into a Node.js + TypeScript project that already serves a web page (a sound and music dashboard).

## At a Glance

- **Purpose:** A Game Master tool for the role-playing game *Le Donjon de Naheulbeuk*. It manages hero, NPC, and enemy character sheets during in-person sessions. Dice are not rolled in the tool: they are rolled physically.
- **Format:** A single, self-contained HTML file of approximately 350 KB, written in vanilla JavaScript ES2017+, with no framework, no build step, and no npm dependencies.
- **External resource:** Google Fonts only. If they fail to load, the tool falls back to system fonts and works normally.
- **Data:** Everything is stored in the browser's `localStorage`. There is no server, no API, and no network requests. Saving and restoring data are handled through JSON file export/import.
- **Language:** The entire interface is in French.

## File Structure

```
<!doctype html>
<head>
  <title>, <meta>, <link> Google Fonts
  <style>  ~25 Ko de CSS (tokens de couleur sur :root, thème clair/sombre via prefers-color-scheme)
</head>
<body>
  <div class="wrap">          header + tabs + 4 views (<section id="v-persos|v-trig|v-journal|v-backup">)
  <dialog id="dlg-hero">      detailed character sheet (internal tabs)
  <dialog id="dlg-effet">     add a temporary bonus/penalty
  <dialog id="dlg-create">    creation wizard (origin / attributes / profession)
  <dialog id="dlg-confirm">   deletion confirmation
  <div id="toast">            short messages
  <script>  data constants (~220 KB, see below), global variables
  <script>  application (~92 KB), entirely inside an IIFE: (function(){ ... })();
</body>
```

### Data Constants (first `<script>`, global scope)

| Constant | Size | Contents |
|---|---|---|
| `SEED` | 14 KB | Initial state: the 2 starting heroes (Tiny Parker, Julodion) |
| `RP_PATCH` | 7 KB | Tiny's role-playing data, applied once during migration |
| `JUL_PATCH` | 7 KB | Julodion's role-playing data, applied once during migration |
| `BESTIAIRE` | 102 KB | 299 creatures, taken from the official tables and the advanced bestiary |
| `EQUIP` | 66 KB | 151 weapons and 105 pieces of armor, with their bonuses and penalties already parsed |
| `LIVRET` | 25 KB | 21 origins, 6 beastman variants, 13 professions, skill glossary |

This data is static. For integration, it can be extracted as-is into `.json` files, served separately, or imported.

## Features (the 4 Tabs)

1. **Characters** (`#v-persos`), three sections:
  - **Heroes:** One card per hero, with EV and EA (−5/−1/+1/+5 buttons), a backpack weight gauge, modified attributes, destiny points, XP (+/−), temporary bonuses/penalties, and three collapsible sections: equipment, skills, and role-playing cues. The grid displays 4 columns above 1,080 px.
  - **Enemies:** Search `BESTIAIRE` with autocomplete, add N numbered copies, enter damage, set dead or downed status, track XP gained.
  - **NPCs:** Attitude, voice, motivation, secret, and optionally origin, attributes, and skills.
2. **Triggers** (`#v-trig`): Full-text search across heroes' profiles and role-playing hooks, plus an “had a spotlight moment” checkbox for each hero per session.
3. **Journal** (`#v-journal`): Notes for the current session, archived with their date.
4. **Backup** (`#v-backup`): JSON export and import, undo the last import, reset.

**The detailed character sheet** (`#dlg-hero`) has 5 tabs for a hero: Attributes, Skills, Equipment (with search in `EQUIP`), Role-playing, Notes. NPCs and enemies have a simpler sheet.

**The creation wizard** (`#dlg-create`) lets you choose an origin (`LIVRET`), enter rolled attributes (with validation against the criteria), then choose a profession and skills. It calculates EV, AT, PRD, EA, maximum carry weight, maximum PR, skills, and cues. It can also be used to add a profession to an existing character later.

## Data Model

### In-Memory State

```ts
S = {
  heros: Record<string, Perso>,       // heroes, NPCs, and enemies in the same dictionary
  etat: { notes: string, journal: {id, date, texte}[], spotlight: Record<persoId, boolean> },
  migrations: string[],               // migrations already applied
  lastExport: string | null, savedAt: string | null,
  // + UI state (view, openId, tab, q) not persisted
}
```

### Saved Format

`localStorage` key: `naheulbeuk-mj-v1`. The exported file has the same structure, with the addition of `exportedAt`.

```ts
{ app: 'ecran-mj-naheulbeuk', version: 12, migrations, savedAt, heros, etat, lastExport }
```

### `Perso`, Main Fields

All values are numbers unless otherwise specified.

```ts
type Perso = {
  id: string; kind: 'heros' | 'pnj' | 'ennemi'; ordre: number; nom: string;
  // base attributes (unmodified)
  cou, int, cha, ad, fo, at, prd, rm;
  ev, evMax, ea, eaMax;                 // vital / astral energy
  prNat, prMag;                         // PR without armor (worn armor's PR is added)
  effets: { id, nom, mods: Partial<Record<'cou'|'int'|'cha'|'ad'|'fo'|'at'|'prd'|'pr', number>>, note }[];
  // heroes (and NPCs created with the wizard)
  joueur?, origine?, origineId?, varianteId?, metier?, metierId?, niveau?, xp?, destin?, destinMax?, chargeMax?;
  or?, argent?, thritil?, berylium?;
  armes?: { equipe: boolean, nom, pi, bonus: string /* "AT +1, PRD −2" */, rup, note }[];
  protections?: { porte: boolean, nom, bonus: string, prNat, prMag, note, loc? }[];
  sac?: { objet, qte, poids /* kg per item */, note }[];
  competences?: { acquise: boolean, nom, source, carac, desc }[];
  reperes?: { texte: string }[];        // "keep in mind" cues, displayed on the card
  accroches?: { declencheur, source, reaction, mots }[];   // role-playing triggers
  pitch?, desir?, force?, faiblesse?, aime?, deteste?, tic?, secret?, background?, notes?;
  // NPCs
  role?, lieu?, attitude?: 'ami'|'neutre'|'louche'|'hostile', voix?, motivation?;
  // enemies
  type?, degats?: string, xpGain?, capacites?, butin?;
}
```

### Calculation Rules (must be preserved)

- **Displayed attribute** = `base(h,k) + mod(h,k)`, see the `val`, `base`, and `mod` functions.
- **Modifiers (`mod`)** = sum of `effets` + bonuses from weapons where `equipe !== false` + bonuses from armor where `porte !== false`. Equipment bonuses are text parsed by `parseMods()` (format `AT +1, PRD −2`, also supporting `AT/PRD −2`).
- **PR** = `prNat + prMag` + the PR of all worn armor (`armorPR`).
- **Backpack weight** = `Σ poids × qte` for the backpack contents only, compared against `chargeMax` (0 = no limit).

### Migrations

On loading, `load()` runs `migrate`, `migrateEquip`, `migratePoids`, and `migrateJul`. Each is idempotent thanks to `S.migrations` (`rp-v3`, `equip-v4`, `poids-v9`, `jul-v11`). Data already saved by users must remain readable: do not rename the `localStorage` key or rename fields without providing a migration.

### Other `localStorage` Keys

These are non-critical display preferences:

- `naheulbeuk-mj-v1-avant-import`: backup copy before import.
- `mj-view`: last opened tab.
- `mj-card-view`: sections displayed on the cards.

## How the Code Works

- **Rendering:** Template strings assigned to `innerHTML` (`renderPersos`, `renderTriggers`, `renderJournal`, `renderDialog`, `crRender`…). `renderAll()` redraws everything. User text always passes through `esc()` before insertion.
- **Events:** Global event delegation with **4 listeners on `document`** (`click`, `input`, `change`, `keydown`) and 1 on `window` (`storage`, for synchronization between tabs).
  - Clicks are routed according to the `data-act` attribute (≈40 actions: `view`, `ev`, `xp`, `hit`, `add`, `del`, `row-add`, `row-del`, `cr-create`…).
  - Character sheet fields use `data-field` or `data-list` / `data-i` / `data-k`.
- **Saving:** `save()` triggers `persist()` after 300 ms, which writes to `localStorage` and updates the “Saved” indicator.
- **Internal helpers:** `$` = `document.querySelector`, `n()` = safe numeric conversion, `norm()` = lowercase without accents, `rid()` = random ID. These are local to the IIFE.
- **No native `alert`, `confirm`, or `prompt`:** confirmations use double-click (`confirmClick`) or the `#dlg-confirm` dialog (`askConfirm`).

## Integration Considerations

1. **The CSS is global and unprefixed.** It targets `body`, `*`, `:root`, and generic classes (`.card`, `.btn`, `.grid`, `.panel`, `.toast`, `.stat`, `.wrap`, `dialog`…), so it will conflict with the dashboard's CSS if they share the same page.
2. **Event delegation is global.** Any dashboard element with a `data-act` attribute would be intercepted. The `input` and `change` listeners also react to specific IDs (`q`, `bq`, `cq`, `notes-seance`, `import-file`…).
3. **Global IDs.** There are many fixed `id` values (`v-persos`, `grid`, `toast`, `dlg-hero`, `q`, `bq`, `cr-*`, `f-*`, `l-*`…), which must be checked to avoid duplicates.
4. **The JS executes on page load** and assumes that the DOM described above already exists. There is no `init()` or `destroy()` function.
5. **Persistence is 100% browser-side.** If the Node server needs to store the data (for sharing between devices or backups), the only points that need replacing are `persist()`, `load()` at startup, `exportFile()`, and `importText()`. The JSON format returned by `snapshot()` can be used as-is for the request body.

## Possible Integration Strategies

Listed from simplest to most advanced.

- **A. Separate static page (recommended to start with).** Copy the file into the static folder (for example, `public/mj/index.html`) and serve it on its own route (`/mj`). The dashboard links to it through a link or tab. This requires no modifications and creates no conflicts.
- **B. `<iframe src="/mj/">` in the dashboard.** The CSS and JS remain isolated. A `postMessage` could later allow the two to communicate, for example, to play an ambient sound when combat begins.
- **C. Web Component with Shadow DOM.** Move the `<style>` and markup into the `shadowRoot` of an `<ecran-mj>`. You would then need to replace `document.querySelector` and the listeners on `document` with their `shadowRoot` equivalents.
- **D. TypeScript module.** Extract the constants into JSON and the script into a `.ts` file with a `mount(root: HTMLElement)` function, prefix the CSS (for example, `.mj-` or a `#ecran-mj` container), and connect persistence to a server API. This requires the most work, because approximately 100 functions must be converted and the model above must be typed.

Regardless of the approach, you must:

- **keep the `naheulbeuk-mj-v1` key and the `snapshot()` format** so existing saves and exported files remain compatible;
- **verify after integration** that creating a hero with the wizard, adding an enemy from the bestiary, adding a weapon from the catalog, exporting and then importing, and reloading the page with existing data all work correctly.
