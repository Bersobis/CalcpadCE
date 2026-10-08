/**
 * Turning a pointer position in the rendered MathML back into a caret anchor.
 *
 * The graphical editor renders its tree with `serializeWithPaths`, so every
 * element carries a `data-path` addressing it in the AST. That is the whole
 * trick: a click resolves to a DOM text position (`caretRangeFromPoint`), the
 * nearest tagged ancestor turns that into a path, and the path plus the offset
 * inside the leaf becomes an `Anchor`.
 *
 * Keeping this here rather than in the Vue component means the mapping is a pure
 * function the tests can drive with a plain DOM, with no browser and no math
 * library involved.
 */

import type { MathMlNode } from './ast';
import { isElement, isToken, nodeAt, tokenText } from './ast';
import type { Anchor } from './caret';
import { canonicalize, firstAnchor } from './caret';

/** A document position the browser resolved under the pointer. */
export interface DomPoint {
    /** The node the position fell in. */
    node: Node;
    /** Offset within `node`, in the sense `Range.setStart` uses. */
    offset: number;
}

/**
 * The nearest ancestor element carrying a `data-path`, and the path it names.
 *
 * `null` when the point is outside the tagged surface — a click on padding, or
 * on a row that is not being edited.
 */
export function taggedPath(node: Node | null): number[] | null {
    if (!node) return null;
    const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element | null);
    const tagged = element?.closest?.('[data-path]') ?? null;
    if (!tagged) return null;
    const raw = tagged.getAttribute('data-path') ?? '';
    // `pathKey` joins with "."; the root is the empty string.
    if (raw === '') return [];
    if (!/^\d+(\.\d+)*$/.test(raw)) return null;
    return raw.split('.').map(Number);
}

/**
 * Map a DOM point onto an AST anchor.
 *
 * A point inside a leaf's text becomes a `char` anchor at that offset. A point
 * that fell *between* children — the only way to be inside an empty slot such as
 * a fraction's denominator — becomes a `gap`. Anything the path cannot address
 * falls back to the start of the expression rather than throwing, so a stray
 * click is harmless.
 */
export function anchorFromDomPoint(root: MathMlNode, point: DomPoint): Anchor | null {
    const path = taggedPath(point.node);
    if (path === null) return null;
    const node = nodeAt(root, path);
    if (!node) return null;

    if (point.node.nodeType === Node.TEXT_NODE && isToken(node)) {
        const length = (tokenText(node) ?? '').length;
        const offset = Math.min(Math.max(point.offset, 0), length);
        return canonicalize(root, { kind: 'char', path, offset });
    }
    if (isElement(node) && node.children.length === 0) {
        return { kind: 'gap', path, index: 0 };
    }
    // A point in element content (between children) is a gap before the child the
    // offset names; canonicalize folds it onto the child boundary so navigation
    // and selection treat it as the same place.
    return canonicalize(root, { kind: 'gap', path, index: Math.max(0, point.offset) });
}

/**
 * The caret anchor for a pointer position, with a safe fallback.
 *
 * When the point cannot be resolved — the browser put it somewhere the path
 * cannot address — the start of the expression is used rather than leaving the
 * caret where it was, so a click always lands the caret somewhere sensible.
 */
export function anchorForClick(root: MathMlNode, point: DomPoint): Anchor {
    return anchorFromDomPoint(root, point) ?? firstAnchor(root);
}
