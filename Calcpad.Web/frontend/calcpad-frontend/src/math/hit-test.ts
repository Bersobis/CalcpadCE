// Pointer to anchor.
//
// The rendered MathML carries a `data-cp-path` on every element, so a click can be mapped back
// to the AST without re-parsing. Per-character boxes come from the Range API, which is exact
// and needs no font metrics — the thing a box-layout engine would have had to supply itself.

import { PATH_ATTR } from './serialize';
import { Anchor, anchorsOf, firstAnchor, trailingAnchor } from './caret';
import { MathNode } from './model';

export interface HitTarget {
    readonly anchor: Anchor;
}

export interface HitCandidate {
    readonly anchor: Anchor;
    readonly left: number;
    readonly right: number;
    readonly top: number;
    readonly bottom: number;
}

/**
 * Nearest anchor to a viewport point. Character boxes are preferred; when none is within a
 * line's height the nearest anchor overall is returned, so a click never lands nowhere.
 */
export function hitTest(root: MathNode, container: Element, x: number, y: number): Anchor {
    const doc = container.ownerDocument;
    if (!doc) return firstAnchor(root);
    return nearestAnchor(withRowEnd(root, hitCandidates(container)), x, y) ?? firstAnchor(root);
}

/**
 * Add the position after the line, when the line ends in a structure.
 *
 * Nothing inside `x^2 + sqrt(y)` stands for the end of the line — the deepest box is the root's
 * end — so without this a click past the content parks the caret inside the last structure, which
 * is the position the engine used to be stuck at. The candidate is last, so a click beyond every
 * box in reading order finds it.
 */
export function withRowEnd(root: MathNode, candidates: readonly HitCandidate[]): HitCandidate[] {
    const end = trailingAnchor(root);
    if (!end || candidates.length === 0) return candidates as HitCandidate[];

    let right = Number.NEGATIVE_INFINITY;
    let top = Number.POSITIVE_INFINITY;
    let bottom = Number.NEGATIVE_INFINITY;
    for (const candidate of candidates) {
        if (candidate.right > right) right = candidate.right;
        if (candidate.top < top) top = candidate.top;
        if (candidate.bottom > bottom) bottom = candidate.bottom;
    }
    // The candidate's vertical band is the line's own boxes — not the whole field. Using the
    // field made it win every click that was not exactly on a glyph, so a point below a line
    // jumped to its end instead of picking the operand nearest the pointer.
    return [...candidates, { anchor: end, left: right, right, top, bottom }];
}

export interface DomPoint {
    readonly node: Node;
    readonly offset: number;
}

/** The DOM position an anchor addresses — how a selection is handed to the browser to paint. */
export function domPointAt(container: Element, anchor: Anchor): DomPoint | null {
    const element = container.querySelector(`[${PATH_ATTR}="${anchor.path.join('.')}"]`);
    if (!element) return null;
    if (anchor.kind === 'char') {
        const textNode = element.firstChild;
        if (textNode && textNode.nodeType === 3) {
            return { node: textNode, offset: Math.min(anchor.offset, (textNode.textContent ?? '').length) };
        }
        return { node: element, offset: 0 };
    }
    return { node: element, offset: Math.min(anchor.index, element.childNodes.length) };
}

/**
 * The selection rule itself, as a pure function over boxes — testable without a DOM.
 *
 * A horizontal click past *every* box is "at the end" (or "at the start") in reading order,
 * not "nearest box". The last box on a line is usually a raised exponent or a denominator,
 * which the vertical term below refuses to pick, so such a click used to park the caret inside
 * `b^2` instead of after the expression. Otherwise vertical distance dominates: a click on a
 * fraction line must pick that line. `candidates` must be in reading order (DOM order).
 */
export function nearestAnchor(candidates: readonly HitCandidate[], x: number, y: number): Anchor | null {
    if (candidates.length === 0) return null;

    let left = Number.POSITIVE_INFINITY;
    let right = Number.NEGATIVE_INFINITY;
    for (const candidate of candidates) {
        if (candidate.left < left) left = candidate.left;
        if (candidate.right > right) right = candidate.right;
    }
    if (x > right) return candidates[candidates.length - 1].anchor;
    if (x < left) return candidates[0].anchor;

    let best: HitCandidate | null = null;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const candidate of candidates) {
        const dy = y < candidate.top ? candidate.top - y : y > candidate.bottom ? y - candidate.bottom : 0;
        // Distance to the *boundary*, not to the box: a click on the right half of a character
        // belongs after it, which is what clicking a part of an equation has to feel like.
        const dx = Math.abs(x - candidate.left);
        // Vertical distance dominates: a click on a fraction line must pick that line.
        const score = dy * 1000 + dx;
        if (score < bestScore) {
            bestScore = score;
            best = candidate;
        }
    }
    return best ? best.anchor : null;
}

/** Every box the caret can be placed on — exposed so a test can see what a click chooses from. */
export function hitCandidates(container: Element): HitCandidate[] {
    const doc = container.ownerDocument;
    const out: HitCandidate[] = [];
    const elements = container.querySelectorAll(`[${PATH_ATTR}]`);

    for (const element of Array.from(elements)) {
        const path = parsePath(element.getAttribute(PATH_ATTR) ?? '');
        if (path === null) continue;

        const textNode = element.firstChild;
        if (textNode && textNode.nodeType === 3 && textNode.textContent) {
            const text = textNode.textContent;
            for (let offset = 0; offset <= text.length; offset++) {
                const rect = charRect(doc, textNode, offset);
                if (rect) out.push({ anchor: { kind: 'char', path, offset }, ...rect });
            }
            continue;
        }

        if (element.childElementCount === 0) {
            out.push({ anchor: { kind: 'gap', path, index: 0 }, ...boxOf(element.getBoundingClientRect()) });
        }
    }
    return out;
}

/** A zero-width box at a character boundary, derived from a collapsed Range. */
function charRect(doc: Document, node: Node, offset: number): { left: number; right: number; top: number; bottom: number } | null {
    try {
        const range = doc.createRange();
        range.setStart(node, offset);
        range.setEnd(node, Math.min(offset + 1, (node.textContent ?? '').length));
        const rect = range.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) {
            range.setStart(node, Math.max(0, offset - 1));
            range.setEnd(node, offset);
            const prev = range.getBoundingClientRect();
            if (prev.width === 0 && prev.height === 0) return null;
            return { left: prev.right, right: prev.right, top: prev.top, bottom: prev.bottom };
        }
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
    } catch {
        return null;
    }
}

/**
 * A DOMRect keeps its fields on the prototype, so spreading one copies nothing at all — the box
 * becomes `NaN` and the candidate silently never wins, which is how an unfilled slot turned into
 * a dead zone you could not click into.
 */
export function boxOf(rect: DOMRectReadOnly): { left: number; right: number; top: number; bottom: number } {
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
}

function parsePath(value: string): number[] | null {
    if (value === '') return [];
    const parts = value.split('.');
    const out: number[] = [];
    for (const part of parts) {
        const index = Number(part);
        if (!Number.isInteger(index) || index < 0) return null;
        out.push(index);
    }
    return out;
}

/** The full ordered anchor list, exposed so the editor can share one walk per render. */
export function anchorList(root: MathNode): Anchor[] {
    return anchorsOf(root);
}

export interface CaretRect {
    readonly left: number;
    readonly top: number;
    readonly height: number;
}

/** Screen rectangle for an anchor — the inverse of `hitTest`, used to draw the caret. */
export function anchorRect(container: Element, anchor: Anchor): CaretRect | null {
    const doc = container.ownerDocument;
    if (!doc) return null;

    const element = container.querySelector(`[${PATH_ATTR}="${anchor.path.join('.')}"]`);
    if (!element) return null;

    if (anchor.kind === 'char') {
        const textNode = element.firstChild;
        if (textNode && textNode.nodeType === 3) {
            const rect = charRect(doc, textNode, anchor.offset);
            if (rect) return { left: rect.left, top: rect.top, height: rect.bottom - rect.top };
        }
        const box = element.getBoundingClientRect();
        return { left: anchor.offset === 0 ? box.left : box.right, top: box.top, height: box.height };
    }

    const box = element.getBoundingClientRect();
    if (box.height > 0) {
        // A gap sits between two children, so its x comes from the child that starts there — or
        // from the right edge of the last one at the end of a row. An unfilled slot has no
        // children at all, and its caret belongs at its own left edge.
        const children = element.children;
        if (children.length === 0) return { left: box.left, top: box.top, height: box.height };
        const sibling = children[Math.min(anchor.index, children.length - 1)].getBoundingClientRect();
        return {
            left: anchor.index >= children.length ? sibling.right : sibling.left,
            top: box.top,
            height: box.height,
        };
    }
    const parent = element.parentElement?.getBoundingClientRect();
    return parent ? { left: parent.left, top: parent.top, height: parent.height } : null;
}
