/**
 * The last gate before the live editor writes to a document.
 *
 * The canvas converts a maths field to Calcpad with `latexToCalcpad` and writes whatever
 * comes back. That reader is deliberately forgiving -- it would rather produce *something*
 * than throw, because a field mid-edit is almost never well-formed LaTeX. Forgiving is
 * right while reading and wrong at the point of writing: a half-typed `a +` becomes
 * `a + 0`, which is valid Calcpad carrying a value the user never asked for, and the
 * document is silently wrong with no error anywhere to show for it.
 *
 * So the two concerns are separated. Reading stays forgiving; writing is checked. Every
 * commit passes `checkCommit` first, and anything it rejects leaves the field open with an
 * explanation rather than reaching the document.
 *
 * Three things are rejected:
 *
 *  - Input that is still being typed: an empty group, a dangling operator, an
 *    unclosed delimiter. The reader would paper over each with a fabricated operand.
 *  - Calcpad the parser cannot read. The reader did not throw, but the text it produced
 *    is not a valid expression, and writing it would replace a good line with a broken one.
 *  - Calcpad that does not survive being read back. A line that re-prints differently
 *    would drift each time it is opened and closed.
 */

import { calcpadToAst, astToCalcpad } from './calcpad';

export interface CommitVerdict {
    ok: boolean;
    /** Why the commit was refused, phrased for the user. Empty when `ok`. */
    reason?: string;
    /** The Calcpad the commit would write. Only set when `ok`. */
    text?: string;
}

const OK: CommitVerdict = { ok: true };

/** Two Calcpad sources that parse to the same tree, ignoring where they were spaced. */
function sameTree(a: string, b: string): boolean {
    // `source` records positions in the original text, so it is dropped: it differs for
    // two inputs that are otherwise identical.
    const shape = (text: string): string =>
        JSON.stringify(calcpadToAst(text), (key, value) => (key === 'source' ? undefined : value));
    return shape(a) === shape(b);
}

/** Trailing spacing commands MathLive leaves at the end of a field. */
const SPACING = String.raw`(?:\\!|\\,|\\;|\\:|\\ |\\quad|\\qquad|\\hspace\{[^}]*\})`;

/**
 * An operator with nothing after it. The reader turns each of these into `… 0`, so this
 * is the difference between "the user is still typing" and "the document now says 0".
 */
const DANGLING = new RegExp(String.raw`(?:[+\-*/^_=<>,;]|[(\[{]|\\(?:cdot|times|div|pm|mp|leq|geq|neq|approx|equiv|oplus|land|lor|cup|cap|to|gets|setminus))$`);

/** A group or command argument with nothing in it, e.g. `\frac{}{1}` or `x^{}`. */
const EMPTY_GROUP = /\{\s*\}/;

/** Empty call parentheses, e.g. `\sin()`. A complete expression has none. */
const EMPTY_CALL = /\(\s*\)/;

/**
 * Delimiters the user has opened but not closed, in any of the three kinds the field can
 * hold. `\left`/`\right` are dropped first: they are sizing hints, and a `\left(` whose
 * `\right)` is missing is already caught by the count mismatch below.
 *
 * Only bare delimiters count. `\[` and `\]` are display-math commands, not brackets, so
 * an escaped delimiter is left alone.
 */
function unbalanced(latex: string): boolean {
    const lefts = (latex.match(/\\left\b/g) ?? []).length;
    const rights = (latex.match(/\\right\b/g) ?? []).length;
    if (lefts !== rights) return true;

    const bare = latex.replace(/\\[a-zA-Z]+/g, '');
    const pairs: Record<string, string> = { '{': '}', '(': ')', '[': ']' };
    const stack: string[] = [];
    for (const ch of bare) {
        if (pairs[ch]) stack.push(pairs[ch]);
        else if (ch === '}' || ch === ')' || ch === ']') {
            if (stack.pop() !== ch) return true;
        }
    }
    return stack.length !== 0;
}

/** A bracketed list that is still open, e.g. `[1; 2` left mid-edit. */
function openList(latex: string): boolean {
    return /[([]\s*$/.test(latex.replace(new RegExp(SPACING, 'g'), ''));
}

/** Strips trailing spacing so `a + \;` is recognised as the dangling `a +`. */
function trimTail(latex: string): string {
    return latex.replace(new RegExp(`(?:${SPACING})+$`, 'g'), '').trimEnd();
}

/** Why this LaTeX is not ready to be written, or `null` when it is. */
function incompleteness(latex: string): string | null {
    if (EMPTY_GROUP.test(latex) || EMPTY_CALL.test(latex)) {
        return 'there is an empty bracket or slot — fill it in, or press Esc to cancel';
    }
    if (unbalanced(latex)) {
        return 'a bracket or brace is not closed';
    }
    const tail = trimTail(latex);
    if (DANGLING.test(tail)) {
        return 'the expression ends with an operator — finish it, or press Esc to cancel';
    }
    if (openList(latex)) {
        return 'a list is not closed — add the rest of it, or press Esc to cancel';
    }
    return null;
}

/**
 * Whether a maths field's LaTeX may be written to the document as Calcpad.
 *
 * `latexToCalcpad` is not called here: the caller already has the text it would write,
 * and converting twice would mean trusting the forgiving reader for the verdict as well
 * as for the value. Pass the converted text as `text` when it is available.
 */
export function checkCommit(latex: string, text?: string): CommitVerdict {
    const incomplete = incompleteness(latex);
    if (incomplete) return { ok: false, reason: incomplete };

    if (text === undefined) return OK;

    const trimmed = text.trim();
    if (!trimmed) return { ok: false, reason: 'the expression is empty' };

    // The reader is forgiving, so "it did not throw" proves nothing. Re-reading the text
    // is the only check that says whether the line is Calcpad at all.
    let ast;
    try {
        ast = calcpadToAst(trimmed);
    } catch (e) {
        return { ok: false, reason: `that is not valid Calcpad (${(e as Error).message})` };
    }

    // A line that re-prints as something else would drift on every open/close, so refuse
    // it rather than let the document change under the user. Compared as trees, not as
    // text: the printer only ever canonicalises spacing (`1+2` becomes `1 + 2`), and
    // rejecting a commit over that would refuse correct input.
    try {
        const printed = astToCalcpad(ast);
        if (!sameTree(printed, trimmed)) {
            return { ok: false, reason: 'that does not mean the same thing once written' };
        }
    } catch (e) {
        return { ok: false, reason: `that is not valid Calcpad (${(e as Error).message})` };
    }

    return { ok: true, text: trimmed };
}
