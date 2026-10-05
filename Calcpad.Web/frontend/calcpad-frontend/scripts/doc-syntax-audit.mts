/**
 * Audits the live editor's grammar against `docs/quick-reference.md`.
 *
 * Every documented construct is driven through the two paths a user actually hits:
 * the printer (`calcpadToAst` -> `astToCalcpad`) and the commit path
 * (`calcpadToAst` -> `astToLatex` -> `latexToCalcpad`). A construct is consistent only
 * when both reproduce the source *and* `classifyLineEdit` calls it an equation
 * (i.e. the canvas offers it for graphical editing rather than showing it as source).
 *
 * The same cases run as `tests/docSyntax.test.ts`; this script is for quick triage.
 */

import { calcpadToAst, astToCalcpad } from '../src/math/calcpad';
import { astToLatex, latexToCalcpad } from '../src/math/latex';
import { classifyLineEdit } from '../src/math/roundTrip';
import { DOC_SYNTAX_CASES, normalizeDocSyntax } from '../tests/fixtures/docSyntaxCases';

const CASES = DOC_SYNTAX_CASES;

let failures = 0;
let checked = 0;
const byGroup = new Map<string, { total: number; bad: number }>();

for (const { group, syntax } of CASES) {
    checked++;
    const stat = byGroup.get(group) ?? { total: 0, bad: 0 };
    stat.total++;
    byGroup.set(group, stat);

    const kind = classifyLineEdit(syntax);
    let printed = '';
    let committed = '';
    let textStable = false;
    let commitStable = false;
    try {
        const ast = calcpadToAst(syntax);
        printed = astToCalcpad(ast);
        textStable = normalizeDocSyntax(printed) === normalizeDocSyntax(syntax);
        try {
            committed = latexToCalcpad(astToLatex(ast));
            commitStable = normalizeDocSyntax(committed) === normalizeDocSyntax(syntax);
        } catch (e) {
            committed = `THREW: ${(e as Error).message}`;
        }
    } catch (e) {
        printed = `THREW: ${(e as Error).message}`;
    }

    const editable = kind === 'equation';
    if (!textStable || !commitStable || !editable) {
        stat.bad++;
        failures++;
        const why = [
            !editable ? `kind=${kind}` : '',
            !textStable ? 'print-drift' : '',
            !commitStable ? 'commit-drift' : '',
        ].filter(Boolean).join(' ');
        console.log(`FAIL [${group}] ${JSON.stringify(syntax)}  (${why})`);
        console.log(`      print : ${JSON.stringify(printed)}`);
        console.log(`      commit: ${JSON.stringify(committed)}`);
    }
}

console.log('');
for (const [group, { total, bad }] of byGroup) {
    if (bad > 0) console.log(`${group.padEnd(12)} ${bad}/${total} inconsistent`);
}
console.log(`\n${checked - failures}/${checked} documented constructs consistent`);
process.exit(failures === 0 ? 0 : 1);