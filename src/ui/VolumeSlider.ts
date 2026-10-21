import { gainToSlider, sliderToGain } from '../audio/fades';
import { el } from './dom';

/** A labelled range input that speaks in gain (0..1) with a natural curve. */
export function createVolumeSlider(label: string, initialGain: number, onChange: (gain: number) => void): HTMLElement {
  const input = el('input', {
    type: 'range',
    min: '0',
    max: '100',
    step: '1',
    value: String(Math.round(gainToSlider(initialGain) * 100)),
    'aria-label': `Volume ${label}`,
  });
  const readout = el('span', { class: 'volume__value' }, [`${input.value}`]);

  input.addEventListener('input', () => {
    readout.textContent = input.value;
    onChange(sliderToGain(Number(input.value) / 100));
  });

  return el('label', { class: 'volume' }, [el('span', { class: 'volume__icon', 'aria-hidden': 'true' }, ['🔉']), input, readout]);
}
