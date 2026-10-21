# Maps — the **Cartes** tab

The Cartes tab shows one map at a time, with a menu on the left to jump between
them, a search box, and **clickable regions**: click the middle of the world map
and the Terre de Fangh map opens, click Valtordu on it and you land in the town.

Everything on that tab — which maps exist, which one opens first, and where the
clickable regions are — comes from **`maps.json`, in this folder**. It is a plain
text file you edit by hand; nothing is hard-coded and nothing needs rebuilding.
Save the file, reload the page, done.

```
public/maps/
├── maps.json                  ← the configuration (this is what you edit)
├── README.md                  ← this file
├── Carte-monde.jpg
├── terre-de-fangh.jpg
├── fangh-sudouest.jpg
└── valtordu/
    ├── EnvironsValtordu-2021.jpg
    ├── valtordu-plan-parchemin.jpg
    ├── chateau_valtordu_rdc.png
    └── chateau_valtordu_etage1.png
```

Sub-folders are free: put the files wherever you like under `public/maps/` and
spell the path out in `fichier`.

## Using the tab

|                    |                                                                                    |
|--------------------|------------------------------------------------------------------------------------|
| **Click a region** | opens the map of that region                                                       |
| **Hover a region** | outlines it and shows its name                                                     |
| **Hold `Tab`**     | reveals *every* clickable region of the map at once, with its name                 |
| **`Zones` button** | same thing, but it stays on — handy on a tablet, where there is no `Tab` key       |
| **Breadcrumb**     | `Le monde connu › Terre de Fangh › Fangh Sud-Ouest` — click any step to go back up |
| **Menu**           | every map, children indented under the map they are reached from                   |
| **Search box**     | matches the name, the group and the `mots` keywords; `Enter` opens the first hit   |

The tab reopens on the map you were last looking at. The very first time, it
opens the map named by `defaut`.

## The configuration file

```jsonc
{
  "defaut": "carte-monde",      // id of the map shown on the first visit
  "cartes": [                   // every map, in menu order
    {
      "id": "carte-monde",                   // unique, never shown, referenced by zones
      "nom": "Le monde connu",               // shown in the menu and the breadcrumb
      "fichier": "Carte-monde.jpg",          // path, relative to public/maps/
      "groupe": "Le monde",                  // heading in the menu (optional)
      "mots": "monde continent Syldérie",    // extra search keywords (optional)
      "zones": [                             // clickable regions (optional)
        {
          "cible": "terre-de-fangh",         // id of the map this region opens
          "nom": "Terre de Fangh",           // shown on hover
          "forme": "poly",
          "coords": [43, 30, 48, 27, 56, 27, 60, 31, 60, 38, 56, 42, 47, 41, 43, 36]
        }
      ]
    }
  ]
}
```

### Fields

| Field     | Required | What it does                                                                                                                                                               |
|-----------|----------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `defaut`  | no       | Id of the map opened on a first visit. Defaults to the first map in the list.                                                                                              |
| `id`      | **yes**  | Unique name, kebab-case. It is what `cible` and `defaut` point at. Never displayed, so changing it later means fixing every `cible` that used it.                          |
| `nom`     | **yes**  | What the GM reads in the menu, the breadcrumb and the search results.                                                                                                      |
| `fichier` | **yes**  | Path to the image, relative to `public/maps/`. `jpg`, `png`, `webp`, `gif`, `svg` — anything a browser shows. Case matters on Linux.                                       |
| `groupe`  | no       | Heading above this map in the menu. Only used for maps at the top of a tree (no zone and no `parent` files them anywhere). Maps sharing a heading must be next to each other in the file. |
| `parent`  | no       | Id of the map this one is filed under **in the menu**, for a map that belongs to a branch without being clickable on any map. See below.                                   |
| `mots`    | no       | Free text, searched along with `nom`, never displayed. This is where you put the names of places *on* the map so a search for "Noghall" finds the map Noghall is drawn on. |
| `zones`   | no       | The clickable regions. A map with none is simply a map you reach from the menu.                                                                                            |

### Zones

| Field    | What it does                                                             |
|----------|--------------------------------------------------------------------------|
| `cible`  | `id` of the map to open. It must exist, or the file is rejected on load. |
| `nom`    | Shown on hover and while `Tab` is held.                                  |
| `forme`  | `rect`, `poly` or `circle`. Defaults to `rect`.                          |
| `coords` | Numbers, see below.                                                      |

**Coordinates are percentages of the image**, `0` = left/top, `100` = right/bottom.
Not pixels — so they keep working on any screen size, and they survive you
re-exporting the same map at a different resolution.

| `forme`  | `coords`                                              | Example                            |
|----------|-------------------------------------------------------|------------------------------------|
| `rect`   | `x1, y1, x2, y2` — two opposite corners, in any order | `[5, 35, 46, 92]`                  |
| `poly`   | `x1, y1, x2, y2, …` — at least 3 points (6 numbers)   | `[43, 30, 48, 27, 56, 27, 60, 31]` |
| `circle` | `cx, cy, r` — centre and radius                       | `[20.5, 31.5, 4.5]`                |

> On a map that is not square, a `circle` shows as an ellipse: the radius is a
> percentage of *each* axis, so `r: 4` means 4 % of the width across and 4 % of
> the height down. Use `rect` or `poly` when the exact outline matters.

## Getting the coordinates: the zone editor

You do not have to count pixels. The tab has a tool for it:

1. Open the map you want to add a region **to**.
2. Click **Éditer les zones** (top right). Every existing region is revealed, and
   a panel appears above the map.
3. On the map:
   - **drag a rectangle** → you get a `rect` zone;
   - **or click 3 points or more** → you get a `poly` zone. Each click adds a
     point; the snippet appears from the third one on.
4. Click **Copier**, paste the snippet into the `zones` list of that map in
   `maps.json`, and replace `cible` and `nom` with the real values.
5. Save, reload the page, hold `Tab` to check the region landed where you meant.

**Recommencer** throws away the points you have clicked so far.

## Adding a map, start to finish

Say you draw a map of the Donjon de Naheulbeuk and want it reachable by clicking
the donjon on the Environs de Valtordu map.

1. **Drop the file in** — `public/maps/donjon-naheulbeuk.jpg`.

2. **Declare the map** in `maps.json`, inside `cartes` (anywhere in the list;
   the menu shows it under the map it is reached from, not in file order):

   ```json
   {
     "id": "donjon-naheulbeuk",
     "nom": "Donjon de Naheulbeuk",
     "fichier": "donjon-naheulbeuk.jpg",
     "groupe": "",
     "mots": "donjon Naheulbeuk niveau 1 Gzor statue Dlul",
     "zones": []
   }
   ```

   Reload: it is already in the menu and in the search.

3. **Make it clickable** — open *Environs de Valtordu*, click **Éditer les
   zones**, drag a rectangle over the donjon, copy, and paste the result into
   that map's `zones`, with `cible` set to the id you just created:

   ```json
   { "cible": "donjon-naheulbeuk", "nom": "Donjon de Naheulbeuk", "forme": "rect", "coords": [72.4, 51.8, 84.1, 62.3] }
   ```

4. **Reload.** The donjon is now clickable on the Environs map, the breadcrumb
   reads `… › Environs de Valtordu › Donjon de Naheulbeuk`, and the menu shows
   the new map indented under Environs de Valtordu.

> **A map nobody clicks.** Skip step 3 and give the map a `parent` instead —
> `"parent": "donjon-naheulbeuk"` for its second level, say. It shows up in the
> menu under that map, with no clickable region anywhere. Without either one, it
> lands at the top level of the menu, next to the world map.

## How the menu tree is worked out

The indentation in the menu, and the breadcrumb above the map, both follow the
same tree. A map gets its place in it in one of two ways.

**1. A zone files its target.** A zone makes the map it opens a child of the map
the zone is drawn on. Nothing else to declare: clicking the Château de Valtordu
on the town plan is what puts *Château — rez-de-chaussée* under *Valtordu (plan
de la ville)* in the menu.

**2. `parent` files a map by hand.** Some maps belong to a branch without being a
region you click: another floor of the same building, the back of a handout, a
variant of a map for a later chapter. Give those a `parent` and they sit in the
menu exactly where they belong, with no zone anywhere pointing at them:

```json
{
  "id": "valtordu-chateau-etage1",
  "nom": "Château — 1er étage",
  "fichier": "valtordu/chateau_valtordu_etage1.png",
  "parent": "valtordu-chateau-rdc",
  "mots": "Valtordu château étage bibliothèque"
}
```

That is how the château works here: the town plan has one clickable region, the
castle, which opens the ground floor — and the first floor is filed under the
ground floor by `parent`, reachable from the menu, with neither floor carrying
any zone of its own.

The rules, when both are in play:

- **`parent` always wins** over a zone pointing at the same map.
- A map with no `parent` and no zone pointing at it sits at the **top level**
  (here, only the world map does). Two tops means two separate trees in the
  menu, which is fine — and `groupe` puts a heading above each.
- If two maps both have a zone opening the same map, the first in the file wins.
- A zone that would close a loop is ignored *for the tree only*: the region
  still opens its map when clicked. So a staircase going back down works as a
  click without the two floors becoming each other's parent.
- A `parent` that loops, or that names a map that does not exist, is reported on
  load like any other mistake.

## When something is wrong

`maps.json` is validated on load, and **every** problem is reported at once — so
one reload is enough to fix a batch of typos. If it fails, the Cartes tab shows
the list of problems instead of a map; the rest of the app keeps working.

| Message                                         | What it means                                                                          |
|-------------------------------------------------|----------------------------------------------------------------------------------------|
| `cartes["x"].zones : carte inconnue "y"`        | a `cible` points at an `id` that does not exist — typo, or a map you forgot to declare |
| `id en double : "x"`                            | two maps share an `id`                                                                 |
| `cartes["x"].parent : carte inconnue "y"`       | a `parent` names an `id` that does not exist                                           |
| `cartes["x"].parent : chaîne … circulaire`      | the `parent` chain comes back to where it started                                      |
| `… .coords : 3 nombre(s) pour une forme "rect"` | wrong number of coordinates for that shape                                             |
| `… .coords : les valeurs sont des pourcentages` | you pasted pixels instead of percentages                                               |
| `"defaut" doit être l'id d'une carte déclarée`  | `defaut` points at nothing                                                             |
| `JSON mal formé : …`                            | a missing comma or quote — the position is in the message                              |

A path that points at no file is *not* caught on load (the browser only finds out
when it tries to show it): the tab then displays
`⚠️ Fichier introuvable : public/maps/…`. Check the spelling and the capitals.

`npm test` checks this file too: that it parses, that every `cible` exists, and
that every `fichier` is really on disk.

## Practical notes

- **File size.** These images are served as-is and the whole file is downloaded
  before anything shows. The world map here is 3.1 MB, which is fine on a laptop
  and slow on a phone over 4G. Around 2000 px wide is plenty for a screen; a
  `jpg` at quality 80, or a `webp`, keeps it under a megabyte.
- **Only the map on screen is downloaded**, so a big atlas costs nothing until
  you open the heavy map.
- **The regions are not secret.** Anyone can read `maps.json`. Do not use a zone
  name to hide a spoiler you would not want a curious player to find.
