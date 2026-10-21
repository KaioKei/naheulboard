import type { AudioEngine } from '../audio/AudioEngine';
import { CHANNELS, type Library } from '../model/types';
import { ChannelStrip } from './ChannelStrip';
import { el } from './dom';
import type { SoundButton } from './SoundButton';
import { createVolumeSlider } from './VolumeSlider';

/** Builds the whole board and keeps tiles in sync with what is playing. */
export class App {
  private readonly buttons = new Map<string, SoundButton>();
  private readonly notices: HTMLElement;

  constructor(root: HTMLElement, library: Library, engine: AudioEngine) {
    const strips = CHANNELS.map(
      (channel) =>
        new ChannelStrip(
          channel,
          library.sounds.filter((s) => s.channel === channel),
          engine,
        ),
    );
    for (const sound of library.sounds) {
      const button = strips.map((s) => s.button(sound.id)).find(Boolean);
      if (button) this.buttons.set(sound.id, button);
    }

    const panic = el('button', { class: 'panic', type: 'button', title: 'Coupe tout en fondu (1 s)' }, ['🤫 Tout couper']);
    panic.addEventListener('click', () => engine.stopAll());

    this.notices = el('div', { class: 'notices', role: 'status' });

    root.replaceChildren(
      el('header', { class: 'topbar' }, [
        el('div', { class: 'brand' }, [
          el('h1', {}, ['Naheulboard']),
          el('p', {}, ['Le soundboard du Maître du Jeu']),
        ]),
        el('div', { class: 'topbar__controls' }, [
          createVolumeSlider('général', engine.getVolume('master'), (gain) => engine.setVolume('master', gain)),
          panic,
        ]),
      ]),
      this.notices,
      el('main', { class: 'board' }, strips.map((s) => s.element)),
    );

    engine.events.on((event) => {
      const button = this.buttons.get(event.soundId);
      if (!button) return;
      if (event.type === 'fired') button.flash();
      else button.setActive(event.type === 'started');
    });
  }

  /** Lists files that failed to load, without blocking the rest of the board. */
  showMissingFiles(files: string[]): void {
    if (files.length === 0) return;
    this.notices.append(
      el('p', { class: 'notice' }, [`⚠️ Fichiers introuvables ou illisibles dans public/sounds/ : ${files.join(', ')}`]),
    );
  }
}
