/**
 * `latexToCalcpad` is the only thing standing between what MathLive hands back after a
 * canvas edit and the document. A macro missing from `MACRO_OPS` is read as a *variable
 * of that name*, so the round-trip tests cannot catch it -- both directions drift the same
 * way and compare equal. These assertions name the operator the doc spells instead.
 */

import { describe, expect, it } from 'vitest';
import { latexToCalcpad } from '../src/math/latex';

const CASES: [string, string][] = [
    ['a \\le b', 'a ≤ b'],
    ['a \\leq b', 'a ≤ b'],
    ['a \\ge b', 'a ≥ b'],
    ['a \\geq b', 'a ≥ b'],
    ['a \\ne b', 'a ≠ b'],
    ['a \\neq b', 'a ≠ b'],
    ['a \\equiv b', 'a ≡ b'],
    ['a \\land b', 'a ∧ b'],
    ['a \\wedge b', 'a ∧ b'],
    ['a \\lor b', 'a ∨ b'],
    ['a \\vee b', 'a ∨ b'],
    ['a \\oplus b', 'a ⊕ b'],
    ['a \\times b', 'a * b'],
    ['a \\div b', 'a / b'],
];

describe('MathLive operator macros read back as Calcpad operators', () => {
    for (const [latex, calcpad] of CASES) {
        it(`${latex} → ${calcpad}`, () => {
            expect(latexToCalcpad(latex)).toBe(calcpad);
        });
    }
});

describe('chained operators keep every operator', () => {
    it('reads a chain of comparison and logical operators', () => {
        expect(latexToCalcpad('a \\equiv b \\land c \\ne d')).toBe('a ≡ b ∧ c ≠ d');
    });

    it('reads a chain that crosses precedence levels', () => {
        expect(latexToCalcpad('a \\le b \\land c \\oplus d')).toBe('a ≤ b ∧ c ⊕ d');
    });

    it('reads a logical operator below an additive one', () => {
        expect(latexToCalcpad('a + b \\land c')).toBe('a + b ∧ c');
    });
});