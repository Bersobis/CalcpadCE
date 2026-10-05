/**
 * Bracketed literals must keep every element they were given.
 *
 * Found while adding palette buttons: the reader accepted `,` as a separator inside `[…]`
 * and not `;`, so `[2;3]` read back as `[2]`. The template gates did not catch it, because
 * a truncated list is still valid LaTeX and still an editable line -- it simply no longer
 * said what the user asked for.
 */

import { describe, expect, it } from 'vitest';
import { latexToCalcpad } from '../src/math/latex';

describe('bracketed literals keep every element', () => {
    it.each([
        ['[2;3]', '[2; 3]'],
        ['[2,3]', '[2; 3]'],
        ['[2;3;4]', '[2; 3; 4]'],
        ['[2,3,4]', '[2; 3; 4]'],
        ['[2]', '[2]'],
        ['[a;b;c]', '[a; b; c]'],
    ])('%s reads back as %s', (latex, want) => {
        expect(latexToCalcpad(latex)).toBe(want);
    });

    it('keeps the elements a vector literal is meant to hold', () => {
        // The exact regression: this used to come back holding only the first element.
        expect(latexToCalcpad('[a;b;c]')).toBe('[a; b; c]');
    });

    it('still reads a bracketed expression as one bracketed value', () => {
        expect(latexToCalcpad('[a+b]')).toBe('[a + b]');
    });
});