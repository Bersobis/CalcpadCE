/**
 * A per-line editor model: the parsed tree, the Calcpad text it came from, and
 * the rendered MathML — cached so the live display never re-parses a line it has
 * already seen.
 *
 * The live display re-renders a row on every keystroke. Typing only changes the
 * *text* of the editing line, so the parse is the expensive part worth caching,
 * and the render is what has to be instant. Keeping both behind one lookup means
 * the component asks for "the model for this line" and gets a warm one back
 * whenever the line has not actually changed.
 *
 * This is deliberately not reactive and holds no DOM: it is a small memo table
 * with a matching render function, so it can be tested directly and used from
 * any host.
 */

import type { MathMlElement } from './ast';
import { checkGraphicallyEditable, calcpadLineToMathMl } from './calcpad';
import { serializeMathMl, serializeWithPaths } from './serialize';

/** A line's parsed tree and its rendered form. `root` is null when uneditable. */
export interface LineEditorModel {
    /** The exact text this model was built from. */
    source: string;
    /** The MathML root, or `null` when the line is not graphically editable. */
    root: MathMlElement | null;
    /** Why `root` is null, for the inline note. */
    reason?: string;
    /** MathML for display, with `data-path` tags the caret and hit-test read. */
    markup: string;
}

/**
 * Constructs the bridge declines outright, mirroring `UNSUPPORTED_CHARS` in
 * `calcpad.ts`. A line containing one of these is not a *prefix* problem — no
 * shorter prefix makes it renderable — so the partial typeset must not try.
 */
const UNSUPPORTED_CONSTRUCT = /['"[\]{}#$]/;

const cache = new Map<string, LineEditorModel>();/**
 * Bounded so a long editing session over a large worksheet cannot grow the table
 * without limit. The access order is insertion order, which is close enough to
 * LRU for a working set this small.
 */
const MAX_ENTRIES = 256;

/** Build a model for a line, without consulting or filling the cache. */
function build(source: string): LineEditorModel {
    const check = checkGraphicallyEditable(source);
    if (!check.root) {
        return { source, root: null, reason: check.reason, markup: '' };
    }
    return {
        source,
        root: check.root,
        markup: serializeWithPaths(check.root),
    };
}

function remember(source: string): LineEditorModel {
    const model = build(source);
    cache.set(source, model);
    if (cache.size > MAX_ENTRIES) {
        // Drop the oldest insertion, which is the entry that has gone longest
        // without being rebuilt.
        const oldest = cache.keys().next().value;
        if (oldest !== undefined) cache.delete(oldest);
    }
    return model;
}

/** The editor model for a line, from the cache when the text has not changed. */
export function lineEditorModel(source: string): LineEditorModel {
    return cache.get(source) ?? remember(source);
}

/** Forget every cached line. For tests; the app never needs it. */
export function clearLineEditorCache(): void {
    cache.clear();
}

/** Serialize a tree without path tags, for the plain (non-interactive) render. */
export function plainMarkup(root: MathMlElement): string {
    return serializeMathMl(root);
}

/**
 * Typeset a line that may be mid-keystroke, for the live preview only.
 *
 * A line being typed is routinely incomplete — `b/`, `x +`, `sin(` — and the
 * strict parser correctly refuses those, because they have no Calcpad meaning to
 * commit. But refusing them here would blank the row on the very keystrokes the
 * user is watching, which reads as the editor dropping the input.
 *
 * So the trailing operator or open structure is trimmed until the remainder
 * parses, and that remainder is typeset. This is a *display* helper only: the
 * committed text always goes through the strict gate, so nothing partial is ever
 * written back to the document.
 */
export function partialTypesetMarkup(source: string): string {
    const trimmed = source.trim();
    if (trimmed === '') return '';
    // A construct the bridge declines outright (`[`, `#`, a quote) is not
    // something a prefix can rescue, so bail rather than typesetting the text
    // before it and implying the line renders.
    if (UNSUPPORTED_CONSTRUCT.test(trimmed)) return '';
    // Walk back over trailing characters that leave the expression open, longest
    // suffix first, and typeset the first prefix that parses.
    for (let end = trimmed.length; end > 0; end--) {
        const candidate = trimmed.slice(0, end).replace(/[\s+\-*/\\⦼%^_=<>≤≥≠≡∧∨⊕(,;|]+$/u, '').trim();
        if (candidate === '') break;
        const parsed = calcpadLineToMathMl(candidate);
        if (parsed.root) return serializeWithPaths(parsed.root);
    }
    return '';
}
