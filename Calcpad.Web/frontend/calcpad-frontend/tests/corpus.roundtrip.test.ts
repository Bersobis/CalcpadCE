/**
 * Round-trip measurement over the real `Examples/` corpus.
 *
 * This is the check the whole WYSIWYG design rests on. It is a characterisation test:
 * the thresholds below are a baseline pinned from the corpus as it stands today, so any
 * future change that loses fidelity shows up as a failure rather than as a surprise.
 * Raising a threshold is only correct when the change it accompanies is a real
 * improvement, not to silence drift.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { validateLatex } from 'mathlive/ssr';
import { checkCorpus, formatReport } from '../src/math/roundTrip';

const here = fileURLToPath(new URL('.', import.meta.url));
// tests/ -> calcpad-frontend/ -> frontend/ -> Calcpad.Web/ -> repo root
const repoRoot = resolve(here, '../../../..');
const examplesDir = join(repoRoot, 'Examples');

function collect(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) collect(full, out);
        else if (entry.toLowerCase().endsWith('.cpd')) out.push(full);
    }
    return out;
}

const files = collect(examplesDir)
    .map((path) => ({ path: relative(repoRoot, path), content: readFileSync(path, 'utf8') }));

/** Runs the emitted LaTeX through MathLive's own parser. */
const validate = (latex: string) => {
    const errors = validateLatex(latex);
    return errors.length === 0 ? { ok: true } : { ok: false, error: errors.map((e) => e.code).join(', ') };
};

describe(`corpus: ${files.length} .cpd files under Examples/`, () => {
    const report = checkCorpus(files, validate, 30);

    it('parses every equation line without throwing', () => {
        const parseErrors = report.failures.filter((f) => f.error?.startsWith('parse:'));
        // Some example lines are deliberately broken to show error handling; the parser
        // must degrade to the fallback number rather than throw. Nothing should throw.
        expect(parseErrors).toEqual([]);
    });

    it('emits LaTeX that MathLive accepts', () => {
        // Measured 99.7% (6774/6794) on the corpus as of this writing.
        expect(report.latexOk / report.lines).toBeGreaterThan(0.99);
    });

    it('round-trips calcpad text', () => {
        // Measured 96.2% (6535/6794). The residue is almost entirely the comma-separated
        // subscript `B_0,0` and the `|` row separator inside `[...]` — both need the comma
        // and bar to be disambiguated from the statement separator and the unit target,
        // which is not decidable without the value of the left operand.
        expect(report.textStable / report.lines).toBeGreaterThan(0.95);
    });

    it('keeps the AST stable under re-parsing', () => {
        expect(report.astStable / report.lines).toBeGreaterThan(0.99);
    });

    it('prints the drift report for review', () => {
        // Always emitted so `vitest run` doubles as the corpus dashboard.
        console.log('\n' + formatReport(report));
        expect(report.lines).toBeGreaterThan(500);
    });
});