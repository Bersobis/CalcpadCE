/**
 * MathML markup → AST. The inverse of `serialize`, and the only place the editor
 * touches the DOM parser.
 *
 * It is deliberately tolerant: an element it does not model is kept as an
 * element with its own name, attributes and children, so opening a document can
 * never silently discard part of an expression. Deciding whether a line is
 * *editable* is a separate question, answered by the Calcpad bridge.
 */

import type { MathMlElement, MathMlNode } from './ast';
import { el, isElement, txt } from './ast';

function elementFrom(dom: Element): MathMlElement {
    const attributes: Record<string, string> = {};
    for (let i = 0; i < dom.attributes.length; i++) {
        const attribute = dom.attributes[i];
        // `data-path` is the editor's own annotation, not part of the maths.
        if (attribute.name === 'data-path') continue;
        attributes[attribute.name] = attribute.value;
    }

    const children: MathMlNode[] = [];
    for (let i = 0; i < dom.childNodes.length; i++) {
        const child = dom.childNodes[i];
        if (child.nodeType === 3) {
            const text = child.nodeValue ?? '';
            // Whitespace between elements is insignificant in MathML, and our own
            // serializer never emits it, so dropping it keeps the AST canonical.
            if (text.trim() !== '') children.push(txt(text));
        } else if (child.nodeType === 1) {
            children.push(elementFrom(child as Element));
        }
    }

    return el(dom.tagName.toLowerCase(), children, attributes);
}

/** Parse MathML into an AST. Returns `null` when there is no `<math>` to read. */
export function parseMathMl(markup: string): MathMlElement | null {
    if (typeof DOMParser === 'undefined') return null;
    const doc = new DOMParser().parseFromString(markup, 'text/html');
    const math = doc.querySelector('math');
    return math ? elementFrom(math) : null;
}

/** Parse an expression fragment (no surrounding `<math>`) into a `<math>` root. */
export function parseExpression(markup: string): MathMlElement | null {
    return parseMathMl(`<math xmlns="http://www.w3.org/1998/Math/MathML">${markup}</math>`);
}

/** True when the tree contains an element the editor does not model. */
export function hasUnmodelledElement(node: MathMlNode, known: Set<string>): boolean {
    if (!isElement(node)) return false;
    if (!known.has(node.name)) return true;
    return node.children.some(child => hasUnmodelledElement(child, known));
}
