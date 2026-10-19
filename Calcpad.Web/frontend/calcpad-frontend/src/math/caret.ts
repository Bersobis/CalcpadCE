// The structural caret.
//
// An anchor is a position in the tree, not in a string: either inside a text leaf at a
// character offset, or in a *gap* between children — the only way to sit in an empty slot,
// which is what makes editing `b/` or a blank matrix cell possible. The anchor sequence is
// canonical, so Left/Right never stall on two spellings of the same visual position.

import {
    MathElement, MathNode, Path, isElement, isText, leafText, nodeAtPath, pathEquals,
} from './model';

export interface CharAnchor {
    readonly kind: 'char';
    readonly path: Path;
    readonly offset: number;
}

export interface GapAnchor {
    readonly kind: 'gap';
    readonly path: Path;
    readonly index: number;
}

export type Anchor = CharAnchor | GapAnchor;

const LEAF_ELEMENTS = new Set(['mi', 'mn', 'mo', 'mtext', 'mspace']);

/** Elements whose children are stacked rather than laid out in a line. */
const VERTICAL: Readonly<Record<string, number>> = Object.freeze({
    mfrac: 2, msup: 2, msub: 2, msubsup: 3, mroot: 2, mover: 2, munder: 2, munderover: 3,
});

export function isLeafNode(node: MathNode): boolean {
    return isText(node) || (isElement(node) && LEAF_ELEMENTS.has(node.name));
}

/**
 * The position after a row's last child, when that child is a structure rather than a leaf.
 *
 * A leaf-terminated row needs no such position — the end of its last leaf's text is already the
 * end of the row — which is why this returns `null` there and leaves that path untouched.
 */
export function trailingAnchor(root: MathNode): Anchor | null {
    if (!isElement(root) || root.name !== 'mrow' || root.children.length === 0) return null;
    if (isLeafNode(root.children[root.children.length - 1])) return null;
    return { kind: 'gap', path: [], index: root.children.length };
}

/** The canonical, ordered anchor list for a tree. */
export function anchorsOf(root: MathNode): Anchor[] {
    const out: Anchor[] = [];
    walk(root, [], out);
    return out;
}

function walk(node: MathNode, path: Path, out: Anchor[]): void {
    if (isText(node)) {
        for (let offset = 0; offset <= node.text.length; offset++) out.push({ kind: 'char', path, offset });
        return;
    }
    if (LEAF_ELEMENTS.has(node.name)) {
        const text = leafText(node) ?? '';
        for (let offset = 0; offset <= text.length; offset++) out.push({ kind: 'char', path, offset });
        return;
    }
    if (node.children.length === 0) {
        out.push({ kind: 'gap', path, index: 0 });
        return;
    }
    node.children.forEach((child, index) => walk(child, [...path, index], out));
    // A row that ends in a structure has a position *after* it, and nothing inside the
    // structure stands for it: the deepest anchor is the exponent's end, so a caret sent there
    // edits the exponent. Offer the row's end as its own position instead.
    if (path.length === 0 && !isLeafNode(node.children[node.children.length - 1])) {
        out.push({ kind: 'gap', path: [], index: node.children.length });
    }
}

export function sameAnchor(a: Anchor, b: Anchor): boolean {
    if (a.kind !== b.kind || !pathEquals(a.path, b.path)) return false;
    return a.kind === 'char'
        ? a.offset === (b as CharAnchor).offset
        : a.index === (b as GapAnchor).index;
}

export function moveHorizontal(root: MathNode, anchor: Anchor, direction: -1 | 1): Anchor {
    const list = anchorsOf(root);
    const index = list.findIndex((candidate) => sameAnchor(candidate, anchor));
    if (index < 0) return anchor;
    const next = index + direction;
    if (next < 0 || next >= list.length) return anchor;
    return list[next];
}

export function firstAnchor(root: MathNode): Anchor {
    const list = anchorsOf(root);
    return list[0] ?? { kind: 'gap', path: [], index: 0 };
}

export function lastAnchor(root: MathNode): Anchor {
    const list = anchorsOf(root);
    return list[list.length - 1] ?? { kind: 'gap', path: [], index: 0 };
}

/**
 * Vertical movement walks *structural slots*: numerator ↔ denominator, base ↔ exponent,
 * matrix row ↔ matrix row. When there is no slot in that direction the caret stays put rather
 * than drifting, which is what makes `a/b` feel like a fraction instead of two text lines.
 */
export function moveVertical(root: MathNode, anchor: Anchor, direction: -1 | 1): Anchor {
    for (let depth = anchor.path.length; depth >= 0; depth--) {
        const path = anchor.path.slice(0, depth);
        const container = nodeAtPath(root, path);
        if (!isElement(container)) continue;

        const branch = anchor.path[depth];
        if (branch === undefined) continue;

        if (container.name === 'mtr') {
            const moved = moveTableRow(root, path, branch, direction);
            if (moved) return moved;
            continue;
        }

        const slots = VERTICAL[container.name];
        if (!slots) continue;

        const target = branch + direction;
        if (target < 0 || target >= slots || target >= container.children.length) continue;
        const subtree = container.children[target];
        // `firstAnchor`/`lastAnchor` are relative to the subtree, so re-base them onto the root.
        const inner = direction < 0 ? lastAnchor(subtree) : firstAnchor(subtree);
        return shiftAnchor(inner, [...path, target]);
    }
    return anchor;
}

/** Re-base an anchor from a subtree onto an ancestor path. */
function shiftAnchor(anchor: Anchor, prefix: Path): Anchor {
    return anchor.kind === 'char'
        ? { kind: 'char', path: [...prefix, ...anchor.path], offset: anchor.offset }
        : { kind: 'gap', path: [...prefix, ...anchor.path], index: anchor.index };
}

function moveTableRow(root: MathNode, rowPath: Path, column: number, direction: -1 | 1): Anchor | null {
    const tablePath = rowPath.slice(0, -1);
    const table = nodeAtPath(root, tablePath);
    if (!isElement(table) || table.name !== 'mtable') return null;

    const rowIndex = rowPath[rowPath.length - 1] + direction;
    const row = table.children[rowIndex];
    if (!isElement(row)) return null;

    const cell = row.children[column];
    if (cell === undefined) return null;
    return shiftAnchor(firstAnchor(cell), [...tablePath, rowIndex, column]);
}

/** Ordinal of an anchor in the canonical order, or `-1` when it is not a position in this tree. */
export function anchorIndex(root: MathNode, anchor: Anchor): number {
    return anchorsOf(root).findIndex((candidate) => sameAnchor(candidate, anchor));
}

/** Containers whose children are the slots Tab steps between. */
const SLOT_CONTAINERS = new Set([
    'mfrac', 'msup', 'msub', 'msubsup', 'mroot', 'mover', 'munder', 'munderover', 'mtr', 'mtd',
]);

/**
 * The position that opens each structural slot, in reading order — what Tab walks.
 *
 * Only structures contribute: between two leaves of one row there is no slot boundary, so Tab
 * from a plain expression has nowhere to go and the field lets the key through.
 */
export function slotAnchors(root: MathNode): Anchor[] {
    const found: Anchor[] = [];
    collectSlots(root, [], found);
    const list = anchorsOf(root);
    const ordinals = found
        .map((anchor) => ({ anchor, ordinal: list.findIndex((candidate) => sameAnchor(candidate, anchor)) }))
        .filter((entry) => entry.ordinal >= 0)
        .sort((a, b) => a.ordinal - b.ordinal);
    const out: Anchor[] = [];
    for (const entry of ordinals) {
        if (out.length > 0 && sameAnchor(out[out.length - 1], entry.anchor)) continue;
        out.push(entry.anchor);
    }
    return out;
}

const OPEN_DELIMITERS = new Set(['(', '[']);

function collectSlots(node: MathNode, path: Path, out: Anchor[]): void {
    if (!isElement(node)) return;
    node.children.forEach((child, index) => {
        const childPath = [...path, index];
        if (SLOT_CONTAINERS.has(node.name)) out.push(shiftAnchor(slotEntry(child), childPath));
        collectSlots(child, childPath, out);
    });
}

/** Where Tab enters a slot: inside a delimited group, not on its bracket. */
function slotEntry(child: MathNode): Anchor {
    if (isElement(child) && child.name === 'mrow' && child.children.length >= 3) {
        const opening = child.children[0];
        if (isElement(opening) && opening.name === 'mo' && OPEN_DELIMITERS.has(leafText(opening) ?? '')) {
            return shiftAnchor(firstAnchor(child.children[1]), [1]);
        }
    }
    return firstAnchor(child);
}

/**
 * The next slot in reading order, or `null` when there is none — the field then lets Tab leave.
 *
 * Going back means "out of the slot the caret is in", not "the nearest slot start behind it":
 * the caret sits at or after the start of its own slot, so comparing with the caret itself would
 * step to the start of the slot it already occupies and Shift+Tab would never reach the one before.
 */
export function nextSlot(root: MathNode, anchor: Anchor, direction: -1 | 1): Anchor | null {
    const list = anchorsOf(root);
    const at = list.findIndex((candidate) => sameAnchor(candidate, anchor));
    if (at < 0) return null;
    const slots = slotAnchors(root).map((slot) => list.findIndex((candidate) => sameAnchor(candidate, slot)));
    if (direction > 0) {
        const next = slots.find((ordinal) => ordinal > at);
        return next === undefined ? null : list[next];
    }
    let current = -1;
    for (let i = 0; i < slots.length; i++) if (slots[i] >= 0 && slots[i] <= at) current = i;
    return current > 0 ? list[slots[current - 1]] : null;
}

export function hasEmptySlot(root: MathNode): boolean {
    return emptySlotPaths(root).length > 0;
}

/**
 * Paths of every unfilled slot: a container with no children, **or a leaf whose text is empty**.
 *
 * The empty-leaf case is not hypothetical. Deleting the last character of a numerator leaves
 * `mn('')`, which prints as nothing, so a commit could write `a = /2` into the document — a line
 * the engine rejects. Reporting it here is what closes that path.
 */
export function emptySlotPaths(root: MathNode): Path[] {
    const out: Path[] = [];
    visit(root, [], out);
    return out;
}

function visit(node: MathNode, path: Path, out: Path[]): void {
    if (isText(node)) {
        if (node.text === '') out.push(path);
        return;
    }
    if (LEAF_ELEMENTS.has(node.name)) {
        if ((leafText(node) ?? '') === '') out.push(path);
        return;
    }
    if (node.children.length === 0) {
        out.push(path);
        return;
    }
    node.children.forEach((child, index) => visit(child, [...path, index], out));
}


