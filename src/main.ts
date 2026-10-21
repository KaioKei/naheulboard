import './style.css';
import { AudioEngine } from './audio/AudioEngine';
import { LibraryError, loadLibrary } from './library/loadLibrary';
import { App } from './ui/App';
import { el } from './ui/dom';

async function main(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) throw new Error('#app introuvable dans index.html');

  const base = import.meta.env.BASE_URL;

  try {
    const library = await loadLibrary(`${base}library.json`);
    const engine = new AudioEngine(`${base}sounds/`);
    const app = new App(root, library, engine);
    app.showMissingFiles(await engine.preload(library.sounds));
  } catch (error) {
    const lines = error instanceof LibraryError ? error.problems : [String(error)];
    root.replaceChildren(
      el('div', { class: 'fatal' }, [
        el('h1', {}, ['Le soundboard a fait un échec critique 🎲']),
        el('ul', {}, lines.map((line) => el('li', {}, [line]))),
      ]),
    );
    console.error(error);
  }
}

void main();
