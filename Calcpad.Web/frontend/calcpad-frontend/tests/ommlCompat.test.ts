/**
 * OMML compatibility with Calcpad's own writer.
 *
 * `Calcpad.Core/Output/XmlWriter.cs` is the authoritative OMML dialect in this
 * repository — it is what `POST /api/calcpad/docx` embeds in every `<m:oMath>`. The
 * templates below are transcribed from that file, so this suite fails if the
 * TypeScript emitter drifts away from what the engine produces.
 *
 * ## What is *not* asserted here
 *
 * Nothing in this repository routes the canvas through this emitter. `OpenXmlWriter.cs`
 * re-runs `XmlWriter.cs` on the Calcpad source text, so the exported `.docx` is produced
 * by the C# writer regardless of what the frontend does. These tests therefore guard the
 * frontend's OMML for the case where it *is* used — direct OMML emission from the canvas,
 * or round-tripping an imported `.docx` — and keep that path dialect-compatible with the
 * engine rather than merely well-formed.
 *
 * ## Whitespace
 *
 * `XmlWriter.cs` embeds newlines and indentation inside its interpolated templates.
 * Whitespace between structural OMML elements is not significant, and collapsing it
 * avoids stray text nodes, so the comparison normalises it away.
 */

import { describe, expect, it } from 'vitest';
import { calcpadToAst } from '../src/math/calcpad';
import {
    mathJsonToOmmlBody, wrapInOMath, setUnitStyle, ommlToCalcpadText, MATH_NS, WORD_NS,
} from '../src/math/omml';
import { parseXml, localName, attr, descendants, elements } from '../src/math/xml';

const omml = (source: string): string => mathJsonToOmmlBody(calcpadToAst(source));

/** Collapses the insignificant whitespace between elements. */
const flat = (s: string): string => s.replace(/>\s+</g, '><').replace(/\s+/g, ' ').trim();

describe('structural templates match XmlWriter.cs', () => {
    it('emits <m:f><m:num/><m:den/>, the same shape as FormatDivision', () => {
        const xml = flat(omml('a/b'));
        expect(xml).toContain('<m:f><m:num><m:r><m:t>a</m:t></m:r></m:num>'
            + '<m:den><m:r><m:t>b</m:t></m:r></m:den></m:f>');
    });

    it('emits a sqrt rad with radPr/degHide and an empty <m:deg/>, as FormatRoot("2") does', () => {
        const xml = flat(omml('sqrt(x)'));
        expect(xml).toBe('<m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/>'
            + '<m:e><m:r><m:t>x</m:t></m:r></m:e></m:rad>');
    });

    it('emits an n-th root rad with a populated <m:deg> and no radPr', () => {
        const xml = flat(omml('root(x; 3)'));
        expect(xml).toBe('<m:rad><m:deg><m:r><m:t>3</m:t></m:r></m:deg>'
            + '<m:e><m:r><m:t>x</m:t></m:r></m:e></m:rad>');
    });

    it('emits <m:sSup><m:e/><m:sup/>, the same shape as FormatPower', () => {
        expect(flat(omml('x^2'))).toBe('<m:sSup><m:e><m:r><m:t>x</m:t></m:r></m:e>'
            + '<m:sup><m:r><m:t>2</m:t></m:r></m:sup></m:sSup>');
    });

    it('emits <m:sSub><m:e/><m:sub/>, the same shape as FormatSubscript', () => {
        expect(flat(omml('x_1'))).toBe('<m:sSub><m:e><m:r><m:t>x</m:t></m:r></m:e>'
            + '<m:sub><m:r><m:t>1</m:t></m:r></m:sub></m:sSub>');
    });

    it('emits <m:d> with begChr/endChr, the same shape as Brackets', () => {
        expect(flat(omml('(x)'))).toBe('<m:d><m:dPr><m:begChr m:val="("/><m:endChr m:val=")"/></m:dPr>'
            + '<m:e><m:r><m:t>x</m:t></m:r></m:e></m:d>');
    });

    it('emits bare runs as <m:r><m:t>, the same shape as Run(content)', () => {
        expect(flat(omml('x'))).toBe('<m:r><m:t>x</m:t></m:r>');
    });
});

describe('operator and separator runs match XmlWriter.cs', () => {
    it('renders an explicit * as the middle dot FormatOperator(\'*\') returns', () => {
        // XmlWriter.opRuns[4] is Run("·"). A literal ` * ` run would be a different
        // glyph from every other multiplication Calcpad ever writes.
        expect(flat(omml('a*b'))).toBe(
            '<m:r><m:t>a</m:t></m:r><m:r><m:t>·</m:t></m:r><m:r><m:t>b</m:t></m:r>');
    });

    it('separates function arguments with the bare semicolon `div` renders', () => {
        // MathParser.Output.cs joins arguments with writer.FormatOperator(';'), which
        // XmlWriter answers with Run(";") — no trailing space. Emitting no separator at
        // all would fuse the operands, and the reader could not tell them apart again.
        expect(flat(omml('stress(P; A)'))).toContain('<m:r><m:t>;</m:t></m:r>');
    });

    it('separates the statements of a line with the same bare semicolon', () => {
        expect(flat(omml('x = 1; y = 2'))).toContain('<m:r><m:t>;</m:t></m:r>');
    });

    it('marks the function name bold upright, as FormatFunction does', () => {
        // XmlWriter.FormatFunction: NormalText + Cambria Math + <w:b w:val="true"/>.
        const xml = flat(omml('stress(P)'));
        expect(xml).toContain('<m:rPr><m:nor/></m:rPr><w:rPr><w:rFonts w:ascii="Cambria Math"'
            + ' w:hAnsi="Cambria Math" /><w:b w:val="true" /></w:rPr>');
    });

    it('renders negation as the upright unspaced hyphen opRuns[12] holds', () => {
        const xml = flat(omml('-x'));
        expect(xml).toContain('<m:rPr><m:nor/></m:rPr><m:t>-</m:t>');
        expect(xml).not.toContain('<m:t> - </m:t>');
    });

    it('sizes the unit division run at 20, where the unit run itself is 22', () => {
        // XmlWriter.UnitDivision sets sz 20; FormatUnitsStatic sets 22.
        const xml = flat(omml('10|kN/m'));
        expect(xml).toContain('<w:sz w:val="20" />');
    });

    it('escapes a delimiter that would otherwise break out of its attribute', () => {
        // A `"` inside begChr has to be escaped or the whole `<m:d>` is malformed.
        const xml = mathJsonToOmmlBody({ type: 'Delimited', body: [{ type: 'Number', n: 1 }], left: '"', right: '"' });
        expect(xml).toContain('m:begChr m:val="&quot;"');
        expect(() => parseXml(wrapInOMath(xml))).not.toThrow();
    });

    it('keeps a property element of an unfamiliar kind out of the read-back text', () => {
        // `m:oMathParaPr` and friends are formatting; a name-based rule copes with
        // elements this module has never seen, an allow-list would not.
        const omml = '<m:oMath xmlns:m="' + MATH_NS + '">'
            + '<m:oMathParaPr><m:jc m:val="left"/></m:oMathParaPr>'
            + '<m:r><m:t>x</m:t></m:r></m:oMath>';
        expect(ommlToCalcpadText(omml)).toBe('x');
    });
});

describe('unit runs match XmlWriter.cs', () => {
    it('marks unit text upright the way Calcpad does, with <m:nor/>', () => {
        // XmlWriter.NormalText is `<m:rPr><m:nor/></m:rPr>`. `<m:sty m:val="p"/>` is
        // also valid OMML for upright text, but mixing the two in one document gives
        // two different unit styles for the same kind of run.
        const xml = flat(omml('35cm'));
        expect(xml).toContain('<m:rPr><m:nor/></m:rPr>');
    });

    it('sets the Cambria Math font Calcpad applies to units', () => {
        const xml = flat(omml('35cm'));
        expect(xml).toContain('<w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math" />');
    });

    it('renders a unit division as the styled U+2215 slash, not a stacked fraction', () => {
        // Unit.Xml builds `kN∕m²` as text. A <m:f> here would turn a unit into a
        // fraction, which changes what the document says.
        const xml = flat(omml('10|kN/m^2'));
        expect(xml).not.toContain('<m:f>');
        expect(xml).toContain('∕');
    });

    it('renders an attached single-symbol unit without a division sign', () => {
        const xml = flat(omml('50m'));
        expect(xml).toContain('m');
        expect(xml).not.toContain('∕');
    });

    it('can switch to the <m:sty m:val="p"/> spelling Word itself writes', () => {
        // Both forms mean "upright". `<m:nor/>` is the default because it is what
        // XmlWriter.cs emits, so a canvas-authored equation and an engine-rendered one
        // look identical in the same document.
        setUnitStyle('sty-p');
        try {
            const xml = flat(omml('35cm'));
            expect(xml).toContain('<m:rPr><m:sty m:val="p"/></m:rPr>');
            expect(xml).not.toContain('<m:nor/>');
            // Negation and the unit division are upright too, and must follow the switch
            // rather than the value that happened to be set when the module loaded.
            expect(flat(omml('-x'))).toContain('<m:sty m:val="p"/>');
            expect(flat(omml('10|kN/m'))).toContain('<m:sty m:val="p"/>');
        } finally {
            setUnitStyle('nor');
        }
        expect(flat(omml('35cm'))).toContain('<m:nor/>');
    });
});

describe('the <m:oMath> wrapper', () => {
    it('declares the namespaces OpenXmlWriter.cs declares', () => {
        const doc = wrapInOMath('<m:r><m:t>x</m:t></m:r>');
        expect(doc).toContain(`xmlns:m="${MATH_NS}"`);
        expect(doc).toContain(`xmlns:w="${WORD_NS}"`);
    });

    it('produces parseable XML for every sample', () => {
        const samples = [
            'x = 5', 'y = x^2 + 2*x - 1', 'A = 0.01m^2', 's_1 = 50m',
            'V = s_1/t_1|km/h', 'M = w*L^2/8', 'z = root(x; 3)', 'q = sqrt(x^2 + y^2)',
            'x = 1; y = 2', '[1; 2; 3]', 'stress = stress(P; A)|MPa',
        ];
        for (const s of samples) {
            const doc = wrapInOMath(mathJsonToOmmlBody(calcpadToAst(s)));
            expect(() => parseXml(doc), `${s} produced malformed XML`).not.toThrow();
        }
    });
});

describe('reader/writer symmetry on Calcpad constructs', () => {
    const roundTrip = (source: string): string =>
        ommlToCalcpadText(wrapInOMath(mathJsonToOmmlBody(calcpadToAst(source))));

    // Exact expected strings, not "looks non-empty". Three transformations are part of
    // the contract rather than tolerated noise, because OMML carries structure Calcpad
    // source spells with operators:
    //
    //  - `<m:f>` and `<m:d>` expand to their Calcpad delimiters, so `a/b` reads back as
    //    `(a)/(b)` and `(x + 1)/(y - 1)` as `(x+1)/(y - 1)`. Parenthesising a fraction
    //    operand is what the parser needs to rebuild the same precedence, so this is
    //    required, not cosmetic — and an operand that is already bracketed is left
    //    alone, or `a/b` would gain a bracket on every pass.
    //  - The upright `∕`/`·` runs of `XmlWriter.UnitDivision`/`UnitProduct` read back as
    //    `/` and `*`, and the upright `·` of `FormatOperator('*')` likewise.
    //  - Spacing around an operator is dropped, so `x = 5` reads back as `x=5`.
    it.each([
        ['a/b', '(a)/(b)'],
        ['sqrt(x)', 'sqrt(x)'],
        ['root(x; 3)', 'root(x; 3)'],
        ['x^2', 'x^2'],
        ['x_1', 'x_1'],
        ['(x)', '(x)'],
        ['(x + 1)/(y - 1)', '(x+1)/(y - 1)'],
        ['50m', '50m'],
        ['35cm', '35cm'],
        ['10|kN/m^2', '10|kN/m^2'],
        ['x = 5', 'x=5'],
        // An explicit `*` is a `·` run in the document, so it reads back as `*`.
        ['a*b', 'a*b'],
        // Arguments keep the separator `FormatOperator(';')` puts between them.
        ['stress(P; A)', 'stress(P; A)'],
    ])('%s reads back as %s', (source, expected) => {
        expect(roundTrip(source)).toBe(expected);
    });

    it('re-parses what it read back into the same AST as the original source', () => {
        // The stronger property for the constructs whose structure OMML records one-for-one.
        // Source offsets are stripped because they index the input string, not the expression.
        const shape = (source: string): string =>
            JSON.stringify(calcpadToAst(source), (key, value) => (key === 'source' ? undefined : value));

        for (const source of ['50m', '10|kN/m^2', 'x = 5', 'a*b', 'stress(P; A)', 'sqrt(x)', 'root(x; 3)']) {
            const read = roundTrip(source);
            expect(read.length, source).toBeGreaterThan(0);
            expect(shape(read), `${source} -> ${read}`).toBe(shape(source));
        }
    });

    it('settles after one pass, including for the fractions that gain brackets', () => {
        // `<m:f>` has no way to say whether the author had bracketed the operand, so the
        // reader brackets both sides to rebuild the precedence. That is the one documented
        // asymmetry; it must at least be a fixed point rather than drifting per pass.
        for (const source of ['a/b', '(x + 1)/(y - 1)', 'a*b', '10|kN/m^2', 'x = 1; y = 2']) {
            const once = roundTrip(source);
            expect(roundTrip(once), `${source} -> ${once}`).toBe(once);
        }
    });
});

describe('structural sanity against a real OMML shape', () => {
    it('parses a fraction back into num and den', () => {
        const doc = parseXml(wrapInOMath(mathJsonToOmmlBody(calcpadToAst('a/b'))));
        // `parseXml` returns a synthetic `#document` root whose children include the
        // whitespace between the wrapper's tags, so walk rather than index.
        const oMath = [...descendants(doc)].find((e) => localName(e) === 'oMath');
        expect(oMath).toBeDefined();
        const f = [...descendants(oMath!)].find((e) => localName(e) === 'f');
        expect(f).toBeDefined();
        const kids = [...elements(f!)].map(localName);
        expect(kids).toEqual(['num', 'den']);
    });

    it('reads the degHide flag back', () => {
        const doc = parseXml(wrapInOMath(mathJsonToOmmlBody(calcpadToAst('sqrt(x)'))));
        const degHide = [...descendants(doc)].find((e) => localName(e) === 'degHide');
        expect(degHide).toBeDefined();
        expect(attr(degHide!, 'val')).toBe('1');
    });
});