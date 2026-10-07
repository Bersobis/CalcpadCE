import { anchorsOf } from '../../src/mathml/caret';
import type { Anchor } from '../../src/mathml/caret';
import { nodeAt, tokenText } from '../../src/mathml/ast';
import type { MathMlElement } from '../../src/mathml/ast';

/** The caret just after the first token whose text is `token`. */
export function after(root: MathMlElement, token: string): Anchor {
    for (const anchor of anchorsOf(root)) {
        if (anchor.kind !== 'char') continue;
        const node = nodeAt(root, anchor.path);
        const value = node ? tokenText(node) : null;
        if (value === token && anchor.offset === value.length) return anchor;
    }
    throw new Error(`no caret after "${token}"`);
}

/** The caret just before the first token whose text is `token`. */
export function before(root: MathMlElement, token: string): Anchor {
    for (const anchor of anchorsOf(root)) {
        if (anchor.kind !== 'char') continue;
        const node = nodeAt(root, anchor.path);
        const value = node ? tokenText(node) : null;
        if (value === token && anchor.offset === 0) return anchor;
    }
    throw new Error(`no caret before "${token}"`);
}
