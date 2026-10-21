import type { Ducker } from '../Ducker';
import type { PlayerEnv } from './ChannelPlayer';
import { OneShotPlayer } from './OneShotPlayer';

/**
 * Son: comic stingers (sad trombone, level-up jingle...).
 * Same as a one-shot, without pitch variation, and the music bus is
 * ducked while any stinger plays so the gag is clearly heard.
 */
export class StingerPlayer extends OneShotPlayer {
  constructor(env: PlayerEnv, ducker: Ducker) {
    super(env, {
      pitchJitter: 0,
      onVoiceStart: () => ducker.engage(),
      onVoiceEnd: () => ducker.release(),
    });
  }
}
