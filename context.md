# Naheulboard — project brief for Claude Code

## What this is

A soundboard for a **game master running tabletop RPG sessions in person**, built for
*Le Donjon de Naheulbeuk* (a French parody of Dungeons & Dragons, full of slapstick humour).
The GM sits at the table with 4 friends, a laptop plugged into a speaker, and clicks
pictograms to play music, ambiances, sound effects and comic stingers **that stack on top of each other**.

Typical layering:
- tavern ambiance + travelling-minstrel music + tankard slammed on a table
- dungeon ambiance + creepy music + skeleton rattle + sword slash

The owner is a **beginner GM and the person you are coding with**. They use IntelliJ with the
Claude plugin. Explain choices briefly in French when you talk to them; keep code and comments in English.

## Product principles (do not break these)

1. **Usable mid-game in one click.** No dialogs, no confirmation, no loading spinners on click.
   Every interaction must be possible while talking to players.
2. **Never clip, never click.** Every start/stop goes through a fade (`rampTo`). The master has a limiter.
3. **Music and ambiances stay under the voices.** Default volumes are low on purpose.
4. **Adding a sound never requires code.** Drop a file in `public/sounds/`, add an entry in
   `public/library.json`. Anything the GM configures lives in data, not in code.
5. **Works offline**, on a laptop, and later on a tablet. No backend, no account, no cloud.
6. **Small and readable.** No UI framework, no runtime dependency. Vanilla TypeScript + Web Audio API.
   Only add a dependency if it removes a real, demonstrated problem — ask first.

## Stack & commands

- TypeScript (strict) + Vite + Vitest. Node 20+.
- `npm run dev` — dev server on http://localhost:5173
- `npm run dev:lan` — same, reachable from a tablet on the local network
- `npm test` — unit tests (Vitest, node environment)
- `npm run typecheck` — `tsc --noEmit`
- `npm run build` — typecheck + production build into `dist/`
- `npm run sounds:placeholders` — regenerates the synthesized placeholder sounds

Before saying a task is done: `npm run typecheck && npm test && npm run build` must pass,
and you must have checked the behaviour in the browser (or explained precisely what to click to verify).

## The three channels (core domain)

| Channel (`Channel`) | Player class | Behaviour |
|---|---|---|
| `musique` | `MusicPlayer` | **Exclusive**: one track at a time, looping. Clicking another track **crossfades** (2.5 s). Clicking the playing one fades it out. Streamed from disk. |
| `ambiance` | `LoopPlayer` | **Stacking loops**: each tile toggles its own loop on/off with a 1.5 s fade. Streamed from disk. |
| `son` | `StingerPlayer` | Comic stingers (sad trombone on a critical failure, level-up jingle). One-shot, no pitch jitter, and **ducks the music bus** (to 30 %) while any stinger plays. |

Musique/ambiance tiles are *latching* (lit while playing). Son tiles *flash* on click.
A red "Tout couper" (panic) button fades everything out in 1 s.

## Architecture

```
public/
  library.json            ← the GM's catalogue (sounds + scenes), validated at load
  sounds/{musiques,ambiances,sons}/
scripts/
  generate-placeholder-sounds.mjs   ← pure-JS synthesis of demo WAVs
src/
  main.ts                 ← bootstrap: load library → create engine → render App → preload
  model/types.ts          ← domain types: Channel, SoundDef, Scene, Library (no logic)
  library/loadLibrary.ts  ← fetch + parseLibrary (pure, lists ALL problems at once, French messages)
  audio/                  ← NO DOM ACCESS except <audio> elements in voices.ts
    AudioEngine.ts        ← owns AudioContext, buses, players; the ONLY API the UI uses
    players/ChannelPlayer.ts ← ChannelPlayer interface, PlayerEnv, VoiceRegistry, VariantMemory
    players/{Music,Loop,OneShot,Stinger}Player.ts
    voices.ts             ← playBuffer (decoded, instant) / playStream (<audio>, long files)
    Ducker.ts, fades.ts, variants.ts, SampleLoader.ts, Emitter.ts
  ui/                     ← vanilla DOM, no audio logic
    App.ts, ChannelStrip.ts, SoundButton.ts, VolumeSlider.ts, channelMeta.ts, dom.ts
  style.css               ← all colours are CSS custom properties in :root
```

Audio graph:

```
voices ─▶ bus[musique] ─▶ duck stage ─┐
voices ─▶ bus[ambiance] ──────────────┼─▶ master ─▶ limiter ─▶ speakers
voices ─▶ bus[son] ───────────────────┘
```

### Layering rules
- `ui/` talks to audio **only** through `AudioEngine` (`trigger`, `setVolume`, `getVolume`, `stopAll`, `events`).
- `audio/` never imports from `ui/`. It reports state through `engine.events`
  (`started` / `stopped` / `fired`, keyed by sound id).
- `model/` imports nothing.
- New channel behaviour = a new class implementing `ChannelPlayer`, wired in the `AudioEngine` constructor.
- Pure logic (parsing, variant picking, future scene diffing, shortcut mapping…) goes in small pure functions with Vitest tests.
  Web Audio code is not unit-tested; keep it thin.

### Conventions
- UI text in **French** (the players and GM are French). Code, identifiers, comments in **English**.
- Sound ids are kebab-case and stable (scenes reference them).
- Gains are linear 0..1 in code; sliders use a squared curve (`sliderToGain`).
- Keep files small and single-purpose. Prefer composition; the only inheritance is `StingerPlayer extends OneShotPlayer`.
- Accessibility: tiles are real `<button>`s, latching tiles use `aria-pressed`, visible focus ring, `prefers-reduced-motion` respected.

## library.json schema

```jsonc
{
  "sounds": [
    {
      "id": "epee",                 // required, unique, kebab-case
      "label": "Coup d'épée",       // required, shown under the icon
      "icon": "⚔️",                 // optional emoji, default 🔊
      "channel": "son",             // required: musique | ambiance | son
      "files": ["sons/epee-1.wav", "sons/epee-2.wav"], // required, relative to public/sounds/
      "volume": 0.8                 // optional 0..1, default 1
    }
  ],
  "scenes": [                       // validated today, NOT yet used by the UI (see v0.3)
    {
      "id": "donjon", "label": "Le Donjon", "icon": "🏰",
      "music": "donjon-inquietant",           // id of a musique (optional)
      "ambiances": ["goutte-a-goutte"],       // ids of ambiances
      "pinned": ["epee", "squelette"]         // ids of sons
    }
  ]
}
```

## Current state: v0.1 (done)

- Library loading + validation with readable French error page.
- Engine with the 3 behaviours above, crossfade, fades, variants, pitch jitter, ducking, limiter.
- Per-channel volume + master volume, panic button.
- Board UI: 3 coloured strips, latching/flashing tiles, responsive down to phone width.
- Synthesized placeholder sounds (to be replaced by real recordings by the GM).
- Tests: `loadLibrary.test.ts`, `variants.test.ts`.

## Roadmap (do one version at a time, small commits, ask before starting the next)

### v0.2 — Comfort at the table
- **Persist volumes** (master + 4 buses) in `localStorage` (wrap in try/catch; app must work without it).
- **Keyboard shortcuts**, as a pure mapping function + a small `ui/keyboard.ts`:
  - `1`–`9`: the first 9 sons in display order (show the digit on the tile)
  - `Escape`: panic (stop all)
  - `M`: fade out the current music
  - Ignore keys while focus is in an input.
- Optional `"shortcut"` field per sound in library.json to override the default digit.

### v0.3 — Scenes (the GM's best weapon)
- A scene bar above the board, one button per scene from `library.json`.
- Clicking a scene: crossfade to its `music` (or fade out music if none), start its `ambiances`
  and **fade out the ambiances not listed**, move its `pinned` tiles to the front of their strips
  and highlight them. Active scene is visibly selected.
- Put the "what to start / what to stop" computation in a pure, tested function
  (e.g. `diffScene(currentlyPlaying, scene) → { start, stop }`), then add an engine method
  like `applyScene(...)` that uses the existing players. Do not bypass the players.

### v0.4 — Managing the library
- Search/filter box over all tiles; optional `tags` on sounds.
- Drag & drop audio files onto a strip to add them for the session, then an
  "Exporter library.json" button so the GM can save the new catalogue.
- Per-tile quick stop for loops (e.g. right-click / long-press).
- Option `"preload": true` on an ambiance to play it from a decoded buffer (gapless loop),
  since `<audio loop>` can leave a tiny gap with MP3.

### v0.5 — Packaging (only if the GM wants it)
- Either a PWA (offline cache of app + sounds) or a Tauri desktop app (double-click to launch).
- Optional: tablet as a remote control over the LAN.

## Known gotchas
- Browsers keep the `AudioContext` suspended until a user gesture: `engine.trigger` resumes it. Do not try to autoplay on load.
- The app must be served over HTTP (`npm run dev` / `npm run preview`); opening `index.html` with `file://` breaks `fetch`.
- `createMediaElementSource` can be called once per `<audio>` element: `playStream` creates a fresh element per playback and releases it after.
- Prefer OGG or WAV for ambiances (MP3 adds encoder padding → gap at the loop point).
- Real music files are the GM's business: never commit copyrighted audio; the repo only ships synthesized placeholders.
