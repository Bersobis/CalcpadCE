// A minimal, dependency-free XML parser/serializer for the MathML and OMML subset.
//
// Both formats are machine-generated and shallow, so a full XML stack would be overkill and
// would drag a DOM dependency into Node tests. This handles elements, attributes, self-closing
// tags, comments, the XML declaration and the five predefined entities — which is everything
// MathML Core and OMML use.

export interface XmlElement {
    name: string;
    attrs: Record<string, string>;
    children: XmlNode[];
}

export type XmlNode = XmlElement | string;

export function isXmlElement(node: XmlNode): node is XmlElement {
    return typeof node !== 'string';
}

const ENTITIES: Record<string, string> = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00A0',
};

export function decodeEntities(text: string): string {
    return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body: string) => {
        if (body[0] === '#') {
            const code = body[1] === 'x' || body[1] === 'X'
                ? parseInt(body.slice(2), 16)
                : parseInt(body.slice(1), 10);
            return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
        }
        return ENTITIES[body] ?? whole;
    });
}

export function encodeEntities(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export class XmlError extends Error {}

export function parseXml(source: string): XmlElement {
    const nodes = parseXmlFragment(source);
    const root = nodes.find(isXmlElement);
    if (!root) throw new XmlError('No root element');
    return root;
}

/**
 * Parse a sequence of sibling nodes. OMML fragments are emitted without a wrapper — a run
 * followed by a fraction is two roots — so callers need this rather than `parseXml`.
 */
export function parseXmlFragment(source: string): XmlNode[] {
    let i = 0;
    const n = source.length;

    const skipMisc = (): void => {
        for (;;) {
            while (i < n && /\s/.test(source[i])) i++;
            if (source.startsWith('<?', i)) { i = source.indexOf('?>', i) + 2; continue; }
            if (source.startsWith('<!--', i)) { i = source.indexOf('-->', i) + 3; continue; }
            if (source.startsWith('<!', i)) { i = source.indexOf('>', i) + 1; continue; }
            return;
        }
    };

    const readName = (): string => {
        const start = i;
        while (i < n && !/[\s/>=]/.test(source[i])) i++;
        return source.slice(start, i);
    };

    const readAttrs = (): Record<string, string> => {
        const attrs: Record<string, string> = {};
        for (;;) {
            while (i < n && /\s/.test(source[i])) i++;
            if (i >= n || source[i] === '>' || source[i] === '/') return attrs;
            const name = readName();
            while (i < n && /\s/.test(source[i])) i++;
            if (source[i] !== '=') { attrs[name] = ''; continue; }
            i++;
            while (i < n && /\s/.test(source[i])) i++;
            const quote = source[i];
            if (quote !== '"' && quote !== "'") throw new XmlError(`Unquoted attribute "${name}"`);
            i++;
            const end = source.indexOf(quote, i);
            if (end < 0) throw new XmlError(`Unterminated attribute "${name}"`);
            attrs[name] = decodeEntities(source.slice(i, end));
            i = end + 1;
        }
    };

    const readElement = (): XmlElement => {
        if (source[i] !== '<') throw new XmlError('Expected "<"');
        i++;
        const name = readName();
        const attrs = readAttrs();
        const element: XmlElement = { name, attrs, children: [] };
        while (i < n && /\s/.test(source[i])) i++;
        if (source[i] === '/') { i += 2; return element; }
        if (source[i] !== '>') throw new XmlError(`Malformed tag <${name}>`);
        i++;

        for (;;) {
            if (i >= n) throw new XmlError(`Unclosed element <${name}>`);
            if (source.startsWith('</', i)) {
                i += 2;
                readName();
                while (i < n && source[i] !== '>') i++;
                i++;
                return element;
            }
            if (source.startsWith('<!--', i)) { i = source.indexOf('-->', i) + 3; continue; }
            if (source[i] === '<') { element.children.push(readElement()); continue; }
            const end = source.indexOf('<', i);
            const text = source.slice(i, end < 0 ? n : end);
            if (text.length > 0) element.children.push(decodeEntities(text));
            i = end < 0 ? n : end;
        }
    };

    const nodes: XmlNode[] = [];
    for (;;) {
        skipMisc();
        if (i >= n) return nodes;
        if (source[i] === '<') { nodes.push(readElement()); continue; }
        const end = source.indexOf('<', i);
        const text = source.slice(i, end < 0 ? n : end);
        if (text.length > 0) nodes.push(decodeEntities(text));
        i = end < 0 ? n : end;
    }
}

export function serializeXml(node: XmlNode): string {
    if (typeof node === 'string') return encodeEntities(node);
    const attrs = Object.entries(node.attrs)
        .map(([k, v]) => (v === '' ? ` ${k}` : ` ${k}="${encodeEntities(v)}"`))
        .join('');
    if (node.children.length === 0) return `<${node.name}${attrs}/>`;
    const inner = node.children.map(serializeXml).join('');
    return `<${node.name}${attrs}>${inner}</${node.name}>`;
}

/** Strip the namespace prefix (`m:` / `w:`) so `m:f` and `f` compare equal. */
export function localName(name: string): string {
    const colon = name.indexOf(':');
    return colon < 0 ? name : name.slice(colon + 1);
}

export function findChildren(element: XmlElement, name: string): XmlElement[] {
    return element.children.filter(
        (child): child is XmlElement => isXmlElement(child) && localName(child.name) === name
    );
}

export function firstChild(element: XmlElement, name: string): XmlElement | undefined {
    return findChildren(element, name)[0];
}

export function textContent(node: XmlNode): string {
    if (typeof node === 'string') return node;
    return node.children.map(textContent).join('');
}
