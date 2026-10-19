// MathML AST — the one data structure shared by parsing, rendering, editing and OMML.
//
// It is deliberately plain data (no DOM, no classes) so the whole engine is a set of
// pure functions and can run in Node for tests and corpus measurement.

export type ElementName =
    | 'math' | 'mrow' | 'mi' | 'mn' | 'mo' | 'mtext' | 'mspace'
    | 'mfrac' | 'msqrt' | 'mroot' | 'msup' | 'msub' | 'msubsup'
    | 'munder' | 'mover' | 'munderover' | 'mtable' | 'mtr' | 'mtd'
    | 'mstyle' | 'mphantom' | 'menclose' | 'semantics';

export interface MathText {
    readonly text: string;
}

export interface MathElement {
    readonly name: ElementName;
    readonly attrs: Readonly<Record<string, string>>;
    readonly children: readonly MathNode[];
}

export type MathNode = MathElement | MathText;

// A Calcpad-specific marker, carried on the operator node so the printer can reproduce
// the author's form. `imp` = the operator was juxtaposition, not written.
export const CP_IMPLICIT = 'data-cp-implicit';
export const CP_UNIT = 'data-cp-unit';

export function isElement(node: MathNode | undefined | null): node is MathElement {
    return node != null && (node as MathElement).name !== undefined;
}

export function isText(node: MathNode | undefined | null): node is MathText {
    return node != null && (node as MathText).text !== undefined;
}

/** An element with children and no attributes. */
export function el(name: ElementName, children: readonly MathNode[] = []): MathElement {
    return { name, attrs: {}, children };
}

/** An element with attributes. */
export function elAttr(name: ElementName, attrs: Record<string, string>, children: readonly MathNode[] = []): MathElement {
    return { name, attrs, children };
}

/** A text leaf. */
export function txt(text: string): MathText {
    return { text };
}

/** A leaf element (`mi`, `mn`, `mo`, `mtext`) holding a single text child. */
export function leaf(name: ElementName, text: string, attrs: Record<string, string> = {}): MathElement {
    return { name, attrs, children: [txt(text)] };
}

export function mi(text: string, attrs: Record<string, string> = {}): MathElement {
    return leaf('mi', text, attrs);
}

export function mn(text: string): MathElement {
    return leaf('mn', text);
}

export function mo(text: string, attrs: Record<string, string> = {}): MathElement {
    return leaf('mo', text, attrs);
}

export function mtext(text: string, attrs: Record<string, string> = {}): MathElement {
    return leaf('mtext', text, attrs);
}

export function mrow(...children: readonly MathNode[]): MathElement {
    return el('mrow', children);
}

/** The concatenated text of a leaf element, or `null` when it is not a single text leaf. */
export function leafText(node: MathNode): string | null {
    if (!isElement(node)) return node.text;
    if (node.children.length !== 1) return null;
    const child = node.children[0];
    return isText(child) ? child.text : null;
}

export function isEmptyRow(node: MathNode): boolean {
    return isElement(node) && node.name === 'mrow' && node.children.length === 0;
}

/** Structural equality, attributes included (shallow, key-sorted). */
export function sameTree(a: MathNode, b: MathNode): boolean {
    if (isText(a) || isText(b)) return isText(a) && isText(b) && a.text === b.text;
    if (a.name !== b.name || a.children.length !== b.children.length) return false;
    if (!sameAttrs(a.attrs, b.attrs)) return false;
    for (let i = 0; i < a.children.length; i++) if (!sameTree(a.children[i], b.children[i])) return false;
    return true;
}

function sameAttrs(a: Readonly<Record<string, string>>, b: Readonly<Record<string, string>>): boolean {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (const k of ka) if (a[k] !== b[k]) return false;
    return true;
}

/** Replace the child at `index` of `parent`, returning a new parent. */
export function withChild(parent: MathElement, index: number, child: MathNode): MathElement {
    const children = parent.children.slice();
    children[index] = child;
    return { name: parent.name, attrs: parent.attrs, children };
}

/**
 * A child-index path from the root. An empty path addresses the root itself.
 * Paths are the addressing scheme for the caret and for `data-path` in the DOM.
 */
export type Path = readonly number[];

export function nodeAtPath(root: MathNode, path: Path): MathNode | null {
    let node: MathNode = root;
    for (const index of path) {
        if (!isElement(node)) return null;
        const child = node.children[index];
        if (child === undefined) return null;
        node = child;
    }
    return node;
}

/** Replace the subtree at `path`, returning a new root. */
export function replaceAtPath(root: MathNode, path: Path, replacement: MathNode): MathNode {
    if (path.length === 0) return replacement;
    if (!isElement(root)) return root;
    const [head, ...rest] = path;
    const child = root.children[head];
    if (child === undefined) return root;
    return withChild(root, head, replaceAtPath(child, rest, replacement));
}

export function pathEquals(a: Path, b: Path): boolean {
    return a.length === b.length && a.every((v, i) => v === b[i]);
}

