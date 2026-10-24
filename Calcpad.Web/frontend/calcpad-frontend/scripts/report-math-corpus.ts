// Corpus harness.
//
// Measures the bridge against the real `Examples/` tree rather than a hand-picked sample, so a
// construct the parser mishandles shows up as a number instead of as a user's corrupted file.
// Run with: npx tsx scripts/report-math-corpus.ts

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { classifyLine } from '../src/math/line-model';
import { parseCalcpad } from '../src/math/parser';
import { printCalcpad } from '../src/math/printer';
import { sameTree } from '../src/math/model';
import { toMathMlDocument } from '../src/math/serialize';
import { fromOmml, toOmml } from '../src/math/omml';

const ROOT = join(process.cwd(), '..', '..', '..', 'Examples');

function cpdFiles(dir: string, out: string[] = []): string[] {
    let entries: string[];
    try {
        entries = readdirSync(dir);
    } catch {
        return out;
    }
    for (const entry of entries) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) cpdFiles(full, out);
        else if (entry.endsWith('.cpd')) out.push(full);
    }
    return out;
}

interface Tally {
    lines: number;
    candidates: number;
    editable: number;
    textStable: number;
    astStable: number;
    mathmlOk: number;
    ommlStable: number;
    failures: { file: string; line: number; text: string; why: string }[];
}

function run(): void {
    const files = cpdFiles(ROOT);
    const tally: Tally = {
        lines: 0, candidates: 0, editable: 0, textStable: 0, astStable: 0,
        mathmlOk: 0, ommlStable: 0, failures: [],
    };

    for (const file of files) {
        const text = readFileSync(file, 'utf8');
        const lines = text.split(/\r\n|\r|\n/);
        lines.forEach((raw, index) => {
            tally.lines++;
            const trimmed = raw.trim();
            if (trimmed === '') return;
            if (/^[#'"<$]/.test(trimmed)) return;
            tally.candidates++;

            const parsed = parseCalcpad(trimmed);
            if (!parsed.ok || !parsed.node || parsed.opaque) {
                return;
            }
            const printed = printCalcpad(parsed.node);
            const reparsed = parseCalcpad(printed);
            if (!reparsed.ok || !reparsed.node) return;
            if (!sameTree(parsed.node, reparsed.node)) {
                if (tally.failures.length < 25) {
                    tally.failures.push({ file, line: index + 1, text: trimmed, why: `ast drift -> ${printed}` });
                }
                return;
            }
            tally.astStable++;
            if (printed === trimmed) tally.textStable++;
            if (classifyLine(raw).kind === 'equation') tally.editable++;
            try {
                toMathMlDocument(parsed.node);
                tally.mathmlOk++;
            } catch {
                /* reported below as a shortfall */
            }
            const back = fromOmml(toOmml(parsed.node));
            if (back && sameTree(back, parsed.node)) tally.ommlStable++;
        });
    }

    const pct = (n: number, d: number): string => (d === 0 ? 'n/a' : `${((100 * n) / d).toFixed(1)}%`);
    console.log(`files:            ${files.length}`);
    console.log(`lines:            ${tally.lines}`);
    console.log(`expression lines: ${tally.candidates}`);
    console.log(`parses to a tree: ${tally.astStable} (${pct(tally.astStable, tally.candidates)})`);
    console.log(`text unchanged:   ${tally.textStable} (${pct(tally.textStable, tally.candidates)})`);
    console.log(`opens as a field: ${tally.editable} (${pct(tally.editable, tally.candidates)})`);
    console.log(`renders to MathML:${tally.mathmlOk} (${pct(tally.mathmlOk, tally.candidates)})`);
    console.log(`OMML round-trips: ${tally.ommlStable} (${pct(tally.ommlStable, tally.candidates)})`);

    if (tally.failures.length > 0) {
        console.log('\nfirst failures:');
        for (const failure of tally.failures) {
            console.log(`  ${failure.file.replace(ROOT, '')}:${failure.line}  ${failure.text}  [${failure.why}]`);
        }
    }
}

run();
