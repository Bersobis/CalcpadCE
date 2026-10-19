// OMML bridge — MathML AST to and from Word's Office Math Markup Language.
//
// The writer reproduces the dialect in `Calcpad.Core/Output/XmlWriter.cs` element for element,
// so an equation authored in the editor and one rendered by the engine are indistinguishable
// inside a `.docx`. Reading is best-effort: OMML records structure, not the author's
// punctuation, so a re-read fraction comes back bracketed and the printer relies on its
// precedence rules to drop the surplus brackets.

import { MathElement, MathNode, el, elAttr, isElement, isText, mo, txt } from './model';
import { isUnitName } from './grammar';
import { parseCalcpad } from './parser';
import { printCalcpad } from './printer';
import {
    XmlElement, firstChild, findChildren, isXmlElement, localName, parseXmlFragment, textContent,
} from './xml';

// ---------------------------------------------------------------------------------------
// Writer
// ---------------------------------------------------------------------------------------

const NORMAL_TEXT = '<m:rPr><m:nor/></m:rPr>';
const UNIT_FORMAT = `${NORMAL_TEXT}<w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math" /><w:sz w:val="22" /></w:rPr>`;
const FUNC_FORMAT = `${NORMAL_TEXT}<w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math" /><w:b w:val="true" /></w:rPr>`;
const VAR_FORMAT = '<w:rPr><w:color w:val="0066DD"/></w:rPr>';
const UNIT_DIVISION = `<m:r>${NORMAL_TEXT}<w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math" /><w:sz w:val="20" /></w:rPr><m:t>\u2215</m:t></m:r>`;

interface OpRun { readonly text: string; readonly normal?: boolean; }

/** Mirrors `XmlWriter.FormatOperator`. */
const OMML_OPERATORS: Readonly<Record<string, OpRun>> = Object.freeze({
    '<': { text: '&lt;' },
    '>': { text: '&gt;' },
    '\u2264': { text: '\u2264' },
    '\u2265': { text: '\u2265' },
    '*': { text: '\u00B7' },
    '/': { text: '/' },
    '\u00F7': { text: '/' },
    '\u29BC': { text: ' mod ', normal: true },
    '\u2227': { text: ' and ', normal: true },
    '\u2228': { text: ' or ', normal: true },
    '\u2295': { text: ' xor ', normal: true },
    '|': { text: ' | ' },
    '-': { text: '-', normal: true },
});

function run(text: string, format = ''): string {
    return `<m:r>${format}<m:t>${text}</m:t></m:r>`;
}

export function toOmml(node: MathNode, options: { wrap?: boolean } = {}): string {
    const body = ommlOf(node);
    return options.wrap
        ? `<m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${body}</m:oMath>`
        : body;
}

function ommlOf(node: MathNode): string {
    if (isText(node)) return run(node.text);
    switch (node.name) {
        case 'mi': {
            const text = textOf(node);
            if (node.attrs['data-cp'] === 'func') return run(text, FUNC_FORMAT);
            if (isUnitName(text)) return run(text, UNIT_FORMAT);
            return run(text, VAR_FORMAT);
        }
        case 'mn':
            return run(textOf(node));
        case 'mo':
            return operatorRun(textOf(node));
        case 'mtext':
            return run(textOf(node), NORMAL_TEXT);
        case 'mfrac':
            return `<m:f><m:num>${ommlOf(node.children[0])}</m:num><m:den>${ommlOf(node.children[1])}</m:den></m:f>`;
        case 'msqrt':
            return `<m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/><m:e>${ommlOf(node.children[0])}</m:e></m:rad>`;
        case 'mroot':
            return `<m:rad><m:deg>${ommlOf(node.children[1])}</m:deg><m:e>${ommlOf(node.children[0])}</m:e></m:rad>`;
        case 'msup':
            return `<m:sSup><m:e>${ommlOf(node.children[0])}</m:e><m:sup>${ommlOf(node.children[1])}</m:sup></m:sSup>`;
        case 'msub':
            return `<m:sSub><m:e>${ommlOf(node.children[0])}</m:e><m:sub>${ommlOf(node.children[1])}</m:sub></m:sSub>`;
        case 'mtable':
            return `<m:m>${node.children.map((row) => ommlRow(row)).join('')}</m:m>`;
        case 'mrow':
            return ommlRowNode(node);
        default:
            return node.children.map(ommlOf).join('');
    }
}

function ommlRowNode(node: MathElement): string {
    const children = node.children;
    const first = children[0];
    const last = children[children.length - 1];
    const firstGlyph = isElement(first) && first.name === 'mo' ? textOf(first) : '';
    const lastGlyph = isElement(last) && last.name === 'mo' ? textOf(last) : '';

    if (node.attrs['data-cp'] === 'abs' && children.length === 3) {
        return delimit('|', '|', ommlOf(children[1]));
    }
    if ((firstGlyph === '(' || firstGlyph === '[') && (lastGlyph === ')' || lastGlyph === ']')) {
        const inner = children.slice(1, -1);
        const table = inner.find((child) => isElement(child) && child.name === 'mtable');
        if (table) return delimit(firstGlyph, lastGlyph, ommlOf(table));
        return delimit(firstGlyph, lastGlyph, inner.map(ommlOf).join(''));
    }
    return children.map(ommlOf).join('');
}

function delimit(begin: string, end: string, body: string): string {
    return `<m:d><m:dPr><m:begChr m:val="${begin}"/><m:endChr m:val="${end}"/></m:dPr><m:e>${body}</m:e></m:d>`;
}

function ommlRow(row: MathNode): string {
    if (!isElement(row) || row.name !== 'mtr') return `<m:mr><m:e>${ommlOf(row)}</m:e></m:mr>`;
    const cells = row.children
        .map((cell) => {
            const inner = isElement(cell) && cell.name === 'mtd' ? cell.children[0] ?? cell : cell;
            return `<m:e>${ommlOf(inner)}</m:e>`;
        })
        .join('');
    return `<m:mr>${cells}</m:mr>`;
}

function operatorRun(glyph: string): string {
    const spec = OMML_OPERATORS[glyph];
    if (spec) return run(spec.text, spec.normal ? NORMAL_TEXT : '');
    return run(glyph);
}

function textOf(node: MathElement): string {
    const child = node.children[0];
    return isText(child) ? child.text : '';
}


// ---------------------------------------------------------------------------------------
// Reader
//
// OMML records structure but not the author's punctuation: a fraction is a fraction, and the
// precedence that produced it is gone. So a container's runs are collected back into Calcpad
// text and re-parsed, which re-associates them exactly the way the engine would. Structural
// elements (`m:f`, `m:rad`, `m:sSup`, `m:d`, `m:m`) are read as structure and recursed into.
// ---------------------------------------------------------------------------------------

export function fromOmml(source: string): MathNode | null {
    let nodes;
    try {
        nodes = parseXmlFragment(source);
    } catch {
        return null;
    }
    const elements = nodes.filter(isXmlElement);
    if (elements.length === 1 && localName(elements[0].name) === 'oMath') {
        return readNodes(elements[0].children);
    }
    return readNodes(nodes);
}

function readNodes(nodes: readonly (XmlElement | string)[]): MathNode {
    const text = collectText(nodes).trim();
    if (text === '') return el('mrow', []);

    // Re-parsing the whole sequence — structure included — is what re-associates the flat runs
    // and guarantees the result is a fixed point of parse∘print.
    return parseText(text);
}

/** The Calcpad text a run sequence stands for, without parsing it yet. */
function collectText(nodes: readonly (XmlElement | string)[]): string {
    const parts: string[] = [];
    for (const node of nodes) {
        if (!isXmlElement(node)) { parts.push(node); continue; }
        if (localName(node.name) === 'r') { parts.push(runText(node)); continue; }
        const structural = readElement(node);
        parts.push(structural ? printCalcpad(structural) : '');
    }
    return parts.join('');
}

function parseText(text: string): MathNode {
    const parsed = parseCalcpad(text);
    return parsed.ok && parsed.node ? parsed.node : el('mtext', [txt(text)]);
}

function readElement(element: XmlElement): MathNode | null {
    switch (localName(element.name)) {
        case 'f':
            return el('mfrac', [container(element, 'num'), container(element, 'den')]);
        case 'rad': {
            const deg = firstChild(element, 'deg');
            const hide = deg ? firstChild(deg, 'degHide') : undefined;
            const body = container(element, 'e');
            const hasDegree = deg !== undefined && deg.children.length > 0 && !hide;
            return hasDegree
                ? elAttr('mroot', { 'data-cp': 'root' }, [body, readNodes(deg!.children)])
                : el('msqrt', [body]);
        }
        case 'sSup':
            return el('msup', [container(element, 'e'), container(element, 'sup')]);
        case 'sSub':
            return el('msub', [container(element, 'e'), container(element, 'sub')]);
        case 'sSubSup':
            return el('msubsup', [container(element, 'e'), container(element, 'sub'), container(element, 'sup')]);
        case 'd': {
            const pr = firstChild(element, 'dPr');
            const begin = (pr && childVal(pr, 'begChr')) || '(';
            const end = (pr && childVal(pr, 'endChr')) || ')';
            const inner = collectText(containerChildren(element, 'e'));
            // Calcpad renders `abs(x)` as `|x|`; the engine's own reader maps it back, so this
            // does too. A bare `|x|` is not valid Calcpad input — it is a unit target.
            if (begin === '|' && end === '|') {
                return elAttr('mrow', { 'data-cp': 'abs' }, [mo('|'), parseText(inner), mo('|')]);
            }
            return parseText(begin + inner + end);
        }
        case 'm':
            return el('mtable', findChildren(element, 'mr').map((row) =>
                el('mtr', findChildren(row, 'e').map((cell) => el('mtd', [readNodes(cell.children)])))
            ));
        case 'nary': {
            const pr = firstChild(element, 'naryPr');
            const chr = (pr && childVal(pr, 'chr')) || '\u2211';
            return el('mrow', [
                el('munderover', [mo(chr), container(element, 'sub'), container(element, 'sup')]),
                container(element, 'e'),
            ]);
        }
        case 'acc':
            return el('mover', [container(element, 'e'), mo('\u20D7')]);
        default:
            return readNodes(element.children);
    }
}

function container(element: XmlElement, name: string): MathNode {
    const child = firstChild(element, name);
    if (!child) return el('mrow', []);
    return readNodes(child.children);
}

function containerChildren(element: XmlElement, name: string): readonly (XmlElement | string)[] {
    return firstChild(element, name)?.children ?? [];
}

/** Read a child element's `m:val` — `begChr`, `endChr`, `chr` and friends are children, not attributes. */
function childVal(element: XmlElement, name: string): string | undefined {
    const child = firstChild(element, name);
    return child ? attr(child, 'val') : undefined;
}

function runText(element: XmlElement): string {
    let text = '';
    for (const child of element.children) {
        if (isXmlElement(child) && localName(child.name) === 't') text += textContent(child);
    }
    return normalizeRunText(text);
}

/** Fold the display forms OMML uses back onto the canonical Calcpad spelling. */
function normalizeRunText(text: string): string {
    return text
        .replace(/\u2215/g, '/')
        .replace(/\u2002/g, '; ')
        .replace(/\u2009/g, ' ')
        .replace(/\u00B7/g, '*')
        .replace(/ mod /g, '\u29BC')
        .replace(/ and /g, '\u2227')
        .replace(/ or /g, '\u2228')
        .replace(/ xor /g, '\u2295');
}

function attr(element: XmlElement, local: string): string | undefined {
    for (const [key, value] of Object.entries(element.attrs)) {
        if (localName(key) === local) return value;
    }
    return undefined;
}
