/**
 * Round-trip measurement over a real corpus: `textStable` (the canvas must never rewrite
 * a document), `astStable`, and `latexOk` (MathLive's real parser accepts the output).
 * Failures are bucketed by a construct tag so the report says which part of the language
 * is unsafe to edit graphically.
 */

import { astToLatex } from './latex';
import { astToCalcpad, calcpadToAst, splitWorksheet } from './calcpad';
import type { MathJSON } from './mathjson';

/** Runs LaTeX through MathLive. Injected so this module carries no runtime dependency
 *  on MathLive; the tests and harness pass the real implementation in. */
export type LatexValidator = (latex: string) => { ok: boolean; error?: string };

export interface LineResult {
    line: number;
    source: string;
    textStable: boolean;
    astStable: boolean;
    latexOk: boolean;
    emitted?: string;
    latex?: string;
    error?: string;
    construct: string;
}

export interface CorpusReport {
    files: number;
    lines: number;
    textStable: number;
    astStable: number;
    latexOk: number;
    /** Construct tag → number of lines failing the text round-trip. */
    driftByConstruct: Record<string, number>;
    /** A bounded sample of drifting lines, for inspection. */
    failures: LineResult[];
}

/** Coarse classification of a Calcpad line, used to group drift. */
export function classify(source: string): string {
    if (/\$Plot|\$Map|\$Contour|\$Vector|\$Curve|\$Sum|\$Integral|\$Area|\$Deriv|\$Solve|\$Minimize|\$Maximize/.test(source)) return 'plot';
    if (/^[A-Za-z_][A-Za-z0-9_]*[$@]/.test(source) || source.includes('<tspan')) return 'drawing';
    if (/^#(for|endfor|repeat|endrepeat|while|endwhile|def|undeft|read|write|append|include|hide|show|format|clip|deg|rad|gra)\b/i.test(source)) return 'directive';
    if (/^#UI\b/.test(source)) return 'ui';
    if (/[;]/.test(source) && /\[[^\]]*\]/.test(source)) return 'vector';
    if (/\|/.test(source)) return 'units';
    if (/\^/.test(source)) return 'power';
    if (/_/.test(source)) return 'subscript';
    if (/\//.test(source)) return 'division';
    if (/[a-zA-Z]\s*\(/.test(source)) return 'function';
    return 'plain';
}

/** One-line check. Never throws: a malformed line is reported, not propagated. */
export function checkLine(source: string, lineNumber: number, validate?: LatexValidator): LineResult {
    const result: LineResult = {
        line: lineNumber,
        source,
        textStable: false,
        astStable: false,
        latexOk: false,
        construct: classify(source),
    };

    let ast: MathJSON;
    try {
        ast = calcpadToAst(source);
    } catch (e) {
        result.error = `parse: ${(e as Error).message}`;
        return result;
    }

    try {
        result.emitted = astToCalcpad(ast);
        result.textStable = normalize(result.emitted) === normalize(source);
    } catch (e) {
        result.error = `emit: ${(e as Error).message}`;
    }

    try {
        const again = calcpadToAst(result.emitted ?? source);
        result.astStable = astToCalcpad(again) === result.emitted;
    } catch (e) {
        result.error = result.error ?? `reparse: ${(e as Error).message}`;
    }

    if (validate) {
        try {
            const latex = astToLatex(ast);
            result.latex = latex;
            const out = validate(latex);
            result.latexOk = out.ok;
            if (!out.ok) result.error = result.error ?? `latex: ${out.error ?? 'invalid'}`;
        } catch (e) {
            result.error = result.error ?? `latex: ${(e as Error).message}`;
        }
    }

    return result;
}

/**
 * Whitespace-insensitive comparison. Also folds documented Calcpad aliases, since
 * `sqr(x)` and `sqrt(x)` are the same function and normalising the name is a deliberate
 * presentational choice rather than a loss of fidelity.
 */
function normalize(s: string): string {
    return s
        .replace(/\s+/g, '')
        .replace(/·/g, '*')
        .replace(/∕/g, '/')
        .replace(/\bsqr\(/g, 'sqrt(');
}

export interface CorpusInput {
    path: string;
    content: string;
}

export function checkCorpus(files: CorpusInput[], validate?: LatexValidator, maxFailures = 40): CorpusReport {
    const report: CorpusReport = {
        files: files.length,
        lines: 0,
        textStable: 0,
        astStable: 0,
        latexOk: 0,
        driftByConstruct: {},
        failures: [],
    };

    for (const file of files) {
        const { equations } = splitWorksheet(file.content);
        for (const { text, line } of equations) {
            const r = checkLine(text, line, validate);
            report.lines++;
            if (r.textStable) report.textStable++;
            else report.driftByConstruct[r.construct] = (report.driftByConstruct[r.construct] ?? 0) + 1;
            if (r.astStable) report.astStable++;
            if (r.latexOk) report.latexOk++;
            if ((!r.textStable || !r.astStable || (validate && !r.latexOk)) && report.failures.length < maxFailures) {
                report.failures.push(r);
            }
        }
    }

    return report;
}

export function formatReport(report: CorpusReport): string {
    const pct = (n: number): string => (report.lines ? `${((n / report.lines) * 100).toFixed(1)}%` : 'n/a');
    const lines = [
        `files            ${report.files}`,
        `equation lines   ${report.lines}`,
        `calcpad stable   ${report.textStable} (${pct(report.textStable)})`,
        `ast stable       ${report.astStable} (${pct(report.astStable)})`,
        `latex ok         ${report.latexOk} (${pct(report.latexOk)})`,
    ];

    const drift = Object.entries(report.driftByConstruct).sort((a, b) => b[1] - a[1]);
    if (drift.length) {
        lines.push('', 'drift by construct:');
        for (const [tag, n] of drift) lines.push(`  ${tag.padEnd(12)} ${n}`);
    }

    if (report.failures.length) {
        lines.push('', `first ${report.failures.length} failures:`);
        for (const f of report.failures) {
            lines.push(`  [L${f.line}] (${f.construct}) ${f.source}`);
            if (!f.textStable && f.emitted !== undefined) lines.push(`      -> ${f.emitted}`);
            if (f.error) lines.push(`      !! ${f.error}`);
        }
    }

    return lines.join('\n');
}