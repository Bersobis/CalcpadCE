/**
 * Regression gate for `docs/quick-reference.md`: every documented construct must
 * survive both round trips and stay editable on the math canvas.
 */

import { describe, expect, it } from 'vitest';
import { calcpadToAst, astToCalcpad } from '../src/math/calcpad';
import { astToLatex, latexToCalcpad } from '../src/math/latex';
import { classifyLineEdit } from '../src/math/roundTrip';
import { DOC_SYNTAX_CASES, normalizeDocSyntax } from './fixtures/docSyntaxCases';

function roundTrips(syntax: string): { printed: string; committed: string } {
    const ast = calcpadToAst(syntax);
    return { printed: astToCalcpad(ast), committed: latexToCalcpad(astToLatex(ast)) };
}

describe('documented Calcpad syntax is consistent with the live editor', () => {
    it('covers the whole reference', () => {
        expect(DOC_SYNTAX_CASES.length).toBeGreaterThan(200);
    });

    for (const group of [...new Set(DOC_SYNTAX_CASES.map((c) => c.group))]) {
        describe(group, () => {
            for (const { syntax } of DOC_SYNTAX_CASES.filter((c) => c.group === group)) {
                it(`round-trips ${JSON.stringify(syntax)} through the printer`, () => {
                    const { printed } = roundTrips(syntax);
                    expect(normalizeDocSyntax(printed)).toBe(normalizeDocSyntax(syntax));
                });

                it(`round-trips ${JSON.stringify(syntax)} through the LaTeX commit path`, () => {
                    const { committed } = roundTrips(syntax);
                    expect(normalizeDocSyntax(committed)).toBe(normalizeDocSyntax(syntax));
                });

                it(`classifies ${JSON.stringify(syntax)} as an editable equation`, () => {
                    expect(classifyLineEdit(syntax)).toBe('equation');
                });
            }
        });
    }
});