/**
 * The insert palette: every template must survive the bridge, and an unfilled one must
 * never reach the document.
 *
 * The engine check is the important one. `sqrt(\placeholder{})` reads back as `sqrt(())`,
 * and the engine answers `Invalid syntax: "( )"` for that -- so a palette button that
 * committed immediately would replace a good line with a broken one.
 */

import { describe, expect, it } from 'vitest';
import { validateLatex } from 'mathlive/ssr';
import { latexToCalcpad } from '../src/math/latex';
import { INSERT_TEMPLATES, insertGroups, hasEmptyPlaceholder } from '../src/math/insertTemplates';
import { classifyLineEdit } from '../src/math/roundTrip';

const withSlots = (latex: string): string =>
    latex.replace(/#0/g, '\\placeholder{}').replace(/#1/g, '\\placeholder{}').replace(/#2/g, '\\placeholder{}');

const filled = (latex: string): string =>
    latex.replace(/#0/g, '2').replace(/#1/g, '3').replace(/#2/g, '4');

describe('the insert palette', () => {
    it('offers the constructs worth one click', () => {
        expect(INSERT_TEMPLATES.length).toBeGreaterThanOrEqual(15);
        const labels = INSERT_TEMPLATES.map((t) => t.label);
        for (const want of ['√', 'a⁄b', 'xⁿ', 'sin', 'ln']) {
            expect(labels).toContain(want);
        }
    });

    it('groups every template under a heading', () => {
        expect(insertGroups().length).toBeGreaterThanOrEqual(3);
        for (const t of INSERT_TEMPLATES) expect(t.title.length).toBeGreaterThan(0);
    });

    it('has no duplicate buttons', () => {
        const keys = INSERT_TEMPLATES.map((t) => `${t.label}|${t.latex}`);
        expect(new Set(keys).size).toBe(keys.length);
    });

    it.each(INSERT_TEMPLATES.map((t) => [t.label, t] as const))(
        'emits LaTeX MathLive accepts: %s',
        (_label, t) => {
            expect(validateLatex(filled(t.latex))).toEqual([]);
        },
    );

    it.each(INSERT_TEMPLATES.map((t) => [t.label, t] as const))(
        'reads back as Calcpad once filled: %s',
        (_label, t) => {
            const out = latexToCalcpad(filled(t.latex));
            expect(out).not.toContain('placeholder');
            expect(out).not.toContain('operatorname');
            expect(out).not.toContain('()');
        },
    );

    it.each(INSERT_TEMPLATES.map((t) => [t.label, t] as const))(
        'reads back as an editable line once filled: %s',
        (_label, t) => {
            expect(classifyLineEdit(`zz = ${latexToCalcpad(filled(t.latex))}`)).toBe('equation');
        },
    );
});

describe('unfilled templates are never written', () => {
    it.each(INSERT_TEMPLATES.map((t) => [t.label, t] as const))(
        'recognises the empty slot in %s',
        (_label, t) => {
            expect(hasEmptyPlaceholder(withSlots(t.latex))).toBe(true);
        },
    );

    it('sees a filled template as ready', () => {
        expect(hasEmptyPlaceholder('\\sqrt{2}')).toBe(false);
    });

    it('reads an empty slot as an empty group, not a variable called placeholder', () => {
        // The failure this replaced: the reader produced `sqrt(placeholder0)`, writing a
        // variable named `placeholder` into the document.
        expect(latexToCalcpad('\\sqrt{\\placeholder{}}')).toBe('sqrt(())');
        expect(latexToCalcpad('\\frac{\\placeholder{}}{\\placeholder{}}')).not.toContain('placeholder');
    });

    it('holds a filled line as editable while a slot is still empty', () => {
        // `sqrt(())` is not something the gate should offer, and more to the point it is
        // not something the engine accepts -- so the field must not commit it.
        expect(classifyLineEdit('zz = sqrt(())')).not.toBe('equation');
    });
});

describe('named functions', () => {
    // MathLive renders any function it does not know as `\operatorname{name}(…)`, so a
    // Calcpad function inserted that way has to read back as a call and not as a product
    // of a variable called `operatorname`.
    it.each(['abs', 'sign', 'min', 'max', 'if', 'hp', 'ishp', 'getunits'])(
        'reads \\operatorname{%s} as a function call',
        (name) => {
            expect(latexToCalcpad(`\\operatorname{${name}}(2)`)).toBe(`${name}(2)`);
        },
    );

    it('takes several arguments', () => {
        expect(latexToCalcpad('\\operatorname{if}(1;2;3)')).toBe('if(1; 2; 3)');
    });
});
describe('the LaTeX MathLive actually emits once a slot is filled', () => {
    // These strings were read out of a live MathLive field after inserting a template and
    // typing into it. They are *not* the strings the templates contain: MathLive rewrites
    // them as it goes, dropping braces around a single atom and nesting function names.
    // Reading the template text alone would have missed all four failures below.
    const emitted: [string, string][] = [
        [String.raw`zz=\frac12`, 'zz=1 / 2'],
        [String.raw`zz=\frac{1}2`, 'zz=1 / 2'],
        [String.raw`zz=\frac1{2}`, 'zz=1 / 2'],
        [String.raw`zz=\frac{12}{3}`, 'zz=12 / 3'],
        [String.raw`zz=\frac{1}{2.5}`, 'zz=1 / 2.5'],
        [String.raw`zz=\sqrt9`, 'zz=sqrt(9)'],
        [String.raw`zz=\sqrt{12}`, 'zz=sqrt(12)'],
        [String.raw`zz=\sqrt[3]5`, 'zz=root(5; 3)'],
        [String.raw`zz=\operatorname{\mathrm{if}}(1;2;3)`, 'zz=if(1; 2; 3)'],
        [String.raw`zz=\operatorname{\mathrm{abs}}(1)`, 'zz=abs(1)'],
    ];

    it.each(emitted)('reads %s back as the Calcpad it means', (latex, want) => {
        expect(latexToCalcpad(latex)).toBe(want);
    });

    it('never invents a zero for a dropped brace', () => {
        // The failure this replaced: `\sqrt9` parsed as the empty group `0` and printed
        // `sqrt(0)9`, while `\frac12` printed `12 / 0`.
        for (const [latex, want] of emitted) {
            expect(`${latex}:${latexToCalcpad(latex)}`).toBe(`${latex}:${want}`);
        }
    });
});
