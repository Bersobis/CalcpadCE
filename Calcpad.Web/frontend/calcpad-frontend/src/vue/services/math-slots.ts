/**
 * Maps rendered maths back to the source it came from, one editable piece at a time.
 *
 * The live editor shows a line as the renderer typeset it, and the user edits the
 * typeset form directly: click a symbol in the radical and change it there, rather than
 * dropping to a source box beside the equation. That needs a link between a rendered
 * glyph and the source range that produced it, which the renderer does not publish, so
 * it is rebuilt here.
 *
 * The link is found by walking both sides in step. The source line is tokenized, and the
 * rendered markup is walked in document order collecting the pieces a reader would point
 * at — variables, exponents, function names, numbers and operators. Each token is then
 * matched to the next rendered piece that shows it. Structure carries no token of its
 * own (`sqrt`, `^`, `/` and the brackets that a fraction or a radical absorbs), so those
 * pieces simply stay unmatched and therefore non-editable.
 *
 * A line renders as `LHS = source form = substituted form = result`, so the first run of
 * matches lands on the source form — the only part the user wrote. Everything after it
 * is computed output: it is left unmatched, which is what keeps the result of a
 * calculation out of reach of the editing.
 *
 * Browser-only: it parses and rewrites DOM. The extension host never calls it.
 */

/** One piece of a source line, with the range it occupies and how it renders. */
export interface SourceToken {
    text: string;
    start: number;
    end: number;
    /** What the renderer shows for this token, or null when it renders as structure. */
    rendered: string | null;
}

/** A rendered piece that can be edited, and the source range behind it. */
export interface RenderSlot {
    /** Index into the token list from {@link tokenizeLine}. */
    token: number;
    start: number;
    end: number;
}

export interface SlotMap {
    /** The render markup with each editable piece wrapped in a `[data-ms-slot]` span. */
    html: string;
    slots: RenderSlot[];
}

/** How the source spells a glyph versus how the renderer draws it. */
const RENDERED_GLYPH: Record<string, string> = {
    '*': '·',
    '-': '−',
};

/**
 * Names the renderer draws as structure rather than as text: `sqrt(x)` becomes a radical
 * with the argument under its bar, so the name itself has no glyph to match.
 */
const STRUCTURAL_NAMES = new Set(['sqrt', 'cbrt', 'root']);

/** Names the renderer draws as a glyph rather than as the name. */
const RENDERED_NAMES: Record<string, string> = {
    pi: 'π',
    infinity: '∞',
};

/**
 * Operators that carry no glyph of their own: `^` becomes an exponent position, `/` a
 * fraction bar, and brackets are absorbed by whatever they delimit. Matching them would
 * only invite a false hit on some later glyph.
 */
const STRUCTURAL_OPERATORS = new Set(['^', '/', '(', ')', '[', ']', ';', '|', ',']);

const IDENT_START = /[A-Za-z_]/;
const IDENT_PART = /[A-Za-z0-9_]/;
const DIGIT = /[0-9]/;
const OPERATORS = new Set([
    '+', '-', '*', '/', '^', '=', '(', ')', '[', ']', ';', '|', ',', '<', '>', '!', '%', '&',
    '≤', '≥', '≠', '≡', '÷', '⦼', '∧', '∨', '⊕', '∠', '·', '−',
]);

/** Splits a source line into the pieces that can appear as a glyph in the render. */
export function tokenizeLine(text: string): SourceToken[] {
    const tokens: SourceToken[] = [];
    let i = 0;
    while (i < text.length) {
        const ch = text[i];

        // A comment runs to the end of the line and is never calculated, so it has no
        // rendered form to be edited through.
        if (ch === "'") break;

        if (ch === ' ' || ch === '\t') {
            ++i;
            continue;
        }

        if (IDENT_START.test(ch)) {
            const start = i;
            while (i < text.length && IDENT_PART.test(text[i])) ++i;
            const word = text.slice(start, i);
            tokens.push({ text: word, start, end: i, rendered: renderedFormForName(word) });
            continue;
        }

        if (DIGIT.test(ch)) {
            const start = i;
            while (i < text.length && (DIGIT.test(text[i]) || text[i] === '.')) ++i;
            tokens.push({ text: text.slice(start, i), start, end: i, rendered: text.slice(start, i) });
            continue;
        }

        if (OPERATORS.has(ch)) {
            tokens.push({ text: ch, start: i, end: i + 1, rendered: renderedFormForOperator(ch) });
            ++i;
            continue;
        }

        // Anything else — a directive sigil, a quote, a stray glyph — has no editable
        // form; skip it so the walk stays in step with the source.
        ++i;
    }
    return tokens;
}

function renderedFormForName(word: string): string | null {
    if (STRUCTURAL_NAMES.has(word.toLowerCase())) return null;
    return RENDERED_NAMES[word.toLowerCase()] ?? word;
}

function renderedFormForOperator(ch: string): string | null {
    if (STRUCTURAL_OPERATORS.has(ch)) return null;
    return RENDERED_GLYPH[ch] ?? ch;
}

/** A rendered piece: either a whole element or a run inside a text node. */
type Leaf =
    | { kind: 'element'; el: Element; text: string }
    | { kind: 'text'; node: Text; start: number; end: number; text: string };

/** Elements the renderer draws as pure structure: no glyph a user would edit. */
const STRUCTURAL_CLASSES = ['r', 'dvl'];

/** How many rendered pieces to look past before calling a token structure. */
const LOOKAHEAD = 4;

/**
 * Reads the rendered markup, finds every piece of it that shows something the source
 * says, and wraps those pieces so they can be clicked.
 *
 * Returns null when there is nothing to map — a comment line, a blank line, or a host
 * with no DOM (the extension host renders nothing itself).
 */
export function annotateSlots(renderedHtml: string, sourceText: string): SlotMap | null {
    if (typeof DOMParser === 'undefined' || renderedHtml.length === 0) return null;

    const doc = new DOMParser().parseFromString(`<div id="ms-root">${renderedHtml}</div>`, 'text/html');
    const root = doc.getElementById('ms-root');
    if (root == null) return null;

    const tokens = tokenizeLine(sourceText);
    if (tokens.length === 0) return null;

    const leaves = collectLeaves(root);
    if (leaves.length === 0) return null;

    const matches: Array<{ leaf: Leaf; token: number; start: number; end: number }> = [];
    let cursor = 0;

    for (let t = 0; t < tokens.length; ++t) {
        const token = tokens[t];
        if (token.rendered == null) continue;
        const found = findLeaf(leaves, cursor, token.rendered);
        if (found < 0) continue;
        cursor = found + 1;
        matches.push({ leaf: leaves[found], token: t, start: token.start, end: token.end });
    }

    if (matches.length === 0) return null;

    // A text node can carry several slots, and wrapping an earlier run would move the
    // offsets of the later ones, so the runs in each node are wrapped from its end
    // backwards. Wrapping never changes document order, so the pieces are still visited
    // in the order they were matched.
    const runs = matches.filter(m => m.leaf.kind === 'text');
    runs.sort((a, b) => {
        const an = (a.leaf as { node: Text }).node;
        const bn = (b.leaf as { node: Text }).node;
        if (an !== bn) return 0;
        return (b.leaf as { start: number }).start - (a.leaf as { start: number }).start;
    });

    const wrapped = new Map<number, Element>();
    for (const match of runs) {
        const leaf = match.leaf as { node: Text; start: number; end: number };
        const span = wrapTextRun(leaf.node, leaf.start, leaf.end);
        if (span != null) wrapped.set(match.token, span);
    }
    for (const match of matches) {
        if (match.leaf.kind !== 'element') continue;
        wrapped.set(match.token, wrapElement(match.leaf.el));
    }

    // Only the pieces that wrapped cleanly become slots, and they are numbered in
    // document order, which is the order the map is read back in.
    const slots: RenderSlot[] = [];
    for (const match of matches) {
        const el = wrapped.get(match.token);
        if (el == null) continue;
        el.setAttribute('data-ms-slot', String(slots.length));
        slots.push({ token: match.token, start: match.start, end: match.end });
    }
    if (slots.length === 0) return null;

    return { html: root.innerHTML, slots };
}

/** The next rendered piece at or after `from` that shows `text`. */
function findLeaf(leaves: Leaf[], from: number, text: string): number {
    const limit = Math.min(leaves.length, from + LOOKAHEAD);
    for (let i = from; i < limit; ++i) {
        if (leaves[i].text === text) return i;
    }
    return -1;
}

/**
 * The pieces of the render a reader would point at, in document order. Structure spans
 * are descended into so their contents are found; the radical glyph and the fraction bar
 * are skipped, since they stand for `sqrt` and `/` rather than for anything written.
 */
function collectLeaves(root: Element): Leaf[] {
    const leaves: Leaf[] = [];

    const visit = (node: Node): void => {
        for (const child of Array.from(node.childNodes)) {
            if (child.nodeType === 3) {
                pushTextRuns(child as Text, leaves);
                continue;
            }
            if (child.nodeType !== 1) continue;
            const el = child as Element;
            const tag = el.tagName.toLowerCase();

            if (tag === 'var' || tag === 'sup' || tag === 'sub') {
                pushElementLeaf(el, leaves);
                continue;
            }
            if (STRUCTURAL_CLASSES.some(cls => el.classList.contains(cls))) continue;
            // A `<b>` with no variable inside it is a function name — `sin`, `abs` — and
            // reads as one word. One wrapping a variable is just emphasis; descend.
            if (tag === 'b' && el.querySelector('var') == null) {
                pushElementLeaf(el, leaves);
                continue;
            }
            visit(el);
        }
    };

    visit(root);
    return leaves;
}

function pushElementLeaf(el: Element, leaves: Leaf[]): void {
    const text = (el.textContent ?? '').trim();
    if (text.length > 0) leaves.push({ kind: 'element', el, text });
}

const TEXT_RUN = /[A-Za-z_][A-Za-z0-9_]*|\d+(?:\.\d+)?|[^\s]/gu;

/** Splits a text node into the runs a reader would see as separate pieces. */
function pushTextRuns(node: Text, leaves: Leaf[]): void {
    const text = node.data;
    TEXT_RUN.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = TEXT_RUN.exec(text)) != null) {
        leaves.push({
            kind: 'text',
            node,
            start: match.index,
            end: match.index + match[0].length,
            text: match[0],
        });
    }
}

function wrapTextRun(node: Text, start: number, end: number): Element | null {
    const span = node.ownerDocument.createElement('span');
    const range = node.ownerDocument.createRange();
    range.setStart(node, start);
    range.setEnd(node, end);
    try {
        range.surroundContents(span);
        return span;
    } catch {
        // A run that straddles elements cannot be surrounded; leaving it unwrapped only
        // costs that one piece its editability.
        return null;
    }
}

function wrapElement(el: Element): Element {
    const span = el.ownerDocument.createElement('span');
    el.parentNode?.insertBefore(span, el);
    span.appendChild(el);
    return span;
}
