import type { SoundDef } from '../model/types';
import { el } from './dom';
import { iconNode } from './icon';

/** A pictogram tile. Latching tiles stay lit while playing; others flash. */
export class SoundButton {
  readonly element: HTMLButtonElement;

  constructor(
    readonly sound: SoundDef,
    latching: boolean,
    onPress: (sound: SoundDef) => void,
  ) {
    this.element = el(
      'button',
      {
        class: 'tile',
        type: 'button',
        title: sound.label,
        'data-sound-id': sound.id,
        'aria-pressed': latching ? 'false' : undefined,
      },
      [el('span', { class: 'tile__icon', 'aria-hidden': 'true' }, [iconNode(sound.icon)]), el('span', { class: 'tile__label' }, [sound.label])],
    );
    this.element.addEventListener('click', () => onPress(sound));
  }

  setActive(active: boolean): void {
    this.element.classList.toggle('is-active', active);
    if (this.element.hasAttribute('aria-pressed')) this.element.setAttribute('aria-pressed', String(active));
  }

  /** Short visual feedback for one-shots (restarts on rapid clicks). */
  flash(): void {
    this.element.classList.remove('is-fired');
    void this.element.offsetWidth; // restart the CSS animation
    this.element.classList.add('is-fired');
  }
}
