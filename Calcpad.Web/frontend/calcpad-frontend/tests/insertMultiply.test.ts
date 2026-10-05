/**
 * Multiplication added around an inserted template.
 *
 * MathLive glues an inserted template to whatever sits at the caret, and Calcpad reads
 * `a2` as one variable rather than a product -- a line that still renders, with the symbol
 * simply gone. These tests pin the signs that stop that, and the two ways a sign can go
 * wrong itself: doubled into `\cdot\cdot`, which becomes a variable named `cdot`, and left
 * dangling at commit, which becomes `* 0`.
 */

import { describe, expect, it } from 'vitest';
import {
    endsOperand,
    multiplicationFor,
    startsOperand,
    stripProvisionalTimes,
    wrapInsert,
    TIMES,
} from '../src/math/insertMultiply';
import { latexToCalcpad } from '../src/math/latex';

describe('endsOperand', () => {
    it.each(['a', '2', ')', '}', 'x_1', 'a)'])('is true for %s', (s) => {
        expect(endsOperand(s)).toBe(true);
    });

    it.each(['', '   ', 'a +', '(', '[', '{', '\\', 'a+ '])('is false for %s', (s) => {
        // An empty field, a half-typed operator, an opening delimiter and a lone backslash
        // from a half-typed macro are all things the next character would not multiply.
        expect(endsOperand(s)).toBe(false);
    });

    it('does not treat a closing bracket as the end of an operand', () => {
        // `]` is left out deliberately: a bracketed list in Calcpad is also what a subscript
        // or an index opens, so a `·` added after one is not always what the user meant.
        expect(endsOperand(']')).toBe(false);
    });
});

describe('startsOperand', () => {
    it.each(['a', '2', '(', '[', '{', '.', '\\sin', 'x'])('is true for %s', (s) => {
        expect(startsOperand(s)).toBe(true);
    });

    it.each(['', '  ', '+ ', ')'])('is false for %s', (s) => {
        expect(startsOperand(s)).toBe(false);
    });

    it('treats a leading macro as the start of an operand', () => {
        // A sign is still an operand as far as this predicate goes; it is `multiplicationFor`
        // that declines to add a second one beside it.
        expect(startsOperand('\\cdot ')).toBe(true);
    });

    it('is false for a superscript or subscript, which bind tighter than a product', () => {
        expect(startsOperand('^2')).toBe(false);
        expect(startsOperand('_1')).toBe(false);
    });
});

describe('multiplicationFor', () => {
    it('adds nothing when the caret is alone', () => {
        expect(multiplicationFor('', '')).toEqual({ before: '', after: '' });
    });

    it('signs the left when an operand precedes the caret', () => {
        expect(multiplicationFor('a', '').before).toBe(TIMES);
    });

    it('signs the right when an operand follows the caret', () => {
        expect(multiplicationFor('', 'b').after).toBe(TIMES);
    });

    it('signs both sides between two operands', () => {
        expect(multiplicationFor('a', 'b')).toEqual({ before: TIMES, after: TIMES });
    });

    it('adds no second sign next to one it already wrote', () => {
        // Two signs together make `\cdot\cdot`, which a reader that takes a command as a
        // run of letters sees as one macro name -- the line then carries a variable the
        // user never typed. This is what a second insert into an uncommitted field does.
        expect(multiplicationFor(`3 ${TIMES} `, '').before).toBe('');
        expect(multiplicationFor('', `${TIMES} x`).after).toBe('');
    });

    it('still writes a sign where one is genuinely missing', () => {
        expect(multiplicationFor('a', '').before).toBe(TIMES);
        expect(multiplicationFor('', 'b').after).toBe(TIMES);
    });
});

describe('wrapInsert', () => {
    it('hands the template over untouched when nothing is either side', () => {
        expect(wrapInsert('\\sqrt{#0}', '', '')).toBe('\\sqrt{#0}');
    });

    it('keeps a space after a trailing sign', () => {
        // A macro name is read as a run of letters, so `\cdot` written straight against the
        // text after the caret becomes the single command `\cdotx` -- not an operator, and
        // committed as the variable `cdotx`. What comes back is the fragment to insert at
        // the caret; the neighbours stay where they are in the field.
        const out = wrapInsert('\\sqrt{#0}', 'a', 'b');
        expect(out).toBe(`${TIMES} \\sqrt{#0} ${TIMES} `);
        // Filled in, the whole field is the product the signs were added to make.
        expect(latexToCalcpad('a' + out.replace('#0', '2') + 'b')).toBe('a * sqrt(2) * b');
    });

    it('never lets two signs touch', () => {
        const first = wrapInsert('\\operatorname{floor}(#0)', 'q=2\\cdot3', 'x');
        const afterFirst = 'q=2\\cdot3' + first;
        const second = wrapInsert('\\operatorname{ceiling}(#0)', afterFirst, '');
        const whole = afterFirst + second.replace('#0', '7');
        expect(whole).not.toContain(`${TIMES}${TIMES}`);
        expect(latexToCalcpad(whole)).not.toContain('cdot');
    });
});

describe('a sign left over from an insert is taken off at commit', () => {
    it('drops a trailing sign with nothing after it', () => {
        expect(stripProvisionalTimes('a \\cdot ')).toBe('a');
        expect(stripProvisionalTimes('a \\cdot')).toBe('a');
    });

    it('leaves the field alone when something follows the sign', () => {
        expect(stripProvisionalTimes('a \\cdot b')).toBe('a \\cdot b');
        expect(stripProvisionalTimes('a + ')).toBe('a + ');
    });

    it('does not reach into the middle of a macro name', () => {
        // The version this replaced interpolated a macro into a RegExp, where `\c` is not a
        // backslash: the sign was never found and every commit was refused.
        expect(stripProvisionalTimes(`cdot${TIMES} `)).toBe('cdot');
    });
});
