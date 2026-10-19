// Round-trip fidelity: Calcpad text → MathML AST → Calcpad text → AST must be a fixed point.
//
// The property asserted is AST equality, not text equality: the printer canonicalises
// whitespace, so `2*x` prints as `2 * x` — the same tree, which is what "meaning preserved"
// means here and what the editability gate relies on.

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { parseCalcpad } from '../../src/math/parser';
import { printCalcpad } from '../../src/math/printer';
import { sameTree } from '../../src/math/model';
import { classifyEdit } from '../../src/math/gate';

const CONSTRUCTS = [
    'x = 5',
    'a = 0.01m^2',
    'V = s_1/t_1|km/h',
    '2x',
    '2*x',
    'a/b',
    'a/(b+c)',
    '(a+b)/c',
    'a/b*c',
    'a/b/c',
    'a^b^c',
    '(a^b)^c',
    'x^2',
    '-2^2',
    '-(2x)',
    'sqrt(x)',
    'root(x; 3)',
    'cbrt(x)',
    'abs(x)',
    'sin(x)',
    'stress(P; A)',
    '[1; 2; 3]',
    '[1; 2|3; 4]',
    '10|kN/m^2',
    '50m',
    '7\\2',
    '7\u29BC2',
    '5!',
    '3 - 2i',
    "1'text'",
    'find_eq',
    'A_s = 84',
    'M_a = M/l*a',
    'z = 3\u222045\u00B0',
    'a \u2190 5',
    'x \u2264 y',
    'x != y',
    'a && b',
    'V_Rd_c',
    'B_0,0',
    'q = 7\u00F72',
    'r = 7\u22272',
    'n = 5!',
];

test('every construct survives parse → print → parse unchanged', () => {
    for (const source of CONSTRUCTS) {
        const first = parseCalcpad(source);
        assert.ok(first.ok, `parse failed for ${source}: ${first.error?.message}`);
        const printed = printCalcpad(first.node!);
        const second = parseCalcpad(printed);
        assert.ok(second.ok, `re-parse failed for ${source} -> ${printed}: ${second.error?.message}`);
        assert.ok(sameTree(first.node!, second.node!), `tree drifted for ${source} -> ${printed}`);
    }
});

test('a second round-trip is a no-op (fixed point)', () => {
    for (const source of CONSTRUCTS) {
        const once = printCalcpad(parseCalcpad(source).node!);
        const twice = printCalcpad(parseCalcpad(once).node!);
        assert.equal(twice, once, `not a fixed point for ${source}`);
    }
});

test('C-style shortcuts fold onto the canonical glyph', () => {
    assert.equal(printCalcpad(parseCalcpad('x <= y').node!), 'x \u2264 y');
    assert.equal(printCalcpad(parseCalcpad('x >= y').node!), 'x \u2265 y');
    assert.equal(printCalcpad(parseCalcpad('x == y').node!), 'x \u2261 y');
    assert.equal(printCalcpad(parseCalcpad('x != y').node!), 'x \u2260 y');
    assert.equal(printCalcpad(parseCalcpad('a && b').node!), 'a \u2227 b');
    assert.equal(printCalcpad(parseCalcpad('a || b').node!), 'a \u2228 b');
    assert.equal(printCalcpad(parseCalcpad('a ^^ b').node!), 'a \u2295 b');
    assert.equal(printCalcpad(parseCalcpad('7 %% 2').node!), '7 \u29BC 2');
});

test('precedence is preserved through brackets', () => {
    const cases: [string, string][] = [
        ['a/(b+c)', 'a/(b + c)'],
        ['(a+b)/c', '(a + b)/c'],
        ['a/b*c', 'a/b * c'],
        ['a-b-c', 'a - b - c'],
        ['a-(b-c)', 'a - (b - c)'],
        ['(a/b)^c', '(a/b)^c'],
        ['a^b^c', 'a^b^c'],
        ['a-b*c', 'a - b * c'],
    ];
    for (const [source, expected] of cases) {
        assert.equal(printCalcpad(parseCalcpad(source).node!), expected, source);
    }
});

test('unary minus binds looser than the power, matching the engine', () => {
    // `-2^2 = -(2^2) = -4` — the parser must not read it as `(-2)^2`.
    const tree = parseCalcpad('-2^2').node!;
    assert.equal(tree.name, 'mrow');
    assert.equal((tree as { children: { name: string }[] }).children[0].name, 'mo');
    assert.equal(printCalcpad(tree), '-2^2');
});

test('the gate admits ordinary equations and declines non-math lines', () => {
    for (const source of CONSTRUCTS) {
        assert.equal(classifyEdit(source).kind, 'editable', source);
    }
    assert.equal(classifyEdit('#hide').kind, 'notMath');
    assert.equal(classifyEdit('"A title"').kind, 'notMath');
    assert.equal(classifyEdit("'a comment").kind, 'notMath');
    assert.equal(classifyEdit('$Plot{ x @ x = 1 : 2 }').kind, 'notMath');
    assert.equal(classifyEdit('<b>bold</b>').kind, 'notMath');
    assert.equal(classifyEdit('').kind, 'notMath');
});

test('names split at the first underscore into a subscript, exactly like Calcpad', () => {
    assert.equal(printCalcpad(parseCalcpad('find_eq_lt').node!), 'find_eq_lt');
    assert.equal(printCalcpad(parseCalcpad('h_').node!), 'h_');
    assert.equal(printCalcpad(parseCalcpad('x\u2081').node!), 'x\u2081');
});

test('a unit target is not a multiplication', () => {
    const tree = parseCalcpad('10|kN/m^2').node!;
    // mrow[10, mo(|), mfrac(kN, msup(m,2))]
    assert.equal(tree.name, 'mrow');
    const children = (tree as { children: { name: string }[] }).children;
    assert.equal(children[1].name, 'mo');
    assert.equal(printCalcpad(tree), '10|kN/m^2');
});

test('a matrix literal keeps its rows and cells', () => {
    const tree = parseCalcpad('[1; 2|3; 4]').node!;
    const table = (tree as { children: { name: string }[] }).children[1];
    assert.equal(table.name, 'mtable');
    assert.equal(printCalcpad(tree), '[1; 2 | 3; 4]');
});

test('malformed input is rejected rather than guessed at', () => {
    assert.equal(parseCalcpad('a +').ok, false);
    assert.equal(parseCalcpad('((a)').ok, false);
    assert.equal(parseCalcpad('a @ b').ok, false);
});
