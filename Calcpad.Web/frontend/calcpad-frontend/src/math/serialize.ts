// MathML renderer — the AST to native MathML.
//
// Rendering is delegated to the browser's own MathML Core implementation, so there is no
// layout engine, no font-metrics table and no per-equation editor instance here. The AST is
// presentation-neutral; this module is where Calcpad's display conventions are applied
// (`*` shows as `·`, `⦼` as `mod`, units and function names upright).

import { MathElement, MathNode, isElement, isText, leafText } from './model';

import { XmlElement } from './xml';

export const MATHML_NS = 'http://www.w3.org/1998/Math/MathML';

/** Attribute carrying the child-index path back to the AST node. */
export const PATH_ATTR = 'data-cp-path';

const MO_DISPLAY: Readonly<Record<string, string>> = Object.freeze({
    '*': '\u00B7',
    '\u29BC': 'mod',
    '\u2227': 'and',
    '\u2228': 'or',
    '\u2295': 'xor',
});

/** Display text for an `mo`, applying Calcpad's conventions. */
export function moDisplay(glyph: string): string {
    return MO_DISPLAY[glyph] ?? glyph;
}

function displayText(node: MathElement): string {
    const text = leafText(node) ?? '';
    if (node.attrs['data-cp'] === 'label') {
        const first = text[0];
        if ((first === "'" || first === '"') && text.length >= 2 && text.endsWith(first)) {
            return text.slice(1, -1);
        }
    }
    return text;
}

// ---------------------------------------------------------------------------------------
// String form (Node-safe)
// ---------------------------------------------------------------------------------------

export function toMathMlString(node: MathNode, options: { paths?: boolean } = {}): string {
    const element = toMathMlElement(node, options, []);
    return serializeXmlShallow(element);
}

export function toMathMlDocument(node: MathNode, options: { paths?: boolean } = {}): string {
    return `<math xmlns="${MATHML_NS}" display="block">${toMathMlString(node, options)}</math>`;
}

export function toMathMlElement(
    node: MathNode,
    options: { paths?: boolean },
    path: number[],
    unit = false
): XmlElement {
    const attrs: Record<string, string> = {};
    if (options.paths) attrs[PATH_ATTR] = path.join('.');

    if (isText(node)) return { name: 'mtext', attrs, children: [node.text] };

    switch (node.name) {
        case 'mi':
            return { name: 'mi', attrs: { ...attrs, ...identifierAttrs(node, unit) }, children: [displayText(node)] };
        case 'mn':
            return { name: 'mn', attrs, children: [displayText(node)] };
        case 'mo': {
            const glyph = leafText(node) ?? '';
            return { name: 'mo', attrs: { ...attrs, ...operatorAttrs(glyph) }, children: [moDisplay(glyph)] };
        }
        case 'mtext':
            return { name: 'mtext', attrs, children: [displayText(node)] };
        case 'msub': {
            const base = toMathMlElement(node.children[0], options, [...path, 0], unit);
            const sub = toMathMlElement(node.children[1], options, [...path, 1], true);
            return { name: 'msub', attrs, children: [base, { ...sub, attrs: { ...sub.attrs, mathvariant: 'normal' } }] };
        }
        case 'msup':
            return binary('msup', node, options, path, unit);
        case 'mfrac':
            return binary('mfrac', node, options, path, unit);
        case 'msqrt':
            return unary('msqrt', node, options, path, unit);
        case 'mroot':
            return binary('mroot', node, options, path, unit);
        case 'mtable':
            return {
                name: 'mtable',
                attrs,
                children: node.children.map((row, i) => rowElement(row, options, [...path, i])),
            };
        case 'mrow': {
            // The right-hand side of a unit target (`x|kN/m^2`) is a unit expression, so every
            // name in it renders upright — the one place the AST alone carries the information.
            if (isUnitTarget(node)) {
                const children = node.children.map((child, i) =>
                    toMathMlElement(child, options, [...path, i], i === 2 || unit)
                );
                return { name: 'mrow', attrs, children };
            }
            const children = node.children.map((child, i) => toMathMlElement(child, options, [...path, i], unit));
            return { name: 'mrow', attrs, children };
        }
        default:
            return {
                name: node.name,
                attrs,
                children: node.children.map((child, i) => toMathMlElement(child, options, [...path, i], unit)),
            };
    }
}

function isUnitTarget(node: MathElement): boolean {
    return node.children.length === 3
        && isElement(node.children[1]) && node.children[1].name === 'mo'
        && leafText(node.children[1]) === '|';
}

function rowElement(node: MathNode, options: { paths?: boolean }, path: number[]): XmlElement {
    const rowAttrs: Record<string, string> = options.paths ? { [PATH_ATTR]: path.join('.') } : {};
    if (!isElement(node)) {
        return { name: 'mtr', attrs: rowAttrs, children: [{ name: 'mtd', attrs: {}, children: [node.text] }] };
    }
    return {
        name: 'mtr',
        attrs: rowAttrs,
        children: node.children.map((cell, i) => {
            const cellAttrs: Record<string, string> = options.paths ? { [PATH_ATTR]: [...path, i].join('.') } : {};
            const inner = isElement(cell) && cell.name === 'mtd' ? cell.children[0] ?? cell : cell;
            return { name: 'mtd', attrs: cellAttrs, children: [toMathMlElement(inner, options, [...path, i, 0])] };
        }),
    };
}

function binary(name: string, node: MathElement, options: { paths?: boolean }, path: number[], unit = false): XmlElement {
    return {
        name,
        attrs: { ...(options.paths ? { [PATH_ATTR]: path.join('.') } : {}), ...node.attrs },
        children: [
            toMathMlElement(node.children[0], options, [...path, 0], unit),
            toMathMlElement(node.children[1], options, [...path, 1], unit),
        ],
    };
}

function unary(name: string, node: MathElement, options: { paths?: boolean }, path: number[], unit = false): XmlElement {
    return {
        name,
        attrs: { ...(options.paths ? { [PATH_ATTR]: path.join('.') } : {}) },
        children: [toMathMlElement(node.children[0], options, [...path, 0], unit)],
    };
}

/**
 * A name renders upright only when the AST says so: a function call, or anything inside a unit
 * target. Styling every unit *symbol* upright would mis-render `V`, `s`, `t` and `h`, which are
 * variables far more often than they are units — the engine knows the difference and the
 * client does not, so the client declines to guess.
 */
function identifierAttrs(node: MathElement, unit: boolean): Record<string, string> {
    if (node.attrs['data-cp'] === 'func' || unit) return { mathvariant: 'normal' };
    return {};
}

function operatorAttrs(glyph: string): Record<string, string> {
    if (glyph === '|') return { lspace: '0.12em', rspace: '0.12em' };
    if (glyph === '!' || glyph === '\u2220') return { lspace: '0', rspace: '0' };
    return {};
}

// Minimal serializer kept local so `serialize.ts` has no dependency on the XML module's parser.
function serializeXmlShallow(element: XmlElement): string {
    const attrs = Object.entries(element.attrs)
        .map(([k, v]) => ` ${k}="${escapeAttr(v)}"`)
        .join('');
    if (element.children.length === 0) return `<${element.name}${attrs}/>`;
    const inner = element.children
        .map((child) => (typeof child === 'string' ? escapeText(child) : serializeXmlShallow(child)))
        .join('');
    return `<${element.name}${attrs}>${inner}</${element.name}>`;
}

function escapeText(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(text: string): string {
    return escapeText(text).replace(/"/g, '&quot;');
}

// DOM form (browser) — used by the editor so a click maps back to an AST path.
//
// The DOM is built from the *same* `XmlElement` tree the string form uses, so the two cannot
// drift; there is exactly one place that decides how a node is presented.

export function renderMathMl(node: MathNode, doc: Document): Element {
    const math = doc.createElementNS(MATHML_NS, 'math');
    math.setAttribute('display', 'block');
    appendXml(math, toMathMlElement(node, { paths: true }, []), doc);
    return math;
}

export function appendXml(parent: Element, element: XmlElement, doc: Document): void {
    const node = doc.createElementNS(MATHML_NS, element.name);
    for (const [name, value] of Object.entries(element.attrs)) node.setAttribute(name, value);
    for (const child of element.children) {
        if (typeof child === 'string') node.appendChild(doc.createTextNode(child));
        else appendXml(node, child, doc);
    }
    parent.appendChild(node);
}
