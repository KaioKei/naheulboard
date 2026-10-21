import type { AudioEngine } from '../audio/AudioEngine';
import { CHANNELS, type Library } from '../model/types';
import { ChannelStrip } from './ChannelStrip';
import { el } from './dom';
import type { SoundButton } from './SoundButton';
import { createVolumeSlider } from './VolumeSlider';

/**
 * The Musique tab: the three columns of pictograms, plus the master volume and
 * the panic button, both dropped into the top bar so they stay clickable from
 * any tab.
 */
export class App {
  private readonly buttons = new Map<string, SoundButton>();
  private readonly notices: HTMLElement;

  /**
   * @param view     the <section id="v-musique"> of index.html
   * @param audioBar the container for the sound controls in the top bar
   */
  constructor(view: HTMLElement, audioBar: HTMLElement, library: Library, engine: AudioEngine) {
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

    audioBar.replaceChildren(
      createVolumeSlider('général', engine.getVolume('master'), (gain) => engine.setVolume('master', gain)),
      panic,
    );

    view.replaceChildren(this.notices, el('div', { class: 'board' }, strips.map((s) => s.element)));

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
