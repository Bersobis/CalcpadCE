/**
 * OMML generation and parsing.
 *
 * The element shapes mirror `Calcpad.Core/Output/XmlWriter.cs` exactly — same child
 * order, same property elements and the same run formatting — so text produced here can
 * be embedded in a `.docx` next to the equations the server already renders.
 */

import { attr, descendants, elements, escapeXmlAttr, escapeXmlText, localName, parseXml, textContent } from './xml';
import type { XmlElement } from './xml';
import { astToCalcpad } from './calcpad';
import { normalize } from './mathjson';
import type { MathJSON } from './mathjson';

export const MATH_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/math';
export const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

const M = 'm';
const w = (name: string): string => `${M}:${name}`;

/** A `<m:name m:val="…"/>` property element. Returns markup, not an element object. */
const val = (name: string, v: string): string =>
    `<${w(name)} ${w('val')}="${escapeXmlAttr(v)}"/>`;

/**
 * Upright run properties. Calcpad uses `<m:nor/>`; `<m:sty m:val="p"/>` is equally valid
 * but would give one document two unit styles, so the engine's spelling is the default.
 */
let unitStyle = '<m:nor/>';

export function setUnitStyle(style: 'nor' | 'sty-p'): void {
    unitStyle = style === 'nor' ? '<m:nor/>' : '<m:sty m:val="p"/>';
}

/** `XmlWriter.FormatUnitsStatic`. */
const UNIT_FONT = '<w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math" /><w:sz w:val="22" /></w:rPr>';
/** `XmlWriter.UnitDivision` sets sz 20 where the unit run itself sets 22. */
const UNIT_DIVISION_FONT = '<w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math" /><w:sz w:val="20" /></w:rPr>';
/** `XmlWriter.FormatFunction`: upright Cambria Math, bold. */
const FUNCTION_FONT = '<w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math" /><w:b w:val="true" /></w:rPr>';

/** The fraction slash Calcpad uses between unit factors, as `XmlWriter.UnitDivision`. */
const UNIT_DIVISION = '∕';
/** The product dot Calcpad uses between unit factors, as `XmlWriter.UnitProduct`. */
const UNIT_PRODUCT = '·';

const unitProps = (): string => `<${w('rPr')}>${unitStyle}</${w('rPr')}>${UNIT_FONT}`;
const unitRun = (text: string): string => run(text, unitProps());
const unitDivisionRun = (): string =>
    run(UNIT_DIVISION, `<${w('rPr')}>${unitStyle}</${w('rPr')}>${UNIT_DIVISION_FONT}`);
const unitProductRun = (): string => run(UNIT_PRODUCT, `<${w('rPr')}>${unitStyle}</${w('rPr')}>`);
/** `XmlWriter.FormatFunction`. */
const functionRun = (text: string): string => run(text, `<${w('rPr')}>${unitStyle}</${w('rPr')}>${FUNCTION_FONT}`);
/**
 * `div` in `MathParser.Output.cs` — `FormatOperator(';')`, a bare semicolon run with no
 * trailing space. It separates function arguments, matrix-free parameter lists and the
 * statements of a `switch`. Omitting it would fuse the operands, which is the one thing
 * the reader cannot recover.
 */
const ARG_SEPARATOR = run(';');
/** `XmlWriter.opRuns[4]` — Calcpad renders an explicit `*` as a middle dot. */
const PRODUCT_RUN = run(UNIT_PRODUCT);
/** `XmlWriter.opRuns[12]` — negation is upright and carries no surrounding spaces. */
const negationRun = (): string => run('-', `<${w('rPr')}>${unitStyle}</${w('rPr')}>`);

function run(text: string, props?: string): string {
    return props
        ? `<${w('r')}>${props}<${w('t')}>${text}</${w('t')}></${w('r')}>`
        : `<${w('r')}><${w('t')}>${text}</${w('t')}></${w('r')}>`;
}



function xmlEscape(s: string): string {
    return escapeXmlText(s);
}

const runEscaped = (text: string, props?: string): string => run(xmlEscape(text), props);

/** Set while emitting inside a `Units` node, so identifiers typeset upright. */
let inUnits = false;

/**
 * Renders a MathJSON tree as the inner XML of `<m:oMath>`.
 */
export function mathJsonToOmmlBody(node: MathJSON): string {
    const n = normalize(node);

    switch (n.type) {
        case 'Number':
            return runEscaped(Object.is(n.n, -0) ? '0' : String(n.n));

        case 'Identifier':
            // Inside a unit every symbol is upright; elsewhere identifiers are italic maths.
            return inUnits ? unitRun(xmlEscape(n.sym)) : runEscaped(n.sym);

        case 'Text':
            return n.unit ? unitRun(xmlEscape(n.text)) : runEscaped(n.text);

        case 'Group':
            return delimiters(n.body.map(mathJsonToOmmlBody).join(''), '(', ')');

        case 'Delimited':
            return delimiters(n.body.map(mathJsonToOmmlBody).join(''), n.left ?? '[', n.right ?? ']');

        case 'Units':
            return unitsToOmml(n);

        case 'Frac':
            return `<${w('f')}>${wrap(w('num'), mathJsonToOmmlBody(n.num))}${wrap(w('den'), mathJsonToOmmlBody(n.den))}</${w('f')}>`;

        case 'Sqrt':
            return `<${w('rad')}>`
                + `<${w('radPr')}>${val('degHide', '1')}</${w('radPr')}>`
                + `<${w('deg')}/>`
                + wrap(w('e'), mathJsonToOmmlBody(n.radicand))
                + `</${w('rad')}>`;

        case 'Root':
            return `<${w('rad')}>`
                + wrap(w('deg'), n.index ? mathJsonToOmmlBody(n.index) : '')
                + wrap(w('e'), mathJsonToOmmlBody(n.radicand))
                + `</${w('rad')}>`;

        case 'Sup':
            return `<${w('sSup')}>${wrap(w('e'), mathJsonToOmmlBody(n.base))}${wrap(w('sup'), mathJsonToOmmlBody(n.sup))}</${w('sSup')}>`;

        case 'Sub':
            return `<${w('sSub')}>${wrap(w('e'), mathJsonToOmmlBody(n.base))}${wrap(w('sub'), mathJsonToOmmlBody(n.sub))}</${w('sSub')}>`;

        case 'Statements':
            return n.body.map(mathJsonToOmmlBody).join(ARG_SEPARATOR);

        case 'Function': {
            const name = n.subscript
                ? `<m:sSub><m:e>${functionRun(n.fn.split('_')[0])}</m:e><m:sub>${mathJsonToOmmlBody(n.subscript)}</m:sub></m:sSub>`
                : functionRun(n.fn);
            return `${name}${delimiters(n.args.map(mathJsonToOmmlBody).join(ARG_SEPARATOR), '(', ')')}`;
        }

        case 'Operator':
            return operatorToOmml(n);

        // A quoted literal is a label, not part of the equation. Calcpad's `XmlWriter`
        // renders it as an upright text run alongside the value it describes.
        case 'QuotedText':
            return runEscaped(n.text);

        // `XmlWriter.AppendSubscript` writes the dot as part of the subscript text.
        case 'Index':
            return `<${w('sSub')}>${wrap(w('e'), mathJsonToOmmlBody(n.base))}`
                + `${wrap(w('sub'), runEscaped(`.${indexText(n.index)}`))}</${w('sSub')}>`;
    }
}

/**
 * A unit expression, rendered the way `Unit.Xml` does it: each factor an upright run,
 * joined by the styled `∕` or `·` runs. It is deliberately **not** structural — emitting
 * `kN/m^2` as `<m:f>` would typeset the unit as a stacked fraction, which reads as a
 * different quantity. Exponents stay structural (`m²` is `<m:sSup>`), matching
 * `Unit.GetDimText`, and their base is upright while the exponent stays plain.
 */
function unitsToOmml(n: Extract<MathJSON, { type: 'Units' }>): string {
    const outer = inUnits;
    inUnits = true;
    try {
        return n.body.map((part) => unitsPart(part)).join('');
    } finally {
        inUnits = outer;
    }
}

function unitsPart(node: MathJSON): string {
    if (node.type === 'Operator' && node.form === 'infix' && node.args.length === 2) {
        const [a, b] = node.args;
        const join = node.op === '/' || node.op === '÷' ? unitDivisionRun()
            : node.op === '*' ? (node.implicit ? '' : unitProductRun())
                : run(` ${node.op} `);
        return `${unitsPart(a)}${join}${unitsPart(b)}`;
    }
    if (node.type === 'Units') return unitsToOmml(node);
    return mathJsonToOmmlBody(node);
}

function operatorToOmml(n: Extract<MathJSON, { type: 'Operator' }>): string {
    if (n.form === 'postfix' || n.op === '!') {
        // Calcpad renders factorial as a superscript exclamation mark.
        return `<${w('sSup')}>${wrap(w('e'), mathJsonToOmmlBody(n.args[0] ?? { type: 'Number', n: 0 }))}`
            + `${wrap(w('sup'), unitRun('!'))}</${w('sSup')}>`;
    }

    const [a, b] = n.args;
    if (n.op === '=') {
        return `${a ? mathJsonToOmmlBody(a) : ''}${run(' = ')}${b ? mathJsonToOmmlBody(b) : ''}`;
    }
    // Calcpad writes the unit target as a plain `|` run, as `XmlWriter.FormatOperator` does.
    if (n.op === '|') {
        return `${a ? mathJsonToOmmlBody(a) : ''}${run(' | ')}${b ? mathJsonToOmmlBody(b) : ''}`;
    }
    if (b === undefined) {
        // `FormatOperator(NegateChar)` is an upright, unspaced hyphen; padding it would
        // read as a binary subtraction in the exported document.
        if (n.op === '-') return `${negationRun()}${a ? mathJsonToOmmlBody(a) : ''}`;
        return `${run(` ${n.op} `)}${a ? mathJsonToOmmlBody(a) : ''}`;
    }
    // Calcpad's implicit multiplication (`2x`, `50m`) has no sign; adding one would put
    // a middle dot in the exported document that the author never wrote.
    if (n.op === '*' && n.implicit) {
        return `${mathJsonToOmmlBody(a)} ${mathJsonToOmmlBody(b)}`;
    }
    if (n.op === '*') {
        return `${mathJsonToOmmlBody(a)}${PRODUCT_RUN}${mathJsonToOmmlBody(b)}`;
    }
    return `${mathJsonToOmmlBody(a)}${run(` ${n.op} `)}${mathJsonToOmmlBody(b)}`;
}

function wrap(name: string, inner: string): string {
    return `<${name}>${inner}</${name}>`;
}

/** The index of an `x.1` element access, as the subscript text Calcpad writes. */
function indexText(index: MathJSON): string {
    return index.type === 'Number' ? String(index.n) : astToCalcpad(index);
}

function delimiters(inner: string, left: string, right: string): string {
    return `<${w('d')}>`
        + `<${w('dPr')}>${val('begChr', xmlEscape(left))}${val('endChr', xmlEscape(right))}</${w('dPr')}>`
        + wrap(w('e'), inner)
        + `</${w('d')}>`;
}

/** Wraps OMML content in a fully namespaced `<m:oMath>` root. */
export function wrapInOMath(body: string): string {
    return `<${w('oMath')} xmlns:${M}="${MATH_NS}" xmlns:w="${WORD_NS}">\n${body}\n</${w('oMath')}>`;
}

// ---------------------------------------------------------------------------
// OMML -> Calcpad
// ---------------------------------------------------------------------------

function childNamed(parent: XmlElement, name: string): XmlElement | undefined {
    for (const child of elements(parent)) if (localName(child) === name) return child;
    return undefined;
}

/** The `m:val` of a property element, or undefined when the element or value is absent. */
function propVal(parent: XmlElement | undefined, name: string): string | undefined {
    const prop = parent ? childNamed(parent, name) : undefined;
    return prop ? attr(prop, 'val') : undefined;
}

/** True for the bare operator runs Calcpad writes for the `|` unit target. */
function isUnitTargetRun(text: string): boolean {
    return /^\s*\|\s*$/.test(text);
}

/**
 * Converts an `<m:oMath>` (or any OMML fragment) back to Calcpad source text.
 *
 * `<m:f>` becomes `(a)/(b)`, `<m:rad>` becomes `sqrt(x)` or `root(x; n)`,
 * `<m:sSup>`/`<m:sSub>` become `x^n`/`x_n`, and `<m:d>` becomes `(expression)`.
 */
export function ommlNodeToCalcpad(node: XmlElement): string {
    const name = localName(node);

    switch (name) {
        case 'oMath':
        case 'oMathPara':
        case 'e':
        case 'num':
        case 'den':
        case 'deg':
        case 'sup':
        case 'sub':
        case 'lim':
        case 'fName':
            return childrenToCalcpad(node);

        case 'f': {
            const num = childNamed(node, 'num');
            const den = childNamed(node, 'den');
            return `${num ? fractionOperand(num) : ''}/${den ? fractionOperand(den) : ''}`;
        }

        case 'rad': {
            const degEl = childNamed(node, 'deg');
            const eEl = childNamed(node, 'e');
            const radicand = eEl ? ommlNodeToCalcpad(eEl) : '';
            const index = degEl && contentChildren(degEl).length > 0 ? ommlNodeToCalcpad(degEl).trim() : '';
            if (!index || propVal(childNamed(node, 'radPr'), 'degHide') === '1') {
                return `sqrt(${radicand})`;
            }
            return `root(${radicand}; ${index})`;
        }

        case 'sSup': {
            const base = childNamed(node, 'e');
            const sup = childNamed(node, 'sup');
            const b = base ? ommlNodeToCalcpad(base) : '';
            const s = sup ? ommlNodeToCalcpad(sup).trim() : '';
            return `${b}^${s}`;
        }

        case 'sSub': {
            const base = childNamed(node, 'e');
            const sub = childNamed(node, 'sub');
            const b = base ? ommlNodeToCalcpad(base) : '';
            const s = sub ? ommlNodeToCalcpad(sub).trim() : '';
            return `${b}_${s}`;
        }

        case 'd': {
            const dPr = childNamed(node, 'dPr');
            const inner = childrenToCalcpad(node);
            return `${propVal(dPr, 'begChr') ?? '('}${inner}${propVal(dPr, 'endChr') ?? ')'}`;
        }

        case 'r': {
            const text = textContent(node);
            // `∕` and `·` are upright *text* runs, not structure: `∕` is only ever a
            // unit division and `·` is Calcpad's spelling of `*` in both units and
            // expressions. Restored here so the reader emits Calcpad source.
            if (text.includes(UNIT_DIVISION)) return '/';
            if (text.includes(UNIT_PRODUCT)) return '*';
            if (isUnitTargetRun(text)) return '|';
            return text;
        }

        case 't':
            return textContent(node);

        default:
            return childrenToCalcpad(node);
    }
}

/**
 * Property elements (`m:rPr`, `m:ctrlPr`, `m:argPr`, `m:oMathParaPr`, …) carry formatting,
 * not content. Recognised by suffix rather than by a fixed list, so an element this
 * module has never heard of is still walked instead of silently dropped.
 */
function isPropertyElement(name: string): boolean {
    return name.length > 2 && name.endsWith('Pr');
}

/** The children of an OMML element that carry content rather than formatting. */
function contentChildren(node: XmlElement): XmlElement[] {
    const out: XmlElement[] = [];
    for (const child of elements(node)) {
        if (!isPropertyElement(localName(child))) out.push(child);
    }
    return out;
}

/**
 * One side of an `<m:f>`, bracketed so the parser rebuilds the same precedence.
 *
 * Bracketing unconditionally would be wrong on the second pass: `(a)/(b)` parses to a
 * bracketed numerator, which emits another `<m:d>`, so `a/b` would gain a bracket per
 * round-trip. The operand is bracketed only when it does not already render as one
 * bracketed group.
 */
function fractionOperand(e: XmlElement): string {
    const text = ommlNodeToCalcpad(e);
    return isSelfBracketed(e) ? text : `(${text})`;
}

/** True when the element already renders as a single round-bracketed group. */
function isSelfBracketed(e: XmlElement): boolean {
    const kids = contentChildren(e);
    if (kids.length !== 1 || localName(kids[0]) !== 'd') return false;
    const dPr = childNamed(kids[0], 'dPr');
    return (propVal(dPr, 'begChr') ?? '(') === '(' && (propVal(dPr, 'endChr') ?? ')') === ')';
}

function childrenToCalcpad(node: XmlElement): string {
    let out = '';
    for (const child of contentChildren(node)) {
        out += ommlNodeToCalcpad(child);
    }
    return out;
}

/** Concatenates the runs of an `<m:oMath>` tree into Calcpad text. */
export function ommlToCalcpadText(ommlXml: string): string {
    const root = parseXml(ommlXml);
    let math: XmlElement | undefined;
    for (const node of descendants(root)) {
        const ln = localName(node);
        if (ln === 'oMath' || ln === 'oMathPara') {
            math = node;
            break;
        }
    }
    if (!math) {
        for (const node of elements(root)) {
            math = node;
            break;
        }
    }
    if (!math) return '';
    return tidy(ommlNodeToCalcpad(math));
}

/** Removes spaces that the OMML run boundaries introduced around operators. */
function tidy(s: string): string {
    return s
        .replace(/\s+/g, ' ')
        .replace(/\s*([*/^_|=+<>])\s*/g, '$1')
        .replace(/\s*;\s*(?=\S)/g, '; ')
        .replace(/\s*,\s*/g, '; ')
        .replace(/\(\s+/g, '(')
        .replace(/\s+\)/g, ')')
        .trim();
}