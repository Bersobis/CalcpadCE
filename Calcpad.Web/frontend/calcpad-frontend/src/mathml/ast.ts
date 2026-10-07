/**
 * A small, explicit MathML AST — the single representation the graphical editor
 * reads from and writes to.
 *
 * The point of having our own AST rather than editing the DOM is that every
 * editing operation (move the caret, insert a character, build a fraction) is a
 * pure function over plain data, so it can be tested without a browser and
 * without a math library. Serialization is a separate, equally pure step; there
 * is no LaTeX anywhere in the pipeline.
 *
 * Only the MathML the editor can *edit* is modelled. Anything else the parser
 * meets is preserved verbatim as an `unknown` element so nothing is silently
 * dropped — the editor declines to open such a line rather than corrupt it.
 */

/** Element names the editor understands. */
export type MathMlName =
    | 'math'
    | 'mrow'
    | 'mi'
    | 'mn'
    | 'mo'
    | 'mtext'
    | 'mspace'
    | 'mfrac'
    | 'msqrt'
    | 'mroot'
    | 'msup'
    | 'msub'
    | 'msubsup'
    | 'mfenced'
    | 'mover'
    | 'munder'
    | 'munderover'
    | 'mtable'
    | 'mtr'
    | 'mtd'
    | 'mstyle';

/** Names whose content is literal text rather than further structure. */
const TOKEN_NAMES = new Set<string>(['mi', 'mn', 'mo', 'mtext', 'ms', 'mspace']);

/** Elements that hold a single required child (so an empty one is an empty slot). */
export const SLOT_NAMES = new Set<string>(['mfrac', 'msqrt', 'mroot', 'msup', 'msub', 'msubsup', 'mover', 'munder', 'munderover']);

export interface MathMlText {
    kind: 'text';
    text: string;
}

export interface MathMlElement {
    kind: 'element';
    name: MathMlName | string;
    /** Only attributes the editor round-trips; `math` carries its namespace. */
    attributes: Record<string, string>;
    children: MathMlNode[];
}

export type MathMlNode = MathMlElement | MathMlText;

export function el(name: MathMlName | string, children: MathMlNode[] = [], attributes: Record<string, string> = {}): MathMlElement {
    return { kind: 'element', name, attributes, children };
}

export function txt(text: string): MathMlText {
    return { kind: 'text', text };
}

export function isElement(node: MathMlNode): node is MathMlElement {
    return node.kind === 'element';
}

export function isText(node: MathMlNode): node is MathMlText {
    return node.kind === 'text';
}

/** True for `mi`/`mn`/`mo`/`mtext`: an element whose content is literal text. */
export function isToken(node: MathMlNode): boolean {
    return isElement(node) && TOKEN_NAMES.has(node.name);
}

/** The text of a token element, or `null` when the node is not a token. */
export function tokenText(node: MathMlNode): string | null {
    if (!isToken(node)) return null;
    return (node as MathMlElement).children
        .map(child => (isText(child) ? child.text : ''))
        .join('');
}

/** Build a token element, picking the name that suits the text. */
export function token(text: string): MathMlElement {
    return el(tokenName(text), [txt(text)]);
}

/** The MathML element a run of text belongs in. */
export function tokenName(text: string): MathMlName {
    if (text.length > 0 && /^[0-9.]+$/.test(text)) return 'mn';
    if (text.length === 1 && isOperatorText(text)) return 'mo';
    if (isOperatorText(text)) return 'mo';
    return 'mi';
}

/** Characters that are operators in both MathML and Calcpad. */
export function isOperatorText(text: string): boolean {
    return /^[+\-*/^_=<>≤≥≠≡±·×÷⦼∠⊕∧∨←|!%,;()\[\]{}⟨⟩∑∏∫√°\\]+$/.test(text);
}

export function cloneNode(node: MathMlNode): MathMlNode {
    if (isText(node)) return { kind: 'text', text: node.text };
    return {
        kind: 'element',
        name: node.name,
        attributes: { ...node.attributes },
        children: node.children.map(cloneNode),
    };
}

/** A key for a child-index path, for use as a DOM attribute value. */
export function pathKey(path: number[]): string {
    return path.join('.');
}

export function parsePathKey(key: string): number[] | null {
    if (key === '') return [];
    if (!/^\d+(\.\d+)*$/.test(key)) return null;
    return key.split('.').map(Number);
}

/** The node at `path`, or `null` when the path runs off the tree. */
export function nodeAt(root: MathMlNode, path: number[]): MathMlNode | null {
    let node: MathMlNode = root;
    for (const index of path) {
        if (!isElement(node)) return null;
        const child = node.children[index];
        if (child === undefined) return null;
        node = child;
    }
    return node;
}

/** The element at `path`, or `null` when the node there is text or missing. */
export function elementAt(root: MathMlNode, path: number[]): MathMlElement | null {
    const node = nodeAt(root, path);
    return node && isElement(node) ? node : null;
}

/** The parent of the node at `path`, or `null` for the root. */
export function parentOf(root: MathMlNode, path: number[]): MathMlElement | null {
    if (path.length === 0) return null;
    return elementAt(root, path.slice(0, -1));
}

/** True when two trees are structurally identical. Used to prove a round-trip is stable. */
export function equalNodes(a: MathMlNode, b: MathMlNode): boolean {
    if (isText(a) || isText(b)) return isText(a) && isText(b) && a.text === b.text;
    if (a.name !== b.name) return false;
    if (a.children.length !== b.children.length) return false;
    for (let i = 0; i < a.children.length; i++) {
        if (!equalNodes(a.children[i], b.children[i])) return false;
    }
    return true;
}

/**
 * The root the editor works with: a `<math>` wrapping one `<mrow>`.
 *
 * Collapsing the wrapper into a single `mrow` keeps every path two elements deep
 * before the expression proper, which makes "insert at the caret" a single
 * uniform operation and keeps serialization predictable.
 */
export function rootOf(children: MathMlNode[] = []): MathMlElement {
    return el('math', [el('mrow', children)], { xmlns: 'http://www.w3.org/1998/Math/MathML' });
}

/** The expression container inside a `<math>` root. */
export function expressionOf(root: MathMlElement): MathMlElement {
    const first = root.children[0];
    if (first && isElement(first) && first.name === 'mrow') return first;
    const mrow = el('mrow');
    root.children = [mrow];
    return mrow;
}
