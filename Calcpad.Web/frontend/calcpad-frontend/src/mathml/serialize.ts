/**
 * MathML AST → markup. One direction of the editor's model, kept separate from
 * parsing so a change to one can never quietly change the other.
 */

import type { MathMlElement, MathMlNode } from './ast';
import { isText, pathKey } from './ast';

function escapeText(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttribute(value: string): string {
    return escapeText(value).replace(/"/g, '&quot;');
}

function openTag(node: MathMlElement, extra?: string): string {
    let tag = '<' + node.name;
    for (const [name, value] of Object.entries(node.attributes)) {
        tag += ` ${name}="${escapeAttribute(value)}"`;
    }
    if (extra) tag += ' ' + extra;
    return tag + '>';
}

/**
 * Serialize to a MathML string.
 *
 * Elements always get an explicit close tag — never `/>`. The markup is injected
 * into an HTML document, and an HTML parser only accepts self-closing syntax
 * inside foreign content when it recognises the namespace; spelling the close tag
 * out is unambiguous everywhere.
 */
export function serializeMathMl(node: MathMlNode): string {
    if (isText(node)) return escapeText(node.text);
    return openTag(node) + node.children.map(serializeMathMl).join('') + `</${node.name}>`;
}

/**
 * Serialize with a `data-path` on every element, the child-index path that
 * addresses it in the AST. The editor reads it back off a click target to turn a
 * DOM position into a caret anchor, which is cheaper and steadier than walking
 * the two trees side by side.
 */
export function serializeWithPaths(node: MathMlNode, path: number[] = []): string {
    if (isText(node)) return escapeText(node.text);
    const body = node.children
        .map((child, index) => serializeWithPaths(child, [...path, index]))
        .join('');
    return openTag(node, `data-path="${pathKey(path)}"`) + body + `</${node.name}>`;
}
