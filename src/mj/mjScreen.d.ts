/**
 * Public contract of mjScreen.js (vanilla JavaScript ported from
 * ecran-mj-naheulbeuk_v12.html). The module owns its state: it reads and writes
 * localStorage ('naheulbeuk-mj-v1'), installs its delegated listeners on
 * `document`, and renders the #v-persos, #v-trig, #v-journal and #v-backup
 * sections that index.html already provides.
 */

/** Tab ids, in display order (one <section id="v-{id}"> each). */
export declare const MJ_VIEWS: readonly string[];

/**
 * Starts the GM screen. Call once, after the DOM has been parsed.
 * Does not render the Musique tab: the soundboard does (see src/ui/App.ts).
 */
export declare function mountMjScreen(): void;
