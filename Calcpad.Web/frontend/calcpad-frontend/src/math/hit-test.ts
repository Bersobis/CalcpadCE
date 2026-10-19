// Pointer to anchor.
//
// The rendered MathML carries a `data-cp-path` on every element, so a click can be mapped back
// to the AST without re-parsing. Per-character boxes come from the Range API, which is exact
// and needs no font metrics — the thing a box-layout engine would have had to supply itself.

import { PATH_ATTR } from './serialize';
import { Anchor, anchorsOf, firstAnchor } from './caret';
import { MathNode } from './model';

export interface HitTarget {
    readonly anchor: Anchor;
}

interface Candidate {
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

    const candidates = collectCandidates(container, doc);
    if (candidates.length === 0) return firstAnchor(root);

    let best: Candidate | null = null;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const candidate of candidates) {
        const dy = y < candidate.top ? candidate.top - y : y > candidate.bottom ? y - candidate.bottom : 0;
        const dx = x < candidate.left ? candidate.left - x : x > candidate.right ? x - candidate.right : 0;
        // Vertical distance dominates: a click on a fraction line must pick that line.
        const score = dy * 1000 + dx;
        if (score < bestScore) {
            bestScore = score;
            best = candidate;
        }
    }
    return best ? best.anchor : firstAnchor(root);
}

function collectCandidates(container: Element, doc: Document): Candidate[] {
    const out: Candidate[] = [];
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
            const rect = element.getBoundingClientRect();
            out.push({ anchor: { kind: 'gap', path, index: 0 }, ...rect });
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
    if (box.height > 0) return { left: box.left, top: box.top, height: box.height };
    const parent = element.parentElement?.getBoundingClientRect();
    return parent ? { left: parent.left, top: parent.top, height: parent.height } : null;
}
