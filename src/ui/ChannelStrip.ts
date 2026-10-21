import type { AudioEngine } from '../audio/AudioEngine';
import type { Channel, SoundDef } from '../model/types';
import { CHANNEL_META } from './channelMeta';
import { el } from './dom';
import { SoundButton } from './SoundButton';
import { createVolumeSlider } from './VolumeSlider';

/** One column of the board: title, channel volume, and its tiles. */
export class ChannelStrip {
  readonly element: HTMLElement;
  private readonly buttons = new Map<string, SoundButton>();

  constructor(channel: Channel, sounds: SoundDef[], engine: AudioEngine) {
    const meta = CHANNEL_META[channel];

    const grid = el('div', { class: 'strip__grid' });
    for (const sound of sounds) {
      const button = new SoundButton(sound, meta.latching, (s) => engine.trigger(s));
      this.buttons.set(sound.id, button);
      grid.append(button.element);
    }
    if (sounds.length === 0) {
      grid.append(el('p', { class: 'strip__empty' }, ['Aucun son ici. Ajoutes-en dans public/library.json.']));
    }

    this.element = el('section', { class: 'strip', 'data-channel': channel }, [
      el('header', { class: 'strip__header' }, [
        el('h2', { class: 'strip__title' }, [el('span', { 'aria-hidden': 'true' }, [meta.icon]), ` ${meta.title}`]),
        el('p', { class: 'strip__hint' }, [meta.hint]),
        createVolumeSlider(meta.title, engine.getVolume(channel), (gain) => engine.setVolume(channel, gain)),
      ]),
      grid,
    ]);
  }

  button(soundId: string): SoundButton | undefined {
    return this.buttons.get(soundId);
  }
}
