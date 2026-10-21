# Naheulboard 🍺

The Game Master's screen for *Le Donjon de Naheulbeuk*: character sheets, role-playing triggers,
a campaign journal, the maps of the world and a soundboard, all in one page with tabs.

## Getting Started

Prerequisite: [Node.js](https://nodejs.org) 20 or later.

```sh
nvm install 22
nvm use 22
node -v
#>v22.23.3
```

```bash
npm install
npm run dev
```

Your browser opens at http://localhost:5173 on the **Personnages** tab, with Tiny and Julodion
already there. Switch to **Musique**, click “Taverne Tranquille,” then “Taverne Discussions”:
you've got your first tavern.

In IntelliJ (Ultimate) or WebStorm: *File → Open* this folder, then run the `dev` script from the npm tab.

## The 6 Tabs

| Tab              | What it does                                                                                                   |
|------------------|----------------------------------------------------------------------------------------------------------------|
| **Personnages**  | Heroes, enemies and NPCs. EV/EA gauges, backpack weight, bonuses and penalties, XP, destiny points, full sheets. |
| **Déclencheurs** | Full-text search over the heroes' profiles and role-playing hooks: “what does this scene offer my players?”      |
| **Journal**      | Notes for the current session, archived with their date.                                                        |
| **Musique**      | The soundboard: music, ambiances and comic sounds, all mixable simultaneously.                                  |
| **Cartes**       | The maps, from the world down to the floors of the château de Valtordu. Click a region to open its map.         |
| **Sauvegarde**   | The campaign's save file: save, save as, load, undo the last load, reset.                                       |

The master volume and the red **Tout couper** button sit in the top bar, so you can cut the sound
from any tab. The save indicator next to them tells you the campaign is written to this browser.

Everything is local: no server, no account, no network. The campaign lives in the browser's
`localStorage` (key `naheulbeuk-mj-v1`) — **save it to a file at the end of a session**, the
Sauvegarde tab nags you about it after a week.

### The save file

The current save file is the one you last loaded or saved to. **Sauvegarder** — one click, at the
top of the Personnages tab and in the Sauvegarde tab — overwrites it; **Enregistrer sous…** picks
another file, which then becomes the current one. The file format is unchanged (version 12).

Chrome and Edge really do overwrite the file (File System Access API; the handle is kept in
IndexedDB, so the file is still current after a reload — the browser asks once for permission).
Firefox and Safari have no such API: there, saving downloads a file under the remembered name and
says so, and you replace the old one yourself.

## Characters

* **Heroes:** “+ Ajouter un héros” opens the wizard from the official booklet: origin, rolled
  attributes (criteria are checked for you), profession, skills. It computes EV, AT, PRD, EA,
  maximum carry weight and maximum PR.
* **Enemies:** type a name in the bestiary field (299 creatures) and add N numbered copies, with
  their stats filled in. Damage, deaths and the XP they are worth are tracked for you.
* **NPCs:** attitude, voice, motivation, secret — enough to replay the innkeeper identically.
* Each sheet (“Ouvrir la fiche”) has 5 tabs: attributes, skills, equipment (with a 256-entry
  weapon and armour catalogue), role-playing, notes.

Dice are **not** rolled here: you roll them on the table.

## The 3 Types of Sounds

| Column         | Behavior                                                                                                             |
|----------------|------------------------------------------------------------------------------------------------------------------------|
| 🎵 Music       | Only one at a time, looping. Clicking another track crossfades between them. Clicking the same track again stops it. |
| 🌫️ Atmospheres | Loops that layer together. Each click toggles a sound on or off.                                                     |
| 🎺 Sounds      | Gags and jingles. The music automatically lowers in volume while they play.                                          |

The red **Cut All** button fades everything out over one second.

## Adding Your Own Sounds

1. Drop the file into the appropriate folder under `public/sounds/` (`musiques`, `ambiances`, or `sons`). Recommended formats: `.ogg` or `.mp3` for music, `.ogg` or `.wav` for atmospheres (seamless loops), any format for sounds.
2. Add an entry to `public/library.json`:

```json
{ "id": "rot-de-nain", "label": "Dwarf Burp", "icon": "🧔", "channel": "son", "files": ["sons/rot.ogg"], "volume": 0.8 }
```

3. Reload the page. If the JSON file contains an error, the Musique tab lists all the issues that need fixing — the rest of the screen keeps working.

### Icons

The `icon` field accepts either an emoji (as above) or a path to an SVG file:

1. Drop the `.svg` file into `public/icons/` (subfolders are fine, e.g. `public/icons/armes/epee.svg`).
2. Reference it by that relative path instead of an emoji:

```json
{ "id": "coup-epee", "label": "Sword Hit", "icon": "armes/epee.svg", "channel": "son", "files": ["sons/epee-1.wav"], "volume": 0.8 }
```

Any value ending in `.svg` is treated as a file; anything else is shown as-is (emoji or text). If `icon` is omitted, a default pictogram is used.

The provided sounds are **temporary placeholders**, generated by `npm run sounds:placeholders`. Replace them whenever you like.

Where to find royalty-free sounds: Tabletop Audio (RPG atmospheres), freesound.org (sound effects under Creative Commons; check each one's license), Pixabay sound effects, Kevin MacLeod's music (incompetech).

## Maps

The **Cartes** tab opens on the world map. Click the middle of it and the Terre de Fangh map
opens; click the south-west of Fangh and you get that region; click Valtordu and you walk into
the town, then the château, floor by floor. Hover a region to see its name, or hold `Tab` to
reveal every clickable region of the map at once.

Images live in `public/maps/`, and which maps exist, how they are nested and where the clickable
regions are all come from `public/maps/maps.json` — a hand-edited file, no rebuild needed. The tab
has a zone editor built in: drag a rectangle over a map and it hands you the JSON to paste.

**[`public/maps/README.md`](public/maps/README.md) explains the whole thing**: the fields, the
three region shapes, the editor, and a worked example of adding a map.

## Game Day

* `npm run dev` is all you need. Connect your laptop to a speaker and turn up the speaker's volume, not the sliders.
* To control it from a tablet on the same Wi-Fi network: run `npm run dev:lan`, then open the “Network” address displayed in the terminal on your tablet. Careful: the campaign is stored *per browser*, so the tablet starts from a fresh screen unless you import a backup file there.
* Production build: `npm run build` followed by `npm run preview`.

## Development

The full brief for Claude Code (architecture, rules, roadmap) is in [`context.md`](context.md). Claude Code reads it automatically when opening the project.

```bash
npm test           # unit tests
npm run typecheck  # TypeScript type checking
npm run build      # production build in dist/
```

Three parts share one page (see `src/main.ts`):

* `src/mj/mjScreen.js` — the GM screen, a 1:1 port of the standalone
  `ecran-mj-naheulbeuk_v12.html` tool. Deliberately kept in vanilla JavaScript; its public
  contract is `src/mj/mjScreen.d.ts`, its reference data `src/mj/data/*.json`, and
  [`ECRAN-MJ-CONTEXTE.md`](ECRAN-MJ-CONTEXTE.md) documents its model.
* `src/{audio,ui,library,model}/` — the soundboard, in strict TypeScript.
* `src/maps/` — the Cartes tab, in strict TypeScript. It reads `public/maps/maps.json`;
  [`public/maps/README.md`](public/maps/README.md) is the guide to that file.

`ecran-mj-naheulbeuk_v12.html` is still there, untouched: the original standalone version, kept as
a reference and a fallback. It reads and writes the same `localStorage` key and the same export
format (version 12), so you can switch between the two. Delete it whenever you feel like it.
