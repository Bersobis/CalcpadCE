/**
 * Round-trip measurement over a real corpus: `textStable` (the canvas must never rewrite
 * a document), `astStable`, and `latexOk` (MathLive's real parser accepts the output).
 * Failures are bucketed by a construct tag so the report says which part of the language
 * is unsafe to edit graphically.
 */

import { astToLatex, latexToCalcpad } from './latex';
import { astToCalcpad, calcpadToAst, splitWorksheet, isEquationLine } from './calcpad';
import type { MathJSON } from './mathjson';

/** Runs LaTeX through MathLive. Injected so this module carries no runtime dependency
 *  on MathLive; the tests and harness pass the real implementation in. */
export type LatexValidator = (latex: string) => { ok: boolean; error?: string };

export interface LineResult {
    line: number;
    source: string;
    textStable: boolean;
    astStable: boolean;
    /** `calcpad → AST → LaTeX → calcpad` reproduces the line, which is what a commit writes. */
    commitStable: boolean;
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
    if (/\[[^\]]*\|[^\]]*\]/.test(source)) return 'matrix';
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
        commitStable: false,
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

    // The path the canvas actually takes on commit. `textStable` above only proves the
    // *printer* is faithful; a commit goes out through LaTeX, and the two bridges can
    // disagree — a Greek symbol or a quoted label survived printing and was lost in
    // LaTeX. Checking only the cheap path is what let both reach the document.
    try {
        const committed = latexToCalcpad(astToLatex(ast));
        result.commitStable = normalize(committed) === normalize(source);
    } catch (e) {
        result.commitStable = false;
        result.error = result.error ?? `commit: ${(e as Error).message}`;
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
 * Whether a line may go through the visual editor: `notMath` and `lossy` lines are shown
 * as source instead, since a write-back reprints the line from its AST.
 *
 * The gate requires `commitStable` as well as the cheaper checks, because a commit is
 * routed through LaTeX. A line the printer reproduces perfectly can still be one the
 * LaTeX bridge mangles, and offering it for editing is how that reaches the document.
 */
export type LineEditKind = 'blank' | 'notMath' | 'lossy' | 'equation';

export function classifyLineEdit(text: string): LineEditKind {
    const trimmed = text.trim();
    if (!trimmed) return 'blank';
    if (!isEquationLine(trimmed)) return 'notMath';
    const check = checkLine(trimmed, 0);
    return check.textStable && check.astStable && check.commitStable ? 'equation' : 'lossy';
}

/**
 * Whitespace-insensitive comparison. Also folds documented Calcpad aliases, since
 * `sqr(x)` and `sqrt(x)` are the same function and normalising the name is a deliberate
 * presentational choice rather than a loss of fidelity.
 *
 * Every fold here was checked against the engine, which must accept both spellings:
 * `x₁` and `x_1` are both valid subscripts, and `÷` and `/` are the same division. What
 * the engine *rejects* is deliberately not folded -- `∖` is not a valid spelling of the
 * integer-division `\`, so that one has to survive the round trip verbatim.
 */
function normalize(s: string): string {
    return s
        .replace(/\s+/g, '')
        // The doc lists an ASCII spelling beside each operator glyph; the printer emits the
        // glyph, so the two are the same operator and must compare equal. Longest first:
        // `<*` must not be read as `<`, nor `//` as `/`.
        .replace(/==/g, '≡').replace(/!=/g, '≠')
        .replace(/<=/g, '≤').replace(/>=/g, '≥')
        .replace(/&&/g, '∧').replace(/\|\|/g, '∨').replace(/\^\^/g, '⊕')
        .replace(/%%/g, '⦼').replace(/\/\//g, '÷')
        .replace(/<</g, '∠').replace(/<\*/g, '←')
        .replace(/·/g, '*')
        .replace(/∕/g, '/')
        .replace(/\bsqr\(/g, 'sqrt(')
        // `cbrt(x)` is the documented spelling of `root(x; 3)`, and the printer canonicalises
        // it to the `root` form. Folding the alias -- as `sqr`/`sqrt` already are -- keeps a
        // cubic-root line editable instead of dropping it out of the canvas for a
        // difference the engine treats as none.
        .replace(/\bcbrt\((\s*[^;,]*?)\s*\)/g, 'root($1;3)')
        // Unicode sub/superscripts are alternate spellings of `x_1` / `x^2`, and the
        // engine reads both, so the editor may normalise between them.
        .replace(/([\p{L}\p{N}])[₀-₉₊₋₌₍₎]+/gu, (m, base: string) => `${base}_${[...m.slice(1)].map((c) => SUBSCRIPT_DIGITS[c] ?? c).join('')}`)
        .replace(/÷/g, '/')
        // `⦼` modulo and `\` integer division are printed with spaces around them for
        // legibility; the engine accepts both spellings, so the padding is not content.
        .replace(/\s*⦼\s*/g, '⦼')
        .replace(/\s*\\\s*/g, '\\')
        // A phasor prints as `(3∠45)°` when the degree is a separate unit, and as
        // `3∠45°` when it binds to the angle. Both reach the engine as the same value --
        // it rejects the `∠` glyph in either position, identically.
        .replace(/\(([^()]*∠[^()]*)\)/g, '$1');
}

/** Unicode subscript digit to ASCII, so `₁` and `_1` compare equal. */
const SUBSCRIPT_DIGITS: Record<string, string> = {
    '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4',
    '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
};

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