import './mj/mj.css';
import './style.css';
import './maps/maps.css';
import { AudioEngine } from './audio/AudioEngine';
import { LibraryError, loadLibrary } from './library/loadLibrary';
import { AtlasError, loadAtlas } from './maps/loadAtlas';
import { MapsView } from './maps/MapsView';
import { mountMjScreen } from './mj/mjScreen';
import { App } from './ui/App';
import { el } from './ui/dom';

/**
 * Three parts sharing one page:
 *  - the GM screen (characters, triggers, journal, backup);
 *  - the soundboard, in the Musique tab;
 *  - the maps, in the Cartes tab.
 * They do not talk to each other; the shell and its tabs live in index.html.
 * One failing must not take the others down, hence one try/catch each.
 */
function main(): void {
  try {
    mountMjScreen();
  } catch (error) {
    reportFatal(
      document.querySelector('#v-persos'),
      "L'écran du MJ n'a pas pu démarrer 🎲",
      [String(error)],
    );
    console.error(error);
  }

  void mountSoundboard();
  void mountMaps();
}

async function mountSoundboard(): Promise<void> {
  const view = document.querySelector<HTMLElement>('#v-musique');
  const audioBar = document.querySelector<HTMLElement>('#audio-bar');
  if (!view || !audioBar) throw new Error('#v-musique ou #audio-bar introuvable dans index.html');

  const base = import.meta.env.BASE_URL;

  try {
    const library = await loadLibrary(`${base}library.json`);
    const engine = new AudioEngine(`${base}sounds/`);
    const app = new App(view, audioBar, library, engine);
    app.showMissingFiles(await engine.preload(library.sounds));
  } catch (error) {
    const lines = error instanceof LibraryError ? error.problems : [String(error)];
    reportFatal(view, 'Le soundboard a fait un échec critique 🎲', lines);
    console.error(error);
  }
}

async function mountMaps(): Promise<void> {
  const view = document.querySelector<HTMLElement>('#v-cartes');
  if (!view) throw new Error('#v-cartes introuvable dans index.html');

  const base = `${import.meta.env.BASE_URL}maps/`;

  try {
    new MapsView(view, await loadAtlas(`${base}maps.json`), base);
  } catch (error) {
    const lines = error instanceof AtlasError ? error.problems : [String(error)];
    reportFatal(view, 'Les cartes ne se sont pas dépliées 🎲', lines);
    console.error(error);
  }
}

/** Shows the problem inside the tab that failed, leaving the rest of the page alone. */
function reportFatal(target: Element | null, title: string, lines: string[]): void {
  target?.replaceChildren(
    el('div', { class: 'fatal' }, [
      el('h1', {}, [title]),
      el('ul', {}, lines.map((line) => el('li', {}, [line]))),
    ]),
  );
}

main();
