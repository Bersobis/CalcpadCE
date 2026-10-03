/**
 * Minimal, dependency-free XML support.
 *
 * The transpiler runs in the browser, in the VS Code extension host and under Node
 * (tests), so `DOMParser` is not universally available and adding an XML dependency to
 * the shared library is not worth it. This module covers exactly what MathML/OMML
 * needs: elements, attributes, text and CDATA, comments, namespaces and entities.
 */

export interface XmlElement {
    readonly name: string;
    readonly attrs: Record<string, string>;
    readonly children: XmlNode[];
}

export type XmlNode = XmlElement | XmlText;

export interface XmlText {
    readonly text: string;
    readonly cdata?: boolean;
}

export function isElement(node: XmlNode): node is XmlElement {
    return (node as XmlElement).name !== undefined;
}

export function localName(el: XmlElement): string {
    const i = el.name.indexOf(':');
    return i < 0 ? el.name : el.name.slice(i + 1);
}

/** Attribute lookup ignoring any namespace prefix, so `m:val` and `val` both resolve. */
export function attr(el: XmlElement, name: string): string | undefined {
    if (el.attrs[name] !== undefined) return el.attrs[name];
    for (const key of Object.keys(el.attrs)) {
        const i = key.indexOf(':');
        if (i >= 0 && key.slice(i + 1) === name) return el.attrs[key];
    }
    return undefined;
}

export function* elements(el: XmlElement): Generator<XmlElement> {
    for (const child of el.children) if (isElement(child)) yield child;
}

export function* descendants(el: XmlElement): Generator<XmlElement> {
    for (const child of el.children) {
        if (!isElement(child)) continue;
        yield child;
        yield* descendants(child);
    }
}

export function textContent(el: XmlElement): string {
    let s = '';
    for (const child of el.children) s += isElement(child) ? textContent(child) : child.text;
    return s;
}

export function escapeXmlText(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function escapeXmlAttr(s: string): string {
    return escapeXmlText(s).replace(/"/g, '&quot;').replace(/\r?\n/g, '&#10;');
}

export function serialize(node: XmlNode, indent = 0): string {
    if (!isElement(node)) return node.cdata
        ? `<![CDATA[${node.text}]]>`
        : escapeXmlText(node.text);

    const pad = '  '.repeat(indent);
    const attrs = Object.entries(node.attrs)
        .map(([k, v]) => ` ${k}="${escapeXmlAttr(v)}"`)
        .join('');

    if (node.children.length === 0) return `${pad}<${node.name}${attrs}/>`;

    // Single text child stays inline; everything else is pretty-printed.
    const only = node.children[0];
    if (node.children.length === 1 && !isElement(only) && !only.cdata && !only.text.trim())
        return `${pad}<${node.name}${attrs}/>`;
    if (node.children.length === 1 && !isElement(only))
        return `${pad}<${node.name}${attrs}>${only.cdata ? `<![CDATA[${only.text}]]>` : escapeXmlText(only.text)}</${node.name}>`;

    const inner = node.children
        .map((c) => serialize(c, indent + 1))
        .join('\n');
    return `${pad}<${node.name}${attrs}>\n${inner}\n${pad}</${node.name}>`;
}

const NAMED_ENTITIES: Record<string, string> = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
};

export function decodeEntities(s: string): string {
    return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (m, body: string) => {
        if (body[0] === '#') {
            const code = body[1] === 'x' || body[1] === 'X'
                ? Number.parseInt(body.slice(2), 16)
                : Number.parseInt(body.slice(1), 10);
            return Number.isFinite(code) && code >= 0 && code <= 0x10ffff
                ? String.fromCodePoint(code)
                : m;
        }
        return NAMED_ENTITIES[body] ?? m;
    });
}

export class XmlParseError extends Error {
    constructor(message: string, readonly source: string, readonly index: number) {
        super(`${message} at offset ${index}`);
        this.name = 'XmlParseError';
    }
}

const NAME_START = /[A-Za-z_:]/;
const NAME_CHAR = /[A-Za-z0-9_:.\-]/;

/**
 * Tolerant but well-formedness-checking parser. Returns a synthetic root when the
 * document has more than one top-level node so callers can always walk from one root.
 */
export function parseXml(source: string): XmlElement {
    const s = source;
    let i = 0;
    const stack: XmlElement[] = [];

    const root: XmlElement = { name: '#document', attrs: {}, children: [] };
    stack.push(root);

    // Declared as a function, not an arrow const, so control-flow analysis narrows
    // after each call.
    function fail(msg: string): never {
        throw new XmlParseError(msg, s, i);
    }

    const readName = (): string => {
        if (i >= s.length || !NAME_START.test(s[i])) fail('Expected a name');
        const start = i++;
        while (i < s.length && NAME_CHAR.test(s[i])) i++;
        return s.slice(start, i);
    };

    const readAttrValue = (): string => {
        const quote = s[i];
        if (quote !== '"' && quote !== "'") fail('Expected a quoted attribute value');
        i++;
        const start = i;
        while (i < s.length && s[i] !== quote) i++;
        if (i >= s.length) fail('Unterminated attribute value');
        const raw = s.slice(start, i++);
        return decodeEntities(raw);
    };

    const skipSpace = (): void => {
        while (i < s.length && /\s/.test(s[i])) i++;
    };

    while (i < s.length) {
        const lt = s.indexOf('<', i);
        if (lt < 0) {
            const rest = s.slice(i);
            if (rest.trim()) stack[stack.length - 1].children.push({ text: decodeEntities(rest) });
            break;
        }

        if (lt > i) {
            const chunk = s.slice(i, lt);
            if (chunk.trim()) stack[stack.length - 1].children.push({ text: decodeEntities(chunk) });
            i = lt;
        }

        if (s.startsWith('<!--', i)) {
            const end = s.indexOf('-->', i);
            if (end < 0) fail('Unterminated comment');
            i = end + 3;
            continue;
        }

        if (s.startsWith('<![CDATA[', i)) {
            const end = s.indexOf(']]>', i);
            if (end < 0) fail('Unterminated CDATA section');
            stack[stack.length - 1].children.push({ text: s.slice(i + 9, end), cdata: true });
            i = end + 3;
            continue;
        }

        if (s.startsWith('<?', i)) {
            const end = s.indexOf('?>', i);
            if (end < 0) fail('Unterminated processing instruction');
            i = end + 2;
            continue;
        }

        if (s.startsWith('<!', i)) {
            // DOCTYPE and friends: skip, balancing nested brackets.
            let depth = 0;
            while (i < s.length) {
                const c = s[i];
                if (c === '[') depth++;
                else if (c === ']') depth--;
                else if (c === '>' && depth <= 0) break;
                i++;
            }
            if (i >= s.length) fail('Unterminated declaration');
            i++;
            continue;
        }

        if (s.startsWith('</', i)) {
            i += 2;
            const name = readName();
            skipSpace();
            if (s[i] !== '>') fail('Expected ">" in closing tag');
            i++;
            const open = stack.pop();
            if (!open || stack.length === 0) fail(`Unexpected closing tag </${name}>`);
            if (open.name !== name) fail(`Closing tag </${name}> does not match <${open.name}>`);
            continue;
        }

        // Opening tag.
        i++;
        const name = readName();
        const node: XmlElement = { name, attrs: {}, children: [] };
        for (;;) {
            skipSpace();
            if (i >= s.length) fail('Unterminated start tag');
            const c = s[i];
            if (c === '>' || c === '/') break;
            const attrName = readName();
            skipSpace();
            if (s[i] !== '=') fail(`Expected "=" after attribute ${attrName}`);
            i++;
            skipSpace();
            node.attrs[attrName] = readAttrValue();
        }
        stack[stack.length - 1].children.push(node);
        if (s[i] === '/') {
            i += 2; // "/>"
        } else {
            i++;
            stack.push(node);
        }
    }

    if (stack.length !== 1) throw new XmlParseError(`Unclosed element <${stack[stack.length - 1].name}>`, s, i);
    return root;
}

/** First element in document order, skipping the synthetic root. */
export function documentElement(source: string): XmlElement {
    for (const child of elements(parseXml(source))) return child;
    throw new XmlParseError('Document has no root element', source, 0);
}