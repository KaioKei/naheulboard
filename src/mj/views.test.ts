import { describe, expect, it } from 'vitest';
// Vite serves the raw file: no fs, no node types needed.
import html from '../../index.html?raw';
import { MJ_VIEWS } from './mjScreen';

/**
 * The shell lives in index.html, the tab switching in mjScreen.js: nothing
 * fails loudly if the two drift apart — a tab button would simply stop
 * showing anything. These checks keep the contract honest.
 */
describe('shell tabs', () => {
  it('has one section per view', () => {
    for (const view of MJ_VIEWS) expect(html).toContain(`id="v-${view}"`);
  });

  it('has one tab button per view, in the same order', () => {
    const buttons = [...html.matchAll(/data-act="view" data-v="([a-z]+)"/g)].map((m) => m[1]);
    expect(buttons).toEqual([...MJ_VIEWS]);
  });

  it('keeps the containers the soundboard fills', () => {
    expect(html).toContain('id="v-musique"');
    expect(html).toContain('id="audio-bar"');
  });
});
