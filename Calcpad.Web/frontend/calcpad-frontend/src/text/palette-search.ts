/**
 * Ranking palette actions for a command menu.
 *
 * The palette is 84 buttons in a grid, which is a fine reference and a poor
 * control: you scan it, look away from the caret, and reach for the mouse. A
 * menu you open at the caret and filter by typing needs the *right* few entries
 * first, which is what this ranks.
 *
 * Pure, so the ordering can be tested without a DOM.
 */

import type { PaletteAction } from './math-palette';

/** How well an action answers a query, before recency is taken into account. */
function matchScore(action: PaletteAction, query: string): number {
    if (query === '') return 1;
    const label = action.label.toLowerCase();
    const title = action.title.toLowerCase();
    const id = action.id.toLowerCase();
    const syntax = action.syntax.toLowerCase();

    // A glyph query is how people look for an operator they can see on screen.
    if (label === query) return 100;
    if (id === query) return 95;
    // `fn-sin` should answer `sin`: the id carries a group prefix, so the last
    // segment is the name. It must *equal* the query — matching a suffix would
    // rank `fn-asin` level with `fn-sin` for "sin", which is the wrong answer.
    if (id.split('-').pop() === query) return 90;
    if (title === query) return 85;
    if (label.startsWith(query)) return 70;
    if (title.startsWith(query)) return 60;
    // Word-start inside the title, so `root` finds "n-th root" and "Cube root".
    if (new RegExp(`\\b${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(title)) return 50;
    if (syntax.includes(query)) return 40;
    if (label.includes(query)) return 30;
    if (title.includes(query)) return 20;
    if (id.includes(query)) return 10;
    return 0;
}

/**
 * The actions matching `query`, best first.
 *
 * `recent` is the ids used most recently, newest first. With no query it *is* the
 * order, so the menu opens on what this author actually reaches for; with a query
 * it breaks ties, so two equally good matches put the familiar one first.
 */
export function rankPalette(
    actions: readonly PaletteAction[],
    query: string,
    recent: readonly string[] = [],
): PaletteAction[] {
    const term = query.trim().toLowerCase();
    const rank = new Map(recent.map((id, index) => [id, index]));

    if (term === '') {
        const used = recent
            .map(id => actions.find(action => action.id === id))
            .filter((action): action is PaletteAction => action !== undefined);
        const rest = actions.filter(action => !rank.has(action.id));
        return [...used, ...rest];
    }

    return actions
        .map(action => {
            const score = matchScore(action, term);
            if (score === 0) return null;
            // Recency is a tie-breaker worth less than any real match, so it can
            // never lift a weak match above a strong one.
            const bonus = rank.has(action.id) ? Math.max(0, 6 - rank.get(action.id)!) : 0;
            return { action, score: score + bonus };
        })
        .filter((entry): entry is { action: PaletteAction; score: number } => entry !== null)
        .sort((a, b) => b.score - a.score)
        .map(entry => entry.action);
}

/** Move `index` by `delta` through `length` items, wrapping at both ends. */
export function wrapIndex(index: number, delta: number, length: number): number {
    if (length <= 0) return 0;
    return ((index + delta) % length + length) % length;
}
