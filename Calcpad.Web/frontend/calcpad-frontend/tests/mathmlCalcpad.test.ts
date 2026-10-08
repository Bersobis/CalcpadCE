import { describe, it, expect } from 'vitest';
import {
    calcpadLineToMathMl,
    mathMlToCalcpadLine,
    checkGraphicallyEditable,
    needsMultiply,
} from '../src/mathml/calcpad';
import { serializeMathMl } from '../src/mathml/serialize';
import { elementAt, tokenText } from '../src/mathml/ast';

/** `source → MathML → source`, for the tests that care about the text. */
function roundTrip(source: string): string | null {
    const parsed = calcpadLineToMathMl(source);
    if (!parsed.root) return null;
    return mathMlToCalcpadLine(parsed.root);
}

/** The serialized MathML for a line, for shape assertions. */
function mathml(source: string): string {
    const parsed = calcpadLineToMathMl(source);
    if (!parsed.root) throw new Error(`not parseable: ${source}`);
    return serializeMathMl(parsed.root);
}

describe('calcpad → MathML', () => {
    it('maps an assignment to a flat row of tokens', () => {
        expect(mathml('a = 5')).toBe(
            '<math xmlns="http://www.w3.org/1998/Math/MathML"><mrow>'
            + '<mi>a</mi><mo>=</mo><mn>5</mn></mrow></math>',
        );
    });

    it('maps division to mfrac, not a slash token', () => {
        const markup = mathml('a/b');
        expect(markup).toContain('<mfrac><mrow><mi>a</mi></mrow><mrow><mi>b</mi></mrow></mfrac>');
        expect(markup).not.toContain('<mo>/</mo>');
    });

    it('maps sqrt and root to their own elements', () => {
        expect(mathml('sqrt(x)')).toContain('<msqrt><mrow><mi>x</mi></mrow></msqrt>');
        expect(mathml('root(x; 3)')).toContain(
            '<mroot><mrow><mi>x</mi></mrow><mrow><mn>3</mn></mrow></mroot>',
        );
    });

    it('maps a power and a subscript to msup and msub', () => {
        expect(mathml('x^2')).toContain('<msup><mrow><mi>x</mi></mrow><mrow><mn>2</mn></mrow></msup>');
        expect(mathml('x_1')).toContain('<msub><mrow><mi>x</mi></mrow><mrow><mn>1</mn></mrow></msub>');
    });

    it('keeps a call as a name followed by a parenthesised argument list', () => {
        expect(mathml('sin(x)')).toContain('<mi>sin</mi><mrow><mo>(</mo><mi>x</mi><mo>)</mo></mrow>');
    });

    it('separates call arguments with a semicolon operator', () => {
        expect(mathml('stress(P; A)')).toContain(
            '<mo>(</mo><mi>P</mi><mo>;</mo><mi>A</mi><mo>)</mo>',
        );
    });

    it('takes the unit target verbatim as mtext', () => {
        const markup = mathml('w = 10|kN/m^2');
        expect(markup).toContain('<mo>|</mo><mtext>kN/m^2</mtext>');
    });

    it('maps a vector literal to a one-row table', () => {
        const markup = mathml('[1; 2; 3]');
        expect(markup).toContain('<mtable>');
        expect(markup.match(/<mtr>/g)).toHaveLength(1);
        expect(markup.match(/<mtd>/g)).toHaveLength(3);
    });

    it('maps a matrix literal to a row per `|`', () => {
        const markup = mathml('M = [1; 2|3; 4]');
        expect(markup.match(/<mtr>/g)).toHaveLength(2);
        expect(markup.match(/<mtd>/g)).toHaveLength(4);
    });

    it('reads `|` as the row divisor inside brackets and the unit target outside', () => {
        // The inner `|` divides rows; the outer one is the conversion target.
        const markup = mathml('[1; 2|3; 4]|kN');
        expect(markup.match(/<mtr>/g)).toHaveLength(2);
        expect(markup).toContain('<mo>|</mo><mtext>kN</mtext>');
    });

    it('gives every cell its own slot', () => {
        // `mtd` wraps an `mrow`, so an unfilled cell is an empty slot the caret
        // can enter rather than a hole in the table.
        expect(mathml('[a; b]')).toContain('<mtd><mrow><mi>a</mi></mrow></mtd>');
        expect(mathml('[; ]')).toContain('<mtd><mrow></mrow></mtd>');
    });

    it('takes the numerator of `a*b/c` as the whole left product', () => {
        // `*` and `/` bind equally and associate left, so this is `(a*b)/c`.
        const markup = mathml('a*b/c');
        expect(markup).toContain('<mfrac><mrow><mi>a</mi><mo>*</mo><mi>b</mi></mrow>');
    });

    it('declines constructs it does not model', () => {
        for (const source of ["'a comment", '#deg', '<b>bold</b>', 'x = 1, y = 2']) {
            expect(calcpadLineToMathMl(source).root, source).toBeNull();
        }
    });
});

describe('MathML → calcpad', () => {
    it.each([
        'a = 5',
        'b = a + 1',
        'c = a*b + c/d',
        'd = sqrt(a^2 + b^2)',
        'e = root(x; 3)',
        'f = sin(x) + cos(y)',
        'g = 2x',
        'h = (a + b)*c',
        'i = a - -b',
        'j = x^2 + y^3',
        'k = a ≤ b ∧ c ≥ d',
        'l = x_1 + x_2',
        'm = a\\b + a⦼b',
        'n = 5!',
        'o = 10|kN/m^2',
        'p = stress(P; A)',
        'q = -a^2',
        'r = abs(x)',
        't = a/b/c',
        '[1; 2; 3]',
        'M = [1; 2|3; 4]',
        '[a; b|c; d]|kN',
    ])('round-trips %s', source => {
        expect(roundTrip(source)).toBe(source);
    });

    it('brackets an operand that would otherwise rebind', () => {
        // `(a+b)` as a numerator must keep its brackets on the way back.
        expect(roundTrip('(a + b)/c')).toBe('(a + b)/c');
        // A fraction raised to a power needs brackets around the base.
        const parsed = calcpadLineToMathMl('x = (a/b)^2');
        expect(parsed.root).not.toBeNull();
        expect(mathMlToCalcpadLine(parsed.root!)).toBe('x = (a/b)^2');
    });

    it('reports failure rather than guessing on an unknown element', () => {
        const parsed = calcpadLineToMathMl('x = 1');
        const expression = elementAt(parsed.root!, [0])!;
        expression.children = [{ kind: 'element', name: 'mystery', attributes: {}, children: [] }];
        expect(mathMlToCalcpadLine(parsed.root!)).toBeNull();
    });
});

describe('needsMultiply', () => {
    it('keeps Calcpad’s own implicit multiplication', () => {
        expect(needsMultiply('2', 'x')).toBe(false);
        expect(needsMultiply('2', '(a)')).toBe(false);
        expect(needsMultiply('sin', '(x)')).toBe(false);
    });

    it('separates tokens that would otherwise merge into one', () => {
        expect(needsMultiply('x', 'y')).toBe(true);
        expect(needsMultiply('2', '3')).toBe(true);
        expect(needsMultiply('x', '2')).toBe(true);
    });

    it('never multiplies across an operator or a closing bracket', () => {
        expect(needsMultiply('a +', 'b')).toBe(false);
        expect(needsMultiply('(a)', 'b')).toBe(false);
    });
});

describe('checkGraphicallyEditable', () => {
    it('accepts the expression subset', () => {
        for (const source of ['a = 5', 'x = sqrt(a^2 + b^2)', 'w = 10|kN/m^2', 'f = 2x']) {
            const check = checkGraphicallyEditable(source);
            expect(check.ok, `${source}: ${check.reason}`).toBe(true);
        }
    });

    it('declines lines the live display already edits another way', () => {
        for (const source of ["'text", '#deg', '$Plot{x}', 'A_s = 84\'', '<b>x</b>']) {
            const check = checkGraphicallyEditable(source);
            expect(check.ok, source).toBe(false);
            expect(check.reason).toBeTruthy();
        }
    });

    it('declines an empty line', () => {
        expect(checkGraphicallyEditable('').ok).toBe(false);
        expect(checkGraphicallyEditable('   ').ok).toBe(false);
    });

    it('reports a stable tree even when the text respells', () => {
        // `a==b` spells the same operator as `a≡b`; the tree is what must match.
        const check = checkGraphicallyEditable('a == b');
        expect(check.ok).toBe(true);
        expect(mathMlToCalcpadLine(check.root!)).toBe('a ≡ b');
    });

    it('reads a token back out of the tree', () => {
        const parsed = calcpadLineToMathMl('a = 5');
        expect(tokenText(elementAt(parsed.root!, [0, 0])!)).toBe('a');
    });
});
