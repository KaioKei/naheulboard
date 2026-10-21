import type { Channel } from '../model/types';

/** Display texts per channel. UI only: the audio layer never reads this. */
export const CHANNEL_META: Record<Channel, { title: string; icon: string; hint: string; latching: boolean }> = {
  musique: {
    title: 'Musiques',
    icon: '🎵',
    hint: 'Une seule à la fois, fondu enchaîné',
    latching: true,
  },
  ambiance: {
    title: 'Ambiances',
    icon: '🌫️',
    hint: 'Boucles cumulables, clic pour allumer ou éteindre',
    latching: true,
  },
  son: {
    title: 'Sons',
    icon: '🎺',
    hint: 'Gags : la musique baisse le temps de les entendre',
    latching: false,
  },
};
