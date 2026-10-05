/**
 * The live editor must never write a line the engine cannot read.
 *
 * The reader is forgiving on purpose, so these tests pin the two halves of that bargain:
 * reading recovers from broken input, and writing refuses it. The failure they exist to
 * prevent is silent -- `a +` becomes `a + 0`, which parses, evaluates, and is wrong.
 */

import { describe, expect, it } from 'vitest';
import { checkCommit } from '../src/math/commitGuard';
import { astToLatex, latexToCalcpad } from '../src/math/latex';
import { calcpadToAst } from '../src/math/calcpad';
import { INSERT_TEMPLATES } from '../src/math/insertTemplates';
import { wrapInsert, stripProvisionalTimes, TIMES } from '../src/math/insertMultiply';
import { DOC_SYNTAX_CASES } from './fixtures/docSyntaxCases';

/** What the component would write for a field holding this LaTeX. */
function verdictFor(latex: string) {
    return checkCommit(latex, latexToCalcpad(latex));
}

describe('incomplete input is not written', () => {
    it.each([
        ['a trailing operator', 'a +'],
        ['a trailing operator with spacing', 'a+ \\;'],
        ['an empty numerator', '\\frac{}{1}'],
        ['an empty exponent', 'x^{}'],
        ['an empty subscript', 'a_{}'],
        ['an unclosed brace', '\\sqrt{'],
        ['an unclosed paren', '(1 + 2'],
        ['an unclosed list', '[1; 2'],
        ['an unclosed sizing delimiter', '\\left(1 + 2'],
        ['an empty function argument', '\\sin()'],
    ])('refuses %s', (_what, latex) => {
        const v = verdictFor(latex);
        expect(v.ok).toBe(false);
        expect(v.reason).toBeTruthy();
    });

    it('would otherwise have written a fabricated operand', () => {
        // The whole point: the reader hands back valid Calcpad that says something the
        // user never typed, and nothing downstream would ever complain.
        expect(latexToCalcpad('a +')).toBe('a + 0');
        expect(verdictFor('a +').ok).toBe(false);
    });
});

describe('complete input is written', () => {
    it.each([
        '1 + 2',
        'a \\cdot b',
        '\\frac{1}{2}',
        '\\sqrt{2}',
        '\\sin(x) + \\cos(y)',
        '(1 + 2) \\cdot 3',
        'x^{2} + y_{1}',
        '[1; 2; 3]',
        '\\operatorname{if}(a; 1; 2)',
        'a \\leq b \\land c \\geq d',
        '\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}',
    ])('accepts %s', (latex) => {
        const v = verdictFor(latex);
        expect(v.ok, v.reason).toBe(true);
        expect(v.text).toBeTruthy();
    });
});

describe('Calcpad that cannot be read back is not written', () => {
    it('refuses an empty commit', () => {
        expect(checkCommit('1', '   ').ok).toBe(false);
    });

    it('refuses text the parser rejects outright', () => {
        // Reachable in practice: a field holding deeply nested pasted maths overflows
        // the parser's stack. It is the one place the text is not merely lenient but
        // genuinely unreadable, and a commit must not carry that to the document.
        const deep = '('.repeat(5000) + '1' + ')'.repeat(5000);
        const v = checkCommit(deep, deep);
        expect(v.ok).toBe(false);
        expect(v.reason).toMatch(/valid Calcpad/);
    });

    it('accepts a commit that only differs from the printer by spacing', () => {
        // The printer canonicalises `1+2` to `1 + 2`. Refusing that would block correct
        // input, so the stability check compares trees rather than text.
        expect(checkCommit('1 + 2', '1+2').ok).toBe(true);
    });
});

describe('the guard and the insert palette agree', () => {
    it('a filled template still commits when an insert left a trailing sign', () => {
        // `wrapInsert` adds a trailing `·` when the caret had an operand after it, so a
        // template inserted mid-expression arrives as `…\cdot floor(2)\cdot`. If the user
        // types nothing after it, that sign is still waiting for an operand, and the
        // reader would oblige with `* 0`. The component drops the sign it added itself,
        // so the commit is the expression the user actually built.
        const before = 'q=2\\cdot3';
        const after = 'x';
        const fragment = wrapInsert('\\operatorname{floor}(#0)', before, after);
        expect(fragment.trimEnd().endsWith(TIMES)).toBe(true);

        const withSlotAndNeighbour = before + fragment.replace('#0', '2') + after;
        expect(latexToCalcpad(withSlotAndNeighbour)).toBe('q=2 * 3 * floor(2) * x');

        // Now the neighbour is gone, leaving the sign dangling at the end.
        const dangling = stripProvisionalTimes(`${before}\\cdot \\operatorname{floor}(2) \\cdot `);
        expect(dangling).toBe(`${before}\\cdot \\operatorname{floor}(2)`);
        const text = latexToCalcpad(dangling);
        expect(text).toBe('q=2 * 3 * floor(2)');
        expect(checkCommit(dangling, text).ok).toBe(true);
    });

    it('leaves a sign alone when something follows it', () => {
        const latex = 'a \\cdot b';
        expect(stripProvisionalTimes(latex)).toBe(latex);
    });

    it('a half-typed operator is still refused', () => {
        // The distinction the component draws: a sign it added is provisional, one the
        // user typed is genuinely unfinished.
        const text = latexToCalcpad('q = 2 + ');
        expect(checkCommit('q = 2 + ', text).ok).toBe(false);
    });
});

describe('the guard does not block ordinary editing', () => {
    it('accepts every line the canvas can open', () => {
        // A false positive here is a line the user can no longer edit, which is a worse
        // failure than the one the guard exists to prevent.
        const rejected: string[] = [];
        for (const c of DOC_SYNTAX_CASES) {
            for (const line of String(c.syntax).split('\n')) {
                if (!line.trim()) continue;
                let latex: string;
                try { latex = astToLatex(calcpadToAst(line)); } catch { continue; }
                if (!checkCommit(latex, latexToCalcpad(latex)).ok) rejected.push(line);
            }
        }
        expect(rejected).toEqual([]);
    });

    it('accepts every palette template once its slots are filled', () => {
        const rejected: string[] = [];
        for (const t of INSERT_TEMPLATES) {
            const latex = t.latex.replace(/#\d/g, '2');
            if (!checkCommit(latex, latexToCalcpad(latex)).ok) rejected.push(t.label);
        }
        expect(rejected).toEqual([]);
    });

    it('rejects the same templates while a slot is still empty', () => {
        // `#0` is a marker for this file, not something MathLive holds: on insert it
        // becomes the empty slot, which is what the guard has to see.
        const accepted: string[] = [];
        for (const t of INSERT_TEMPLATES) {
            if (!/#\d/.test(t.latex)) continue;
            const asInserted = t.latex.replace(/#\d/g, '\\placeholder{}');
            if (checkCommit(asInserted, latexToCalcpad(asInserted)).ok) accepted.push(t.label);
        }
        expect(accepted).toEqual([]);
    });
});
