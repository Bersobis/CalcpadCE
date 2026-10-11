// Structural editing: what a keystroke or a palette button does to the tree.
//
// Calcpad's operators *are* its structures, so typing `/` builds a fraction and `^` builds a
// power — there is no command layer to translate. Every operation is a pure function over the
// AST, which is what makes the whole editing surface testable without a browser.
//
// The rule every function here obeys: an accepted keystroke must produce a tree the parser
// rebuilds from the text the printer emits. A keystroke that cannot is *declined* (a no-op),
// never guessed at — appending `)` to a name used to produce `mi('a)b')`, which round-tripped
// to a different tree and broke the invariant the whole design rests on.

import {
    MathElement, MathNode, Path, el, elAttr, isElement, leaf, leafText, mi, mn, mo,
    nodeAtPath, replaceAtPath, sameTree,
} from './model';
import { Anchor, CharAnchor, anchorsOf, firstAnchor, hasEmptySlot, lastAnchor, sameAnchor } from './caret';
import { BUILTIN_FUNCTIONS, isDigitChar, isNameChar, isNameStart, isOperator } from './grammar';
import { nameToNode, parseCalcpad } from './parser';
import { printCalcpad } from './printer';

export interface InsertResult {
    readonly node: MathNode;
    readonly anchor: Anchor;
}

export type StructureId =
    | 'frac' | 'power' | 'subscript' | 'sqrt' | 'cbrt' | 'nroot' | 'abs'
    | 'paren' | 'bracket' | 'vector' | 'matrix2x2' | 'matrix3x3' | 'call';

export interface Structure {
    readonly id: StructureId;
    readonly label: string;
    readonly group: 'Structures' | 'Functions';
    readonly title: string;
    /** Consumes the text to the left of the caret as the structure's base. */
    readonly absorbsLeft: boolean;
}

export const STRUCTURES: readonly Structure[] = Object.freeze([
    { id: 'frac', label: 'a/b', group: 'Structures', title: 'Fraction', absorbsLeft: true },
    { id: 'power', label: 'x\u207F', group: 'Structures', title: 'Power', absorbsLeft: true },
    { id: 'subscript', label: 'x\u2099', group: 'Structures', title: 'Subscript', absorbsLeft: true },
    { id: 'sqrt', label: '\u221A', group: 'Structures', title: 'Square root', absorbsLeft: true },
    { id: 'cbrt', label: '\u221B', group: 'Structures', title: 'Cube root', absorbsLeft: true },
    { id: 'nroot', label: '\u207F\u221A', group: 'Structures', title: 'n-th root', absorbsLeft: true },
    { id: 'abs', label: 'abs', group: 'Structures', title: 'Absolute value', absorbsLeft: true },
    { id: 'paren', label: '( )', group: 'Structures', title: 'Parentheses', absorbsLeft: false },
    { id: 'bracket', label: '[ ]', group: 'Structures', title: 'Brackets', absorbsLeft: false },
    { id: 'vector', label: '[a; b]', group: 'Structures', title: 'Vector', absorbsLeft: false },
    { id: 'matrix2x2', label: '2\u00D72', group: 'Structures', title: '2\u00D72 matrix', absorbsLeft: false },
    { id: 'matrix3x3', label: '3\u00D73', group: 'Structures', title: '3\u00D73 matrix', absorbsLeft: false },
    { id: 'call', label: 'f(x)', group: 'Functions', title: 'Function call', absorbsLeft: false },
]);

/**
 * Symbols offered beside the structures: the operators a Calcpad document uses and the Greek
 * letters its variable names are full of. Shared so the field's palette and the panel's toolbar
 * cannot drift apart.
 */
export const PALETTE_SYMBOLS: readonly string[] = Object.freeze([
    '+', '-', '*', '/', '^', '=', '<', '>', '\u2264', '\u2265', '\u2260', '\u2227', '\u2228', '\u29BC',
    '\u03C0', '\u03B1', '\u03B2', '\u03B8', '\u03BB', '\u03BC', '\u03C3', '\u03C4', '\u03C9', '\u00B0',
]);

const EMPTY = (): MathElement => el('mrow', []);
const LEAF_NAMES = new Set(['mi', 'mn', 'mo', 'mtext', 'mspace']);

/** Structures with exactly two branches, which collapse to the surviving branch when emptied. */
const BINARY_STRUCTURES = new Set(['mfrac', 'msup', 'msub', 'mroot', 'munder', 'mover', 'munderover']);

/**
 * Characters that are structure, not text: typing them inside an operand has no valid meaning,
 * so they are declined. `(` and `[` are handled earlier because they open a structure, and `,`
 * is deliberately absent — it is a name character (`B_0,0`).
 */
const DECLINED = new Set([';', '|', ')', ']', ' ', '\t']);

type CharKind = 'digit' | 'name' | 'operator' | 'declined';

function classifyChar(ch: string): CharKind {
    if (DECLINED.has(ch)) return 'declined';
    if (isOperator(ch) || ch === '!') return 'operator';
    if (isDigitChar(ch) || ch === '.') return 'digit';
    if (isNameStart(ch) || isNameChar(ch)) return 'name';
    return 'declined';
}

// ---------------------------------------------------------------------------------------
// Characters
// ---------------------------------------------------------------------------------------

export function applyCharacter(root: MathNode, anchor: Anchor, ch: string): InsertResult {
    return guard(root, anchor, applyCharacterUnguarded(root, anchor, ch));
}

function applyCharacterUnguarded(root: MathNode, anchor: Anchor, ch: string): InsertResult {
    if (anchor.kind === 'char') {
        if (ch === '/') return buildStructure(root, anchor, 'frac');
        if (ch === '^') return buildStructure(root, anchor, 'power');
        if (ch === '(') return buildStructure(root, anchor, 'paren');
        if (ch === '[') return buildStructure(root, anchor, 'bracket');
        return insertText(root, anchor, ch);
    }
    return insertLeafAtGap(root, anchor, ch);
}

/**
 * The one rule the editor has to obey: never hold a tree its own parser disagrees with.
 *
 * The per-character rules above decline what they can recognise, but enumerating every way an
 * operator can end up in the wrong place is exactly the kind of analysis that leaves a hole. So
 * the result is checked instead: if the text it prints to re-parses to a *different* tree, the
 * keystroke is refused. Text that does not parse at all is left alone — `a + ` on the way to
 * `a + b` is a legitimate intermediate, and `isCommittableText` keeps it out of the document.
 */
function guard(root: MathNode, anchor: Anchor, result: InsertResult): InsertResult {
    const printed = printCalcpad(result.node);
    if (printed === printCalcpad(root)) return { node: root, anchor };
    // An unfilled slot prints as nothing, so a structure being built (`x()`, `q/`) never
    // re-parses to itself. That is the "held open" state, not a drift.
    if (hasEmptySlot(result.node)) return result;
    const reparsed = parseCalcpad(printed);
    if (!reparsed.ok || !reparsed.node) return result;
    return sameTree(result.node, reparsed.node) ? result : { node: root, anchor };
}

export function insertText(root: MathNode, anchor: CharAnchor, text: string): InsertResult {
    if (text.length !== 1) return { node: root, anchor };
    const kind = classifyChar(text);
    if (kind === 'declined') return { node: root, anchor };

    const target = nodeAtPath(root, anchor.path);
    // Typing into an operator would append to its text; the caret can sit there, but the
    // keystroke is declined rather than corrupting the node.
    if (isElement(target) && target.name === 'mo') return { node: root, anchor };

    if (kind === 'operator') {
        // Operators are nodes, not characters appended to a name: `a` then `+` must build the
        // `mrow[mi(a), mo(+)]` the parser builds from `a+`.
        return spliceNode(root, anchor, mo(text));
    }

    const current = isLeafNode(target) ? leafText(target) ?? '' : '';
    const next = current.slice(0, anchor.offset) + text + current.slice(anchor.offset);
    if (extendsLeaf(target, kind, next)) {
        const replacement = makeLeaf(target, next);
        // Typing inside a name keeps the caret after the inserted character. Extending `a_` with
        // `b` is different: the name becomes a `msub`, whose end is inside the subscript, so the
        // caret follows the rebuilt node instead of a fixed offset.
        const caret: Anchor = isLeafNode(replacement)
            ? { kind: 'char', path: anchor.path, offset: anchor.offset + 1 }
            : shift(lastAnchor(replacement), anchor.path);
        return { node: replaceAtPath(root, anchor.path, replacement), anchor: caret };
    }

    // A digit after a name, or a name after a number, is juxtaposition (`2x`), not one token.
    // `.` and `_` are the exceptions: they exist only inside a number or a name, so they can
    // never begin a token and are declined.
    const leaf = leafFor(text);
    if (!leaf) return { node: root, anchor };
    return spliceNode(root, anchor, leaf);
}

/** Whether `next` is still one token of the same kind — a name stays a name, a number a number. */
function extendsLeaf(target: MathNode | null | undefined, kind: CharKind, next: string): boolean {
    if (!isElement(target)) return false;
    if (target.name === 'mn') return kind === 'digit' && /^[0-9]*\.?[0-9]*$/.test(next);
    if (target.name === 'mi') {
        // Digits continue a name (`ab3` is one name), so both kinds extend it.
        return (kind === 'name' || kind === 'digit') && next !== '' && isNameStart(next[0])
            && Array.from(next).every((c) => isNameChar(c));
    }
    return false;
}

/** Insert `node` at the caret, splitting the leaf it lands in. */
function spliceNode(root: MathNode, anchor: CharAnchor, node: MathNode): InsertResult {
    const target = nodeAtPath(root, anchor.path);
    const text = isLeafNode(target) ? leafText(target) ?? '' : '';
    const left = text.slice(0, anchor.offset);
    let right = text.slice(anchor.offset);
    let inserted = node;

    // A name absorbs the name characters that follow it: `a` typed inside `12` is `1a2`, which
    // the parser reads as `1` and the single name `a2` — leaving `mi('a')` beside `mn('2')` would
    // be a tree its own parser never builds.
    if (isElement(inserted) && inserted.name === 'mi') {
        let absorbed = 0;
        while (absorbed < right.length && isNameChar(right[absorbed])) absorbed++;
        if (absorbed > 0) {
            inserted = nameToNode((leafText(inserted) ?? '') + right.slice(0, absorbed));
            right = right.slice(absorbed);
        }
    }

    const children: MathNode[] = [];
    let nodeIndex = 0;
    if (left !== '') { children.push(makeLeaf(target, left)); nodeIndex = 1; }

    // With nothing to its left the operator becomes a *prefix*, and the parser only preserves a
    // prefix `-` (it wraps `-x` but drops `+x`). Anything else would be read back as a different
    // tree, or not at all, so it is declined.
    const glyph = isElement(inserted) && inserted.name === 'mo' ? leafText(inserted) ?? '' : '';
    if (glyph !== '' && left === '' && glyph !== '-') return { node: root, anchor };
    // `!` is postfix, so it binds to the operand before it: mid-leaf the parser nests
    // `mrow[mrow[a, !], b]` while a flat row would print the same text. Only the end of a leaf
    // is unambiguous.
    if (glyph === '!' && right !== '') return { node: root, anchor };

    children.push(inserted);
    if (right !== '') children.push(makeLeaf(target, right));

    const replacement = children.length === 1 ? children[0] : el('mrow', children);
    const base = children.length === 1 ? anchor.path : [...anchor.path, nodeIndex];
    return { node: replaceAtPath(root, anchor.path, replacement), anchor: shift(lastAnchor(inserted), base) };
}

function insertLeafAtGap(root: MathNode, anchor: Extract<Anchor, { kind: 'gap' }>, ch: string): InsertResult {
    const child = leafFor(ch);
    if (!child) return { node: root, anchor };
    const container = nodeAtPath(root, anchor.path);
    if (!isElement(container)) return { node: root, anchor };

    // An empty slot is replaced by the leaf outright. Splicing into the empty `mrow` instead
    // would leave a one-child wrapper, and `q/1` would print as `q/(1)` — a tree that no
    // longer matches what the parser builds from the same text.
    if (container.children.length === 0) {
        return {
            node: replaceAtPath(root, anchor.path, child),
            anchor: { kind: 'char', path: anchor.path, offset: 1 },
        };
    }

    const children = container.children.slice();
    children.splice(anchor.index, 0, child);
    return {
        node: replaceAtPath(root, anchor.path, { name: container.name, attrs: container.attrs, children }),
        anchor: { kind: 'char', path: [...anchor.path, anchor.index], offset: 1 },
    };
}

// ---------------------------------------------------------------------------------------
// Structures
// ---------------------------------------------------------------------------------------

export function insertStructure(root: MathNode, anchor: Anchor, id: StructureId): InsertResult {
    return buildStructure(root, anchor, id);
}

function buildStructure(root: MathNode, anchor: Anchor, id: StructureId): InsertResult {
    const spec = STRUCTURES.find((s) => s.id === id);
    const absorbing = spec?.absorbsLeft ?? false;
    const split = anchor.kind === 'char'
        ? splitLeaf(root, anchor)
        : { base: null as MathNode | null, rest: null as MathNode | null, path: anchor.path };

    // The text left of the caret becomes the structure's base; the text right of it flows into
    // the structure's first empty slot, so typing `/` inside `ab` yields `a/b`, not `a(b/c)`.
    let base = absorbing ? split.base : null;
    let rest = split.rest;
    if (absorbing && !base && rest) {
        base = rest;
        rest = null;
    }

    // A `(` immediately after a name is a *function call* in Calcpad's grammar, not a product.
    // Building a juxtaposition here would produce a tree the parser never builds from the same
    // text, so the name is absorbed as the callee.
    const callee = split.base && isElement(split.base) && split.base.name === 'mi' ? split.base : null;
    if ((id === 'paren' || id === 'call') && callee) {
        const name = leafText(callee) ?? '';
        const call = el('mrow', [
            mi(name, BUILTIN_FUNCTIONS.has(name) ? { 'data-cp': 'func' } : {}),
            mo('('),
            EMPTY(),
            mo(')'),
        ]);
        const caret: Anchor = { kind: 'gap', path: [2], index: 0 };
        if (anchor.kind === 'gap') {
            const container = nodeAtPath(root, anchor.path);
            if (!isElement(container)) return { node: root, anchor };
            const children = container.children.slice();
            children.splice(anchor.index, 0, call);
            return {
                node: replaceAtPath(root, anchor.path, { name: container.name, attrs: container.attrs, children }),
                anchor: shift(caret, [...anchor.path, anchor.index]),
            };
        }
        return { node: replaceAtPath(root, split.path, call), anchor: shift(caret, split.path) };
    }

    const { structure, slot } = structureNode(id, base);

    let finalStructure = structure;
    let caretInStructure: Anchor = slot;
    if (absorbing && rest && slot.kind === 'gap' && slot.path.length > 0) {
        finalStructure = replaceAtPath(structure, slot.path, rest);
        caretInStructure = shift(lastAnchor(rest), slot.path);
        rest = null;
    }

    if (anchor.kind === 'gap') {
        const container = nodeAtPath(root, anchor.path);
        if (!isElement(container)) return { node: root, anchor };
        const children = container.children.slice();
        children.splice(anchor.index, 0, finalStructure);
        return {
            node: replaceAtPath(root, anchor.path, { name: container.name, attrs: container.attrs, children }),
            anchor: shift(caretInStructure, [...anchor.path, anchor.index]),
        };
    }

    const children: MathNode[] = [];
    let structureIndex = 0;
    if (!absorbing && split.base) {
        children.push(split.base);
        structureIndex = 1;
    }
    children.push(finalStructure);
    if (rest) children.push(rest);

    const replacement = children.length === 1 ? children[0] : el('mrow', children);
    // When the structure *is* the replacement it sits at `split.path`; when it is one child of
    // a new row it sits one level deeper. Getting this wrong leaves the caret pointing at a
    // node that does not exist, so the next keystroke is silently dropped.
    const structurePath = children.length === 1 ? split.path : [...split.path, structureIndex];
    return {
        node: replaceAtPath(root, split.path, replacement),
        anchor: shift(caretInStructure, structurePath),
    };
}

interface SplitResult {
    readonly base: MathNode | null;
    readonly rest: MathNode | null;
    readonly path: Path;
}

function splitLeaf(root: MathNode, anchor: CharAnchor): SplitResult {
    const node = nodeAtPath(root, anchor.path);
    const text = isLeafNode(node) ? leafText(node) ?? '' : '';
    const left = text.slice(0, anchor.offset);
    const right = text.slice(anchor.offset);
    return {
        base: left === '' ? null : makeLeaf(node, left),
        rest: right === '' ? null : makeLeaf(node, right),
        path: anchor.path,
    };
}

/** Build a structure and describe where the caret should land inside it (path from its root). */
function structureNode(id: StructureId, base: MathNode | null): { structure: MathNode; slot: Anchor } {
    const b = base ?? EMPTY();
    switch (id) {
        case 'frac':
            return { structure: el('mfrac', [b, EMPTY()]), slot: { kind: 'gap', path: [1], index: 0 } };
        case 'power':
            return { structure: el('msup', [b, EMPTY()]), slot: { kind: 'gap', path: [1], index: 0 } };
        case 'subscript':
            return { structure: el('msub', [b, EMPTY()]), slot: { kind: 'gap', path: [1], index: 0 } };
        case 'sqrt': {
            const structure = el('msqrt', [b]);
            return { structure, slot: firstSlot(structure) };
        }
        case 'cbrt': {
            const structure = elAttr('mroot', { 'data-cp': 'cbrt' }, [b, mn('3')]);
            return { structure, slot: firstSlot(structure) };
        }
        case 'nroot':
            return { structure: elAttr('mroot', { 'data-cp': 'root' }, [b, EMPTY()]), slot: { kind: 'gap', path: [1], index: 0 } };
        case 'abs':
            return {
                structure: elAttr('mrow', { 'data-cp': 'abs' }, [mo('|'), b, mo('|')]),
                slot: { kind: 'gap', path: [1], index: 0 },
            };
        case 'paren':
            return { structure: el('mrow', [mo('('), EMPTY(), mo(')')]), slot: { kind: 'gap', path: [1], index: 0 } };
        case 'bracket':
            return { structure: el('mrow', [mo('['), EMPTY(), mo(']')]), slot: { kind: 'gap', path: [1], index: 0 } };
        case 'vector':
            return {
                structure: el('mrow', [mo('['), EMPTY(), mo(';'), EMPTY(), mo(']')]),
                slot: { kind: 'gap', path: [1], index: 0 },
            };
        case 'matrix2x2':
            return { structure: matrix(2, 2), slot: { kind: 'gap', path: [1, 0, 0, 0], index: 0 } };
        case 'matrix3x3':
            return { structure: matrix(3, 3), slot: { kind: 'gap', path: [1, 0, 0, 0], index: 0 } };
        case 'call':
            return {
                structure: el('mrow', [mi('f', { 'data-cp': 'func' }), mo('('), EMPTY(), mo(')')]),
                slot: { kind: 'gap', path: [2], index: 0 },
            };
    }
}

function matrix(rows: number, columns: number): MathNode {
    return el('mrow', [
        mo('['),
        el('mtable', Array.from({ length: rows }, () =>
            el('mtr', Array.from({ length: columns }, () => el('mtd', [EMPTY()])))
        )),
        mo(']'),
    ]);
}

function firstSlot(node: MathNode): Anchor {
    if (isElement(node) && node.children.length === 0) return { kind: 'gap', path: [], index: 0 };
    if (isElement(node)) {
        for (let i = 0; i < node.children.length; i++) {
            const slot = firstSlot(node.children[i]);
            if (slot.kind === 'gap') return { kind: 'gap', path: [i, ...slot.path], index: slot.index };
        }
    }
    return firstAnchor(node);
}

function shift(anchor: Anchor, prefix: Path): Anchor {
    return anchor.kind === 'char'
        ? { kind: 'char', path: [...prefix, ...anchor.path], offset: anchor.offset }
        : { kind: 'gap', path: [...prefix, ...anchor.path], index: anchor.index };
}

// ---------------------------------------------------------------------------------------
// Deletion
// ---------------------------------------------------------------------------------------

export function deleteBackward(root: MathNode, anchor: Anchor): InsertResult {
    if (anchor.kind === 'gap') return { node: root, anchor };
    const node = nodeAtPath(root, anchor.path);
    const text = isLeafNode(node) ? leafText(node) ?? '' : '';

    if (text === '') return removeEmptyLeaf(root, anchor);
    if (anchor.offset > 0) return removeCharacter(root, anchor, anchor.offset - 1);

    // Offset 0: the character to delete lives in the previous leaf, so walk back to it. Without
    // this the first character of every leaf is undeletable and nothing can ever be merged.
    const list = anchorsOf(root);
    const index = list.findIndex((a) => sameAnchor(a, anchor));
    for (let i = index - 1; i >= 0; i--) {
        const previous = list[i];
        if (previous.kind === 'char' && previous.offset > 0) return removeCharacter(root, previous, previous.offset - 1);
    }
    return { node: root, anchor };
}

export function deleteForward(root: MathNode, anchor: Anchor): InsertResult {
    if (anchor.kind === 'gap') return { node: root, anchor };
    const node = nodeAtPath(root, anchor.path);
    const text = isLeafNode(node) ? leafText(node) ?? '' : '';

    if (text === '') return removeEmptyLeaf(root, anchor);
    if (anchor.offset < text.length) return removeCharacter(root, anchor, anchor.offset);
    return { node: root, anchor };
}

function removeCharacter(root: MathNode, anchor: CharAnchor, at: number): InsertResult {
    const node = nodeAtPath(root, anchor.path);
    const text = isLeafNode(node) ? leafText(node) ?? '' : '';
    const next = text.slice(0, at) + text.slice(at + 1);

    // Emptying a leaf that sits *in a row* removes it: leaving `mo('')` behind would print as
    // nothing and re-parse to a different tree, so `a + b` minus its `+` would read `ab` while
    // the editor still held the operator.
    if (next === '' && inRow(root, anchor.path)) return removeChild(root, anchor.path);

    return {
        node: replaceAtPath(root, anchor.path, makeLeaf(node, next)),
        anchor: { kind: 'char', path: anchor.path, offset: Math.max(0, at) },
    };
}

/**
 * Delete an empty leaf. A two-branch structure collapses to the branch that is left, so deleting
 * the empty numerator of `1/` gives `1` instead of an unremovable hole; anything else drops the
 * child.
 */
function removeEmptyLeaf(root: MathNode, anchor: CharAnchor): InsertResult {
    if (anchor.path.length === 0) return { node: root, anchor };

    const parentPath = anchor.path.slice(0, -1);
    const parent = nodeAtPath(root, parentPath);
    if (!isElement(parent)) return { node: root, anchor };
    const index = anchor.path[anchor.path.length - 1];

    if (BINARY_STRUCTURES.has(parent.name) && parent.children.length === 2) {
        const sibling = parent.children[index === 0 ? 1 : 0];
        return { node: replaceAtPath(root, parentPath, sibling), anchor: shift(firstAnchor(sibling), parentPath) };
    }
    return removeChild(root, anchor.path);
}

/** Remove the node at `path` from its parent, pruning a row left with a dangling operator. */
function removeChild(root: MathNode, path: Path): InsertResult {
    const parentPath = path.slice(0, -1);
    const parent = nodeAtPath(root, parentPath);
    if (!isElement(parent)) return { node: root, anchor: { kind: 'gap', path: [], index: 0 } };
    const index = path[path.length - 1];

    let children = parent.children.filter((_, i) => i !== index);
    if (parent.name === 'mrow') children = pruneRow(children);

    return {
        node: replaceAtPath(root, parentPath, { name: parent.name, attrs: parent.attrs, children }),
        anchor: { kind: 'gap', path: parentPath, index: Math.min(index, children.length) },
    };
}

/** Drop emptied leaves and a trailing dangling operator, so `a + b` minus `b` reads `a`. */
function pruneRow(children: readonly MathNode[]): MathNode[] {
    let out = children.filter((c) => !(isLeafNode(c) && (leafText(c) ?? '') === ''));
    while (out.length > 1 && isDanglingOperator(out[out.length - 1])) out = out.slice(0, -1);
    return out;
}

/** A trailing binary operator with no right operand — only safe to drop at the end of a row. */
function isDanglingOperator(node: MathNode): boolean {
    return isElement(node) && node.name === 'mo' && isOperator(leafText(node) ?? '');
}

function inRow(root: MathNode, path: Path): boolean {
    if (path.length === 0) return false;
    const parent = nodeAtPath(root, path.slice(0, -1));
    return isElement(parent) && parent.name === 'mrow' && parent.children.length > 1;
}

// ---------------------------------------------------------------------------------------

function isLeafNode(node: MathNode | null | undefined): node is MathElement {
    return node != null && isElement(node) && LEAF_NAMES.has(node.name);
}

/** Rebuild a leaf of the same kind, so typing into `mn` keeps it a number. */
function makeLeaf(node: MathNode | null | undefined, text: string): MathNode {
    if (isElement(node) && (node.name === 'mn' || node.name === 'mo' || node.name === 'mtext')) {
        return leaf(node.name, text, node.attrs);
    }
    // A name follows the parser's own rule, so `a_b` becomes the `msub` the parser builds —
    // not a plain identifier that round-trips to a different tree.
    if (text !== '' && isNameStart(text[0]) && Array.from(text).every((c) => isNameChar(c))) {
        return nameToNode(text);
    }
    return leafFor(text) ?? mi(text);
}

/**
 * The leaf a character belongs in, or `null` when it cannot begin a token at all.
 *
 * `_` and `,` are name *characters* but not name *starters*, and `.` belongs to a number — so
 * none of them can open a token and each is declined instead of producing an unreadable node.
 */
function leafFor(ch: string): MathNode | null {
    if (isOperator(ch) || ch === '!') return mo(ch);
    if (isNameStart(ch)) return mi(ch);
    if (isDigitChar(ch)) return mn(ch);
    return null;
}
