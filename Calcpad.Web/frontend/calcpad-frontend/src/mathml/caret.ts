/**
 * The editor's caret, selection and structural editing model.
 *
 * Everything here is a pure function over the MathML AST: give it a tree and a
 * caret, get back a new tree and a new caret. That is what makes the interaction
 * testable without a browser, and it is why the Vue component can stay a thin
 * layer of rendering and event wiring.
 *
 * A caret is one of two things:
 *
 * - `char` — a position between characters inside a leaf (`mi`/`mn`/`mo`/`mtext`).
 * - `gap`   — a position between the children of an element, which is the only way
 *             to sit inside an empty slot such as a fraction's denominator.
 *
 * Navigation walks a single canonical sequence of anchors in document order, so
 * Left/Right move through the expression exactly as they would through text —
 * including into and out of fractions, roots and exponents.
 */

import type { MathMlElement, MathMlNode } from './ast';
import { cloneNode, el, elementAt, isElement, isToken, nodeAt, tokenText, txt, SLOT_NAMES } from './ast';

export type Anchor =
    | { kind: 'char'; path: number[]; offset: number }
    | { kind: 'gap'; path: number[]; index: number };

/** A selection is two anchors; `focus` is where the caret is drawn. */
export interface EditorSelection {
    anchor: Anchor;
    focus: Anchor;
}

export interface EditResult {
    root: MathMlElement;
    anchor: Anchor;
    /** How many canonical positions the edit consumed — drives selection deletion. */
    removed: number;
}

/** The structures the editor can build from the operand before the caret. */
export type StructureKind = 'fraction' | 'power' | 'subscript' | 'sqrt' | 'root' | 'cbrt';

/** Brackets the editor writes as a matched pair, and which Calcpad rejects empty. */
const OPEN_BRACKETS = new Set(['(', '[', '{']);
const CLOSE_BRACKETS = new Set([')', ']', '}']);

/** True for an unfilled `()` — two bracket tokens with nothing between them. */
function hasEmptyBracketPair(node: MathMlNode): boolean {
    if (!isElement(node)) return false;
    for (let i = 0; i + 1 < node.children.length; i++) {
        const open = node.children[i];
        const close = node.children[i + 1];
        if (!isElement(open) || !isElement(close)) continue;
        if (open.name !== 'mo' || close.name !== 'mo') continue;
        if (OPEN_BRACKETS.has(tokenText(open) ?? '') && CLOSE_BRACKETS.has(tokenText(close) ?? '')) return true;
    }
    return node.children.some(hasEmptyBracketPair);
}

/**
 * True when any slot is empty — a fraction with no denominator, an exponent with
 * nothing in it, or a `()` with no argument.
 *
 * An empty slot has no Calcpad spelling, so a line in this state must never be
 * written back: `b/` would re-parse as a division by whatever followed it, and
 * `1()` does not parse at all. The editor uses this to hold the line open and
 * say so, rather than committing something that means less than what is on
 * screen.
 */
export function hasEmptySlot(node: MathMlNode): boolean {
    if (!isElement(node)) return false;
    if (isToken(node)) return (tokenText(node) ?? '').length === 0;
    if (node.children.length === 0) return true;
    if (hasEmptyBracketPair(node)) return true;
    return node.children.some(hasEmptySlot);
}

// ---- the canonical anchor sequence -----------------------------------------

function collect(node: MathMlNode, path: number[], out: Anchor[]): void {
    if (!isElement(node)) return;
    if (isToken(node)) {
        const length = (tokenText(node) ?? '').length;
        for (let offset = 0; offset <= length; offset++) out.push({ kind: 'char', path, offset });
        return;
    }
    if (node.children.length === 0) {
        out.push({ kind: 'gap', path, index: 0 });
        return;
    }
    node.children.forEach((child, index) => collect(child, [...path, index], out));
}

/** Every caret position in the tree, in document order. */
export function anchorsOf(root: MathMlNode): Anchor[] {
    const out: Anchor[] = [];
    collect(root, [], out);
    return out;
}

export function sameAnchor(a: Anchor, b: Anchor): boolean {
    if (a.kind !== b.kind) return false;
    if (a.path.length !== b.path.length) return false;
    for (let i = 0; i < a.path.length; i++) if (a.path[i] !== b.path[i]) return false;
    return a.kind === 'char'
        ? a.offset === (b as typeof a).offset
        : a.index === (b as typeof a).index;
}

function clamp(value: number, max: number): number {
    return Math.min(Math.max(value, 0), max);
}

/** Anchors collected from a subtree carry paths relative to it; prepend the prefix. */
function rebase(anchor: Anchor, prefix: number[]): Anchor {
    return anchor.kind === 'char'
        ? { kind: 'char', path: [...prefix, ...anchor.path], offset: anchor.offset }
        : { kind: 'gap', path: [...prefix, ...anchor.path], index: anchor.index };
}

/**
 * Map any anchor onto the canonical sequence.
 *
 * A `gap` between two children is the same visual point as the end of the child
 * before it (or the start of the one after), so navigation needs a single
 * spelling for each position or Left/Right would stall on duplicates.
 */
export function canonicalize(root: MathMlNode, anchor: Anchor): Anchor {
    if (anchor.kind === 'char') {
        const node = nodeAt(root, anchor.path);
        if (!node || !isToken(node)) return firstAnchor(root);
        return { kind: 'char', path: anchor.path, offset: clamp(anchor.offset, (tokenText(node) ?? '').length) };
    }
    const node = elementAt(root, anchor.path);
    if (!node) return firstAnchor(root);
    if (node.children.length === 0) return { kind: 'gap', path: anchor.path, index: 0 };
    if (anchor.index > 0) return lastAnchorOf(root, [...anchor.path, anchor.index - 1]);
    return firstAnchorOf(root, [...anchor.path, 0]);
}

export function anchorIndex(root: MathMlNode, anchor: Anchor): number {
    const anchors = anchorsOf(root);
    const target = canonicalize(root, anchor);
    for (let i = 0; i < anchors.length; i++) {
        if (sameAnchor(anchors[i], target)) return i;
    }
    return Math.max(0, anchors.length - 1);
}

export function firstAnchor(root: MathMlNode): Anchor {
    const anchors = anchorsOf(root);
    return anchors[0] ?? { kind: 'gap', path: [], index: 0 };
}

export function lastAnchor(root: MathMlNode): Anchor {
    const anchors = anchorsOf(root);
    return anchors[anchors.length - 1] ?? { kind: 'gap', path: [], index: 0 };
}

function firstAnchorOf(root: MathMlNode, path: number[]): Anchor {
    const subtree = nodeAt(root, path);
    if (!subtree) return { kind: 'gap', path, index: 0 };
    const anchors = anchorsOf(subtree);
    return anchors.length > 0 ? rebase(anchors[0], path) : { kind: 'gap', path, index: 0 };
}

function lastAnchorOf(root: MathMlNode, path: number[]): Anchor {
    const subtree = nodeAt(root, path);
    if (!subtree) return { kind: 'gap', path, index: 0 };
    const anchors = anchorsOf(subtree);
    return anchors.length > 0 ? rebase(anchors[anchors.length - 1], path) : { kind: 'gap', path, index: 0 };
}

// ---- navigation -------------------------------------------------------------

export function moveHorizontal(root: MathMlNode, anchor: Anchor, direction: -1 | 1): Anchor {
    const anchors = anchorsOf(root);
    const index = anchorIndex(root, anchor) + direction;
    return anchors[clamp(index, anchors.length - 1)] ?? firstAnchor(root);
}

export function moveToStartOfLine(root: MathMlNode): Anchor {
    return firstAnchor(root);
}

export function moveToEndOfLine(root: MathMlNode): Anchor {
    return lastAnchor(root);
}

/** The nearest enclosing structure and which of its slots the caret is in. */
function enclosingSlot(root: MathMlNode, path: number[]): { structurePath: number[]; slot: number } | null {
    for (let depth = path.length - 1; depth >= 1; depth--) {
        const candidate = path.slice(0, depth);
        const node = elementAt(root, candidate);
        if (node && SLOT_NAMES.has(node.name)) {
            return { structurePath: candidate, slot: path[depth - 1] };
        }
    }
    return null;
}

/**
 * Up/Down move between the slots of a structure — numerator to denominator,
 * base to exponent — and out of the structure when there is no slot left. That
 * is the MathLive behaviour: vertical movement is structural, not visual.
 */
export function moveVertical(root: MathMlNode, anchor: Anchor, direction: -1 | 1): Anchor {
    const canonical = canonicalize(root, anchor);
    const slot = enclosingSlot(root, canonical.path);
    if (!slot) return direction < 0 ? firstAnchor(root) : lastAnchor(root);

    const structure = elementAt(root, slot.structurePath);
    if (!structure) return canonical;

    const nextSlot = slot.slot + direction;
    if (nextSlot >= 0 && nextSlot < structure.children.length) {
        return lastAnchorOf(root, [...slot.structurePath, nextSlot]);
    }
    // No slot left in that direction: step out to just before or after the structure.
    const parentPath = slot.structurePath.slice(0, -1);
    const index = slot.structurePath[slot.structurePath.length - 1];
    return canonicalize(root, { kind: 'gap', path: parentPath, index: direction < 0 ? index : index + 1 });
}

// ---- selection --------------------------------------------------------------

export function orderedSelection(root: MathMlNode, selection: EditorSelection): [Anchor, Anchor] {
    return anchorIndex(root, selection.anchor) <= anchorIndex(root, selection.focus)
        ? [selection.anchor, selection.focus]
        : [selection.focus, selection.anchor];
}

export function hasSelection(root: MathMlNode, selection: EditorSelection): boolean {
    return anchorIndex(root, selection.anchor) !== anchorIndex(root, selection.focus);
}

/** The text the selection covers, for the accessibility announcement. */
export function selectionText(root: MathMlNode, selection: EditorSelection): string {
    const [from, to] = orderedSelection(root, selection);
    const anchors = anchorsOf(root);
    const start = anchorIndex(root, from);
    const end = anchorIndex(root, to);
    let out = '';
    for (let i = start; i < end; i++) {
        const anchor = anchors[i];
        if (anchor.kind !== 'char') continue;
        const node = nodeAt(root, anchor.path);
        const text = node && isToken(node) ? tokenText(node) ?? '' : '';
        out += text[anchor.offset] ?? '';
    }
    return out;
}

// ---- insertion --------------------------------------------------------------

/** The element a run of text belongs in — mirrors the tokenizer's own choice. */
export function tokenNameFor(text: string): string {
    if (/^[0-9.]+$/.test(text)) return 'mn';
    if (/^[\p{L}_]/u.test(text)) return 'mi';
    return 'mo';
}

/**
 * Where new nodes go for a given caret, including the leaf split when the caret
 * is in the middle of a token. `a|bc` + `(` must not swallow `bc`.
 */
interface Insertion {
    parentPath: number[];
    index: number;
    split?: { leafIndex: number; head: MathMlNode; tail: MathMlNode };
}

function resolveInsertion(root: MathMlElement, anchor: Anchor): Insertion | null {
    const canonical = canonicalize(root, anchor);
    if (canonical.kind === 'gap') return { parentPath: canonical.path, index: canonical.index };

    const node = nodeAt(root, canonical.path);
    if (!node || !isToken(node)) return null;
    const text = tokenText(node) ?? '';
    const parentPath = canonical.path.slice(0, -1);
    const leafIndex = canonical.path[canonical.path.length - 1];
    if (canonical.offset <= 0) return { parentPath, index: leafIndex };
    if (canonical.offset >= text.length) return { parentPath, index: leafIndex + 1 };
    const head = text.slice(0, canonical.offset);
    const tail = text.slice(canonical.offset);
    return {
        parentPath,
        index: leafIndex + 1,
        split: {
            leafIndex,
            head: el(tokenNameFor(head), [txt(head)]),
            tail: el(tokenNameFor(tail), [txt(tail)]),
        },
    };
}

/** Splice `nodes` in, splitting the leaf first when the caret was inside one. */
function spliceNodes(root: MathMlElement, insertion: Insertion, nodes: MathMlNode[]): number {
    const parent = elementAt(root, insertion.parentPath);
    if (!parent) return -1;
    if (insertion.split) {
        parent.children[insertion.split.leafIndex] = insertion.split.head;
        parent.children.splice(insertion.index, 0, ...nodes, insertion.split.tail);
        return insertion.index;
    }
    parent.children.splice(insertion.index, 0, ...nodes);
    return insertion.index;
}

// ---- tree surgery -----------------------------------------------------------

function clone(root: MathMlElement): MathMlElement {
    return cloneNode(root) as MathMlElement;
}

interface Operand {
    /** Nodes before the caret that become the new structure's content. */
    taken: MathMlNode[];
    /** Nodes that must stay after the structure — the tail of a split leaf. */
    tail: MathMlNode[];
    parentPath: number[];
    index: number;
}

/**
 * Take the operand ending at the caret. Inside a leaf the text splits at the
 * caret, so typing `/` mid-identifier turns `abc` into `ab/(c)` rather than
 * swallowing the whole name.
 */
function takeOperand(root: MathMlElement, anchor: Anchor): Operand | null {
    const canonical = canonicalize(root, anchor);
    if (canonical.kind === 'gap') {
        if (canonical.index === 0) return null;
        const parent = elementAt(root, canonical.path);
        const previous = parent?.children[canonical.index - 1];
        if (!previous) return null;
        return { taken: [previous], tail: [], parentPath: canonical.path, index: canonical.index - 1 };
    }

    const node = nodeAt(root, canonical.path);
    if (!node || !isToken(node)) return null;
    const text = tokenText(node) ?? '';
    const head = text.slice(0, canonical.offset);
    const rest = text.slice(canonical.offset);
    if (head === '') return null;
    return {
        taken: head === text ? [node] : [el(tokenNameFor(head), [txt(head)])],
        tail: rest === '' ? [] : [el(tokenNameFor(rest), [txt(rest)])],
        parentPath: canonical.path.slice(0, -1),
        index: canonical.path[canonical.path.length - 1],
    };
}

function structureFor(kind: StructureKind, content: MathMlNode[]): MathMlElement {
    const slot = (children: MathMlNode[]): MathMlElement => el('mrow', children);
    switch (kind) {
        case 'fraction': return el('mfrac', [slot(content), slot([])]);
        case 'power': return el('msup', [slot(content), slot([])]);
        case 'subscript': return el('msub', [slot(content), slot([])]);
        case 'sqrt': return el('msqrt', [slot(content)]);
        case 'root': return el('mroot', [slot(content), slot([])]);
        // The cube root is `root(x; 3)` with the degree already filled in — the
        // button says cube root, so it must not leave the degree empty and wait.
        case 'cbrt': return el('mroot', [slot(content), slot([el('mn', [txt('3')])])]);
    }
}

/** Where the caret lands after building a structure: its empty slot, or the radicand. */
function structureCaret(root: MathMlElement, structurePath: number[], kind: StructureKind): Anchor {
    // `sqrt` has one slot and `cbrt`'s degree is already filled, so both put the
    // caret in the radicand; every other structure opens its empty second slot.
    const contentSlot = kind === 'sqrt' || kind === 'cbrt' ? 0 : 1;
    const slotPath = [...structurePath, contentSlot];
    const slot = elementAt(root, slotPath);
    if (slot && slot.children.length === 0) return { kind: 'gap', path: slotPath, index: 0 };
    return lastAnchorOf(root, slotPath);
}

/**
 * Build a structure out of the operand before the caret, or an empty one at the
 * caret when there is nothing to wrap.
 */
export function buildStructure(root: MathMlElement, anchor: Anchor, kind: StructureKind): EditResult {
    const tree = clone(root);
    const before = anchorsOf(tree).length;
    const operand = takeOperand(tree, anchor);

    if (!operand) {
        const insertion = resolveInsertion(tree, anchor);
        if (!insertion) return { root, anchor, removed: 0 };
        const at = spliceNodes(tree, insertion, [structureFor(kind, [])]);
        if (at < 0) return { root, anchor, removed: 0 };
        const structurePath = [...insertion.parentPath, at];
        return { root: tree, anchor: structureCaret(tree, structurePath, kind), removed: 0 };
    }

    const parent = elementAt(tree, operand.parentPath);
    if (!parent) return { root, anchor, removed: 0 };
    parent.children.splice(operand.index, 1, structureFor(kind, operand.taken), ...operand.tail);
    const structurePath = [...operand.parentPath, operand.index];
    return {
        root: tree,
        anchor: structureCaret(tree, structurePath, kind),
        removed: Math.max(0, before - anchorsOf(tree).length),
    };
}

/**
 * Insert an empty `rows` × `cols` vector or matrix literal and put the caret in
 * its first cell.
 *
 * Calcpad's `[a; b|c; d]` literal is the only construct the palette's `vector`
 * and `2×2` buttons produce, and it has no structure the other builders can
 * express — a table is not a wrapper around one operand — so it gets its own
 * builder rather than a `StructureKind`.
 *
 * An empty cell has no Calcpad spelling, so the caller relies on `hasEmptySlot`
 * to hold the line open until every cell is filled, exactly as a bare `b/` does.
 */
export function insertTable(root: MathMlElement, anchor: Anchor, rows: number, cols: number): EditResult {
    const tree = clone(root);
    const insertion = resolveInsertion(tree, canonicalize(tree, anchor));
    if (!insertion) return { root, anchor, removed: 0 };

    const table = el('mtable', Array.from({ length: rows }, () =>
        el('mtr', Array.from({ length: cols }, () => el('mtd', [el('mrow', [])]))),
    ));
    const at = spliceNodes(tree, insertion, [table]);
    if (at < 0) return { root, anchor, removed: 0 };

    // The caret opens in the first cell: mtr[0] → mtd[0] → its empty slot.
    const cellPath = [...insertion.parentPath, at, 0, 0, 0];
    return { root: tree, anchor: { kind: 'gap', path: cellPath, index: 0 }, removed: 0 };
}

// ---- typing -----------------------------------------------------------------

/**
 * Whether `ch` continues the run of text in `text`, so `sin` stays one token.
 *
 * This has to agree with the bridge's tokenizer exactly, or typing produces a
 * tree the parser would never build — and the line then fails its own round-trip
 * and stops being editable. The tokenizer reads a number as a run of digits and
 * dots, and a name as a run of word characters *that does not start with a
 * digit*. So `x2` is one name but `2x` is a number followed by a name, which is
 * what makes `2x` Calcpad's implicit multiplication.
 */
export function mergeable(text: string, ch: string): boolean {
    if (text === '') return false;
    const last = text[text.length - 1];
    // A number only ever continues with another digit or a decimal point.
    if (/[0-9.]/.test(last)) return /[0-9.]/.test(ch);
    // A name keeps consuming word characters, digits included.
    return /[\p{L}_]/u.test(last) && /[\p{L}\p{N}_]/u.test(ch);
}

/**
 * Insert a character at the caret, extending the token before it when the two
 * belong together. A digit after a digit stays in the same `mn`; a letter after
 * a letter stays in the same `mi`; anything else starts a new token.
 */
export function insertText(root: MathMlElement, anchor: Anchor, text: string): EditResult {
    const tree = clone(root);
    const before = anchorsOf(tree).length;
    const canonical = canonicalize(tree, anchor);

    if (canonical.kind === 'char') {
        const node = nodeAt(tree, canonical.path);
        const current = node && isToken(node) ? tokenText(node) ?? '' : '';
        if (node && isElement(node) && isToken(node)) {
            // Extend the token the caret is in — `1` then `2` is one number, `x`
            // then `y` is one name — whichever side of the caret it lands on.
            if (canonical.offset === current.length && mergeable(current, text)) {
                node.children = [txt(current + text)];
                node.name = tokenNameFor(current + text);
                return {
                    root: tree,
                    anchor: { kind: 'char', path: canonical.path, offset: current.length + text.length },
                    removed: 0,
                };
            }
            if (canonical.offset === 0 && mergeable(text, current)) {
                node.children = [txt(text + current)];
                node.name = tokenNameFor(text + current);
                return {
                    root: tree,
                    anchor: { kind: 'char', path: canonical.path, offset: text.length },
                    removed: 0,
                };
            }
        }
    }

    const insertion = resolveInsertion(tree, canonical);
    if (!insertion) return { root, anchor, removed: 0 };
    const at = spliceNodes(tree, insertion, [el(tokenNameFor(text), [txt(text)])]);
    if (at < 0) return { root, anchor, removed: 0 };
    return {
        root: tree,
        anchor: { kind: 'char', path: [...insertion.parentPath, at], offset: text.length },
        removed: Math.max(0, before - anchorsOf(tree).length),
    };
}

/** Insert a matched pair — `(` and `)` — and leave the caret between them. */
export function insertPair(root: MathMlElement, anchor: Anchor, open: string, close: string): EditResult {
    const tree = clone(root);
    const before = anchorsOf(tree).length;
    const insertion = resolveInsertion(tree, canonicalize(tree, anchor));
    if (!insertion) return { root, anchor, removed: 0 };
    // The pair goes in as a single `mrow`, which is the shape the bridge parses a
    // parenthesised group back into. Without that, a freshly typed `(x)` and a
    // reloaded one would be different trees, and the editor would be editing a
    // model its own parser does not produce.
    const group = el('mrow', [el('mo', [txt(open)]), el('mo', [txt(close)])]);
    const at = spliceNodes(tree, insertion, [group]);
    if (at < 0) return { root, anchor, removed: 0 };
    return {
        root: tree,
        anchor: { kind: 'char', path: [...insertion.parentPath, at, 0], offset: open.length },
        removed: Math.max(0, before - anchorsOf(tree).length),
    };
}

/** Insert a function call — `name(` `)` — and leave the caret inside the argument list. */
export function insertCall(root: MathMlElement, anchor: Anchor, name: string): EditResult {
    const tree = clone(root);
    const before = anchorsOf(tree).length;
    const insertion = resolveInsertion(tree, canonicalize(tree, anchor));
    if (!insertion) return { root, anchor, removed: 0 };
    // The argument list is one `mrow`, matching how the bridge reads `name(...)`,
    // so a typed call and a reloaded one are the same tree.
    const nodes = [el('mi', [txt(name)]), el('mrow', [el('mo', [txt('(')]), el('mo', [txt(')')])])];
    const at = spliceNodes(tree, insertion, nodes);
    if (at < 0) return { root, anchor, removed: 0 };
    // Between the brackets: inside the `mrow` that landed at `at + 1`.
    return {
        root: tree,
        anchor: { kind: 'char', path: [...insertion.parentPath, at + 1, 0], offset: 1 },
        removed: Math.max(0, before - anchorsOf(tree).length),
    };
}

// ---- deleting ---------------------------------------------------------------

/**
 * The unit to remove when the caret sits at the very start of `path`.
 *
 * At the start of a structure's slot that unit is the *whole structure*, so
 * backspacing in an empty denominator deletes the fraction rather than leaving a
 * half-built one behind. The start of a plain `mrow` is a real no-op, so the
 * caret cannot eat the expression from the inside.
 */
function unitBefore(root: MathMlElement, path: number[]): { parentPath: number[]; index: number } | null {
    if (path.length < 2) return null;
    const structurePath = path.slice(0, -1);
    const structure = elementAt(root, structurePath);
    if (!structure || !SLOT_NAMES.has(structure.name)) return null;
    return {
        parentPath: structurePath.slice(0, -1),
        index: structurePath[structurePath.length - 1],
    };
}

function removeChild(root: MathMlElement, parentPath: number[], index: number): boolean {
    const parent = elementAt(root, parentPath);
    if (!parent || index < 0 || index >= parent.children.length) return false;
    parent.children.splice(index, 1);
    return true;
}

/**
 * Remove the unit at `index`, unwrapping a structure that still holds content.
 *
 * Deleting back out of `b/` must give `b`, not `a =` — the numerator is the
 * user's work, and losing it to a stray Backspace is the kind of silent data
 * loss a maths editor must never commit. A structure with more than one filled
 * slot has no single content to restore, so it goes whole.
 */
function removeUnit(root: MathMlElement, parentPath: number[], index: number): boolean {
    const parent = elementAt(root, parentPath);
    if (!parent || index < 0 || index >= parent.children.length) return false;
    const [child] = parent.children.splice(index, 1);
    if (child && isElement(child) && SLOT_NAMES.has(child.name)) {
        const filled = child.children.filter(slot => isElement(slot) && slot.children.length > 0);
        if (filled.length === 1) {
            parent.children.splice(index, 0, ...(filled[0] as MathMlElement).children);
        }
    }
    return true;
}

function replaceTokenText(node: MathMlElement, text: string): void {
    node.children = text === '' ? [] : [txt(text)];
    if (text !== '') node.name = tokenNameFor(text);
}

export function deleteBackward(root: MathMlElement, anchor: Anchor): EditResult {
    const tree = clone(root);
    const before = anchorsOf(tree).length;
    const canonical = canonicalize(tree, anchor);
    const done = (resultAnchor: Anchor): EditResult => ({
        root: tree,
        anchor: canonicalize(tree, resultAnchor),
        removed: Math.max(0, before - anchorsOf(tree).length),
    });

    if (canonical.kind === 'char') {
        const node = nodeAt(tree, canonical.path);
        const text = node && isToken(node) ? tokenText(node) ?? '' : '';
        if (node && isElement(node) && isToken(node) && canonical.offset > 0) {
            const next = text.slice(0, canonical.offset - 1) + text.slice(canonical.offset);
            if (next !== '') {
                replaceTokenText(node, next);
                return done({ kind: 'char', path: canonical.path, offset: canonical.offset - 1 });
            }
            // The token is now empty: the caret takes its place.
            const parentPath = canonical.path.slice(0, -1);
            const index = canonical.path[canonical.path.length - 1];
            removeChild(tree, parentPath, index);
            return done({ kind: 'gap', path: parentPath, index });
        }
        const index = canonical.path[canonical.path.length - 1];
        const target = index > 0
            ? { parentPath: canonical.path.slice(0, -1), index: index - 1 }
            : unitBefore(tree, canonical.path.slice(0, -1));
        if (!target || !removeUnit(tree, target.parentPath, target.index)) return { root, anchor, removed: 0 };
        return done({ kind: 'gap', path: target.parentPath, index: target.index });
    }

    if (canonical.index > 0) {
        const parent = elementAt(tree, canonical.path);
        if (!parent) return { root, anchor, removed: 0 };
        if (!removeUnit(tree, canonical.path, canonical.index - 1)) return { root, anchor, removed: 0 };
        return done({ kind: 'gap', path: canonical.path, index: canonical.index - 1 });
    }

    const target = unitBefore(tree, canonical.path);
    if (!target || !removeUnit(tree, target.parentPath, target.index)) return { root, anchor, removed: 0 };
    return done({ kind: 'gap', path: target.parentPath, index: target.index });
}

export function deleteForward(root: MathMlElement, anchor: Anchor): EditResult {
    const tree = clone(root);
    const before = anchorsOf(tree).length;
    const canonical = canonicalize(tree, anchor);

    if (canonical.kind === 'char') {
        const node = nodeAt(tree, canonical.path);
        const text = node && isToken(node) ? tokenText(node) ?? '' : '';
        if (!node || !isElement(node) || !isToken(node) || canonical.offset >= text.length) {
            return { root, anchor, removed: 0 };
        }
        const next = text.slice(0, canonical.offset) + text.slice(canonical.offset + 1);
        const removed = Math.max(0, before - 1);
        if (next !== '') {
            replaceTokenText(node, next);
            return { root: tree, anchor: canonicalize(tree, canonical), removed };
        }
        const parentPath = canonical.path.slice(0, -1);
        const index = canonical.path[canonical.path.length - 1];
        removeChild(tree, parentPath, index);
        return {
            root: tree,
            anchor: canonicalize(tree, { kind: 'gap', path: parentPath, index }),
            removed,
        };
    }

    const parent = elementAt(tree, canonical.path);
    if (!parent || canonical.index >= parent.children.length) return { root, anchor, removed: 0 };
    if (!removeUnit(tree, canonical.path, canonical.index)) return { root, anchor, removed: 0 };
    return {
        root: tree,
        anchor: canonicalize(tree, { kind: 'gap', path: canonical.path, index: canonical.index }),
        removed: Math.max(0, before - anchorsOf(tree).length),
    };
}

/** Remove everything between the two ends of a selection, caret at the start. */
export function deleteSelection(root: MathMlElement, selection: EditorSelection): EditResult {
    let tree = root;
    let caret = selection.focus;
    const startIndex = anchorIndex(root, selection.anchor);
    const forward = startIndex < anchorIndex(root, selection.focus);
    let remaining = Math.abs(anchorIndex(root, selection.focus) - startIndex);

    while (remaining > 0) {
        const step = forward ? deleteBackward(tree, caret) : deleteForward(tree, caret);
        if (step.removed === 0) break;
        tree = step.root;
        caret = step.anchor;
        remaining -= step.removed;
    }
    return { root: tree, anchor: caret, removed: 0 };
}

// ---- typing dispatch --------------------------------------------------------

/**
 * What a printable key does. `/`, `^` and `_` build structures rather than
 * inserting themselves — that is the whole point of a graphical editor, and it
 * mirrors the shortcuts MathLive teaches.
 */
export function applyCharacter(root: MathMlElement, anchor: Anchor, ch: string): EditResult {
    switch (ch) {
        // `/` and `÷` both spell a fraction, which is how the bridge parses them
        // and how MathML spells division — so typing either builds the structure
        // rather than leaving a slash-shaped token behind.
        case '/': case '÷': return buildStructure(root, anchor, 'fraction');
        case '^': return buildStructure(root, anchor, 'power');
        case '_': return buildStructure(root, anchor, 'subscript');
        case '(': return insertPair(root, anchor, '(', ')');
        default: return insertText(root, anchor, ch);
    }
}

/** Apply a key press, replacing the selection first when there is one. */
export function applyCharacterToSelection(
    root: MathMlElement,
    selection: EditorSelection,
    ch: string,
): EditResult {
    if (!hasSelection(root, selection)) return applyCharacter(root, selection.focus, ch);
    const cleared = deleteSelection(root, selection);
    return applyCharacter(cleared.root, cleared.anchor, ch);
}

export function deleteBackwardInSelection(root: MathMlElement, selection: EditorSelection): EditResult {
    return hasSelection(root, selection) ? deleteSelection(root, selection) : deleteBackward(root, selection.focus);
}

export function deleteForwardInSelection(root: MathMlElement, selection: EditorSelection): EditResult {
    return hasSelection(root, selection) ? deleteSelection(root, selection) : deleteForward(root, selection.focus);
}
