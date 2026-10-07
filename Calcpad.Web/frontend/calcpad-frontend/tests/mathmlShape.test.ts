// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { calcpadLineToMathMl, mathMlToCalcpadLine } from '../src/mathml/calcpad';
import { serializeMathMl, serializeWithPaths } from '../src/mathml/serialize';
import { parseMathMl } from '../src/mathml/parse';
import { equalNodes, elementAt, isElement, tokenText } from '../src/mathml/ast';
import type { MathMlElement } from '../src/mathml/ast';
import { after } from './helpers/anchors';
import { hasEmptySlot, insertCall, insertPair, applyCharacter } from '../src/mathml/caret';

function markup(source: string): string {
    const parsed = calcpadLineToMathMl(source);
    if (!parsed.root) throw new Error(`cannot parse ${source}`);
    return serializeMathMl(parsed.root);
}

/**
 * The feature's central promise: rendering and serialization are MathML, with
 * the semantic structure preserved, and no LaTeX anywhere in the pipeline.
 */
describe('MathML output shape', () => {
    it('uses the semantic elements rather than a flat token stream', () => {
        expect(markup('a = b/c')).toContain('<mfrac>');
        expect(markup('x = sqrt(a)')).toContain('<msqrt>');
        expect(markup('x = root(a; 3)')).toContain('<mroot>');
        expect(markup('x = a^2')).toContain('<msup>');
        expect(markup('x = a_1')).toContain('<msub>');
        // Every expression is wrapped in a row, which is what the caret walks.
        expect(markup('a = 1')).toContain('<mrow>');
    });

    it('contains no LaTeX command anywhere in the markup', () => {
        const sources = [
            'a = b/c',
            'x = sqrt(a^2 + b^2)',
            'y = root(x; 3)',
            'z = a_1^2',
            'w = 10|kN/m^2',
            'v = sin(x)/cos(y)',
        ];
        for (const source of sources) {
            const out = markup(source);
            // A LaTeX command is a backslash followed by letters; MathML has none.
            expect(out, source).not.toMatch(/\\[a-zA-Z]+/);
            expect(out, source).not.toContain('\\frac');
            expect(out, source).not.toContain('\\sqrt');
        }
    });

    it('declares the MathML namespace on the root', () => {
        expect(markup('a = 1')).toContain('xmlns="http://www.w3.org/1998/Math/MathML"');
    });

    it('tags every element with its path when rendering for the editor', () => {
        const parsed = calcpadLineToMathMl('a = b/c');
        const out = serializeWithPaths(parsed.root!);
        // The root, the expression row, and the fraction's numerator are all tagged.
        expect(out).toContain('data-path=""');
        expect(out).toContain('data-path="0"');
        expect(out).toContain('data-path="0.2.0"');
    });

    it('parses its own output back to the same tree', () => {
        for (const source of ['a = b/c', 'x = sqrt(a^2 + b^2)', 'w = 10|kN/m^2', 'p = stress(P; A)']) {
            const first = calcpadLineToMathMl(source).root!;
            const reparsed = parseMathMl(serializeMathMl(first));
            expect(reparsed, source).not.toBeNull();
            expect(equalNodes(first, reparsed!), source).toBe(true);
        }
    });

    it('drops the editor’s own path annotations when reading markup back', () => {
        const parsed = calcpadLineToMathMl('a = 1').root!;
        const annotated = serializeWithPaths(parsed);
        const reparsed = parseMathMl(annotated)!;
        expect(equalNodes(parsed, reparsed)).toBe(true);
    });
});

describe('insertCall', () => {
    it('writes a name and a bracketed argument list, caret inside', () => {
        const root = calcpadLineToMathMl('a = 1').root!;
        const built = insertCall(root, after(root, '1'), 'sin');
        expect(mathMlToCalcpadLine(built.root)).toBe('a = 1sin()');
        // Caret between the brackets, so typing fills the argument.
        const typed = applyCharacter(built.root, built.anchor, 'x');
        expect(mathMlToCalcpadLine(typed.root)).toBe('a = 1sin(x)');
    });

    it('holds the line open until the argument is filled in', () => {
        const root = calcpadLineToMathMl('x = 1').root!;
        const built = insertCall(root, after(root, '1'), 'abs');
        // `1abs()` does not parse, so the editor must not commit it.
        expect(hasEmptySlot(built.root)).toBe(true);
        const filled = applyCharacter(built.root, built.anchor, 'a');
        expect(hasEmptySlot(filled.root)).toBe(false);
        expect(mathMlToCalcpadLine(filled.root)).toBe('x = 1abs(a)');
    });
});

describe('hasEmptySlot', () => {
    it('is false for a complete expression', () => {
        expect(hasEmptySlot(calcpadLineToMathMl('x = a/b').root!)).toBe(false);
    });

    it('is true while a structure has an unfilled slot', () => {
        const root = calcpadLineToMathMl('x = a').root!;
        const fraction = applyCharacter(root, after(root, 'a'), '/');
        expect(hasEmptySlot(fraction.root)).toBe(true);
    });

    it('is true for an empty bracket pair', () => {
        const root = calcpadLineToMathMl('x = a').root!;
        const brackets = insertPair(root, after(root, 'a'), '(', ')');
        expect(hasEmptySlot(brackets.root)).toBe(true);
    });
});

describe('structure slots', () => {
    it('keeps a fraction’s numerator and denominator as sibling slots', () => {
        const root = calcpadLineToMathMl('a = b/c').root!;
        const expression = elementAt(root, [0]) as MathMlElement;
        const fraction = expression.children[2];
        expect(isElement(fraction) && fraction.name).toBe('mfrac');
        const slots = (fraction as MathMlElement).children;
        expect(slots).toHaveLength(2);
        expect(tokenText(elementAt(root, [0, 2, 0, 0])!)).toBe('b');
        expect(tokenText(elementAt(root, [0, 2, 1, 0])!)).toBe('c');
    });

    it('keeps a square root’s radicand in its own slot', () => {
        const root = calcpadLineToMathMl('x = sqrt(a)').root!;
        const expression = elementAt(root, [0]) as MathMlElement;
        const sqrt = expression.children[2] as MathMlElement;
        expect(sqrt.name).toBe('msqrt');
        expect(tokenText(elementAt(root, [0, 2, 0, 0])!)).toBe('a');
    });
});
