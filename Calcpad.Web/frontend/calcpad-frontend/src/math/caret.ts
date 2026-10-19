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


