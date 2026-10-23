// Range selection.
//
// A selection is two anchors, in the same canonical order the caret walks. Everything here is a
// pure function over the tree, so "typing replaces the selection" is testable without a browser
// and the DOM only ever draws what these functions decided.

import {
    Anchor, anchorIndex, anchorsOf, firstAnchor, lastAnchor, moveHorizontal, sameAnchor,
} from './caret';
import { el, isElement, leafText, MathNode, nodeAtPath, Path, sameTree } from './model';
import { applyCharacter, deleteForward, InsertResult } from './insert';

export interface AnchorRange {
    readonly from: Anchor;
    readonly to: Anchor;
}

/** The two anchors in reading order, or `null` when either is not a position in this tree. */
export function orderedRange(root: MathNode, a: Anchor, b: Anchor): AnchorRange | null {
    const first = anchorIndex(root, a);
    const second = anchorIndex(root, b);
    if (first < 0 || second < 0) return null;
    return first <= second ? { from: a, to: b } : { from: b, to: a };
}

export function isEmptyRange(range: AnchorRange): boolean {
    return sameAnchor(range.from, range.to);
}

/** How many characters the selection stands for — the number of deletions it needs. */
export function rangeLength(root: MathNode, range: AnchorRange): number {
    const list = anchorsOf(root);
    const start = list.findIndex((candidate) => sameAnchor(candidate, range.from));
    const end = list.findIndex((candidate) => sameAnchor(candidate, range.to));
    if (start < 0 || end <= start) return 0;
    let count = 0;
    for (let i = start; i < end; i++) {
        const a = list[i];
        const b = list[i + 1];
        if (a.kind === 'char' && b.kind === 'char'
            && a.path.length === b.path.length
            && a.path.every((index, at) => index === b.path[at])
            && b.offset === a.offset + 1) count++;
    }
    return count;
}

/**
 * Remove every character in the range, deleting forward so the caret keeps its place and the
 * count is exact: each `deleteForward` of a live character removes exactly one, while an emptied
 * leaf is dropped structurally without consuming budget. Deleting backward cannot do this — the
 * collapse of a slot takes the character beside it, and the loop would stop one short.
 */
export function deleteRange(root: MathNode, range: AnchorRange): InsertResult {
    let node = root;
    let caret = range.from;
    let left = rangeLength(root, range);
    for (let guard = 0; left > 0 && guard < 512; guard++) {
        const leaf = caret.kind === 'char' ? nodeAtPath(node, caret.path) : null;
        const live = leaf !== null && (leafText(leaf) ?? '') !== '';
        // The operator whose operand is going stays, so the character typed next lands in that
        // slot: removing `b^2` from `a^2 + b^2` leaves the `+`, not a row that reads `a^2`.
        const result = deleteForward(node, caret, { keepOperator: true });
        if (result.node !== node || !sameAnchor(result.anchor, caret)) {
            node = result.node;
            caret = result.anchor;
            if (live) left--;
            continue;
        }
        const next = advance(node, caret);
        if (!next) break;
        caret = next;
    }
    // Everything gone leaves a blank field, not a row of empty leaves that prints as `()`.
    if (!hasText(node)) {
        return { node: el('mrow', []), anchor: { kind: 'gap', path: [], index: 0 } };
    }
    return { node, anchor: caret };
}

function hasText(node: MathNode): boolean {
    if (!isElement(node)) return node.text.trim() !== '';
    return node.children.some(hasText);
}

/** The next position after one that cannot be deleted, or `null` at the end. */
function advance(root: MathNode, anchor: Anchor): Anchor | null {
    const list = anchorsOf(root);
    const at = list.findIndex((candidate) => sameAnchor(candidate, anchor));
    if (at >= 0) return list[at + 1] ?? null;
    // A gap the canonical order does not carry — the position a removed child left behind — is
    // followed by the child now at its index.
    if (anchor.kind !== 'gap') return null;
    const container = nodeAtPath(root, anchor.path);
    if (!isElement(container)) return null;
    const child = container.children[anchor.index];
    return child === undefined ? null : shift(firstAnchor(child), [...anchor.path, anchor.index]);
}

/** Replace the selection with one character — what typing over a selection does. */
export function replaceRange(root: MathNode, range: AnchorRange, ch: string): InsertResult {
    const removed = deleteRange(root, range);
    return applyCharacter(removed.node, removed.anchor, ch);
}

/** Every position in the tree, as a range — Select All. */
export function wholeRange(root: MathNode): AnchorRange {
    return { from: firstAnchor(root), to: lastAnchor(root) };
}

/** Scripts belong to the token under the pointer: double-clicking `q_1` selects both halves. */
const SCRIPTED = new Set(['msub', 'msup', 'msubsup']);

/** The token under an anchor — a name, a number, an operator, or a scripted name with its script. */
export function tokenRange(root: MathNode, anchor: Anchor): AnchorRange {
    // A gap is not inside a token, so it selects nothing rather than the whole row.
    if (anchor.kind === 'gap') return { from: anchor, to: anchor };
    let path: Path = anchor.path;
    while (path.length > 0) {
        const parent = nodeAtPath(root, path.slice(0, -1));
        if (!isElement(parent) || !SCRIPTED.has(parent.name)) break;
        path = path.slice(0, -1);
    }
    const node = nodeAtPath(root, path);
    if (!node) return { from: anchor, to: anchor };
    return { from: shift(firstAnchor(node), path), to: shift(lastAnchor(node), path) };
}

function shift(anchor: Anchor, prefix: Path): Anchor {
    return anchor.kind === 'char'
        ? { kind: 'char', path: [...prefix, ...anchor.path], offset: anchor.offset }
        : { kind: 'gap', path: [...prefix, ...anchor.path], index: anchor.index };
}
