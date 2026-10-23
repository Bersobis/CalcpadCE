// OMML compatibility.
//
// The writer is pinned to `Calcpad.Core/Output/XmlWriter.cs` by exact string, because a second
// dialect that merely "looks right" is how one document ends up with two different unit styles.
// Reading is asserted by fixed point: re-reading what we wrote must not change the meaning.

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { parseCalcpad } from '../../src/math/parser';
import { printCalcpad } from '../../src/math/printer';
import { sameTree } from '../../src/math/model';
import { fromOmml, toOmml } from '../../src/math/omml';

const VAR = '<w:rPr><w:color w:val="0066DD"/></w:rPr>';
const UNIT = '<m:rPr><m:nor/></m:rPr><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math" /><w:sz w:val="22" /></w:rPr>';
const FUNC = '<m:rPr><m:nor/></m:rPr><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math" /><w:b w:val="true" /></w:rPr>';
const NOR = '<m:rPr><m:nor/></m:rPr>';

const omml = (source: string): string => toOmml(parseCalcpad(source).node!);

test('a fraction is m:f with m:num and m:den', () => {
    assert.equal(
        omml('p/q'),
        `<m:f><m:num><m:r>${VAR}<m:t>p</m:t></m:r></m:num><m:den><m:r>${VAR}<m:t>q</m:t></m:r></m:den></m:f>`
    );
});

test('a square root hides its degree, exactly like FormatRoot("2")', () => {
    assert.equal(
        omml('sqrt(x)'),
        `<m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/><m:e><m:r>${VAR}<m:t>x</m:t></m:r></m:e></m:rad>`
    );
});

test('an n-th root shows its degree', () => {
    assert.equal(
        omml('root(x; 3)'),
        `<m:rad><m:deg><m:r><m:t>3</m:t></m:r></m:deg><m:e><m:r>${VAR}<m:t>x</m:t></m:r></m:e></m:rad>`
    );
});

test('a power is m:sSup', () => {
    assert.equal(
        omml('x^2'),
        `<m:sSup><m:e><m:r>${VAR}<m:t>x</m:t></m:r></m:e><m:sup><m:r><m:t>2</m:t></m:r></m:sup></m:sSup>`
    );
});

test('a subscript is m:sSub — Calcpad renders `x_1` as a subscript', () => {
    assert.equal(
        omml('x_1'),
        `<m:sSub><m:e><m:r>${VAR}<m:t>x</m:t></m:r></m:e><m:sub><m:r><m:t>1</m:t></m:r></m:sub></m:sSub>`
    );
});

test('a unit target renders the unit upright and keeps the separator', () => {
    const output = omml('10|kN');
    assert.ok(output.startsWith('<m:r><m:t>10</m:t></m:r>'), output);
    assert.ok(output.includes('<m:r><m:t> | </m:t></m:r>'), output);
    assert.ok(output.includes(`<m:r>${UNIT}<m:t>kN</m:t></m:r>`), output);
});

test('an attached unit renders upright', () => {
    assert.ok(omml('50m').includes(`<m:r>${UNIT}<m:t>m</m:t></m:r>`));
});

test('a function name is bold upright, like FormatFunction', () => {
    assert.ok(omml('sin(x)').includes(`<m:r>${FUNC}<m:t>sin</m:t></m:r>`));
});

test('multiplication renders as the middle dot, not an asterisk', () => {
    assert.equal(omml('a*b').includes('<m:t>\u00B7</m:t>'), true);
    assert.equal(omml('a*b').includes('<m:t>*</m:t>'), false);
});

test('modulo, and, or and xor use the spelled-out normal-text runs', () => {
    assert.ok(omml('a\u29BCb').includes(`<m:r>${NOR}<m:t> mod </m:t></m:r>`));
    assert.ok(omml('a\u2227b').includes(`<m:r>${NOR}<m:t> and </m:t></m:r>`));
    assert.ok(omml('a\u2228b').includes(`<m:r>${NOR}<m:t> or </m:t></m:r>`));
    assert.ok(omml('a\u2295b').includes(`<m:r>${NOR}<m:t> xor </m:t></m:r>`));
});

test('a matrix is m:d wrapping m:m with m:mr rows', () => {
    const output = omml('[1; 2|3; 4]');
    assert.ok(output.includes('<m:dPr><m:begChr m:val="["/><m:endChr m:val="]"/></m:dPr>'), output);
    assert.ok(output.includes('<m:m>'), output);
    assert.equal((output.match(/<m:mr>/g) ?? []).length, 2, output);
});

test('the wrapper carries both namespaces', () => {
    const wrapped = toOmml(parseCalcpad('a/b').node!, { wrap: true });
    assert.ok(wrapped.startsWith('<m:oMath '));
    assert.ok(wrapped.includes('officeDocument/2006/math'));
    assert.ok(wrapped.includes('wordprocessingml/2006/main'));
});

const ROUND_TRIP = [
    'x = 5', 'a/b', 'x^2', 'x_1', 'sqrt(x)', 'root(x; 3)', 'abs(x)', 'sin(x)',
    '10|kN/m^2', '50m', 'a*b', 'stress(P; A)', 'a - b', '-a', '[1; 2; 3]', '[1; 2|3; 4]',
];

test('re-reading our own OMML is a fixed point of parse∘print', () => {
    for (const source of ROUND_TRIP) {
        const original = parseCalcpad(source).node!;
        const back = fromOmml(toOmml(original));
        assert.ok(back, `reader returned null for ${source}`);
        const text = printCalcpad(back!);
        const reparsed = parseCalcpad(text);
        assert.ok(reparsed.ok, `re-parse failed for ${source} -> ${text}`);
        assert.ok(sameTree(back!, reparsed.node!), `not a fixed point for ${source} -> ${text}`);
    }
});

test('reading a fraction rebuilds the brackets the OMML lost', () => {
    const back = fromOmml('<m:f><m:num><m:r><m:t>a</m:t></m:r></m:num><m:den><m:r><m:t>b</m:t></m:r></m:den></m:f>')!;
    assert.equal(printCalcpad(back), 'a/b');
});

test('`|x|` reads back as abs(x), the spelling Calcpad accepts', () => {
    const back = fromOmml('<m:d><m:dPr><m:begChr m:val="|"/><m:endChr m:val="|"/></m:dPr><m:e><m:r><m:t>x</m:t></m:r></m:e></m:d>')!;
    assert.equal(printCalcpad(back), 'abs(x)');
});

test('an engine-shaped oMath wrapper is unwrapped', () => {
    const wrapped = '<m:oMath xmlns:m="x" xmlns:w="y"><m:r><m:t>a</m:t></m:r></m:oMath>';
    assert.equal(printCalcpad(fromOmml(wrapped)!), 'a');
});

test('malformed XML yields null rather than throwing', () => {
    assert.equal(fromOmml('<m:f><m:num>'), null);
});
