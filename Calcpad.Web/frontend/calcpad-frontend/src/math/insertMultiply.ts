/**
 * Multiplication to add around a template the toolbar inserts.
 *
 * MathLive inserts at the caret with no operator, so anything landing next to existing
 * content comes out juxtaposed: inserting `√` after `a` gives `a\sqrt{}`. That reads as a
 * product to MathLive and to a person, but the Calcpad the commit writes is not always the
 * same expression -- and with a digit on the left of a letter it is not the same at all.
 * `a` with `2` inserted after it gives `a2`, which Calcpad reads as one variable *named*
 * `a2`. The line still renders, so nothing looks wrong; the symbol is simply gone.
 *
 * So the editor inserts `\cdot` explicitly whenever an operand already sits on a side the
 * template would otherwise be glued to. `·` is also what the emitter writes for an explicit
 * `*`, so the committed line reads the same either way.
 */

/** LaTeX for the multiplication sign this module inserts. */
export const TIMES = '\\cdot';

/** A character that ends a complete operand: a digit, a name, or a closing delimiter. */
const OPERAND_END = /[\p{L}\p{N}.)}]/u;

/** A character that begins an operand: a digit, a name, an opening delimiter, or a macro. */
const OPERAND_START = /[\p{L}\p{N}([{.]/u;

/**
 * True when `latex` ends with a complete operand, so text inserted after its end would be
 * multiplied by it. An empty string, or a trailing lone backslash from a half-typed macro,
 * is not one.
 */
export function endsOperand(latex: string): boolean {
    const tail = latex.trimEnd();
    if (tail === '' || tail.endsWith('\\')) return false;
    return OPERAND_END.test(tail[tail.length - 1]);
}

/**
 * True when `latex` begins with an operand, so text inserted before its start would be
 * multiplied by it. Exponents and subscripts are excluded: `_` binds tighter than a
 * product, so the slot is not a multiplication the caller may fill.
 */
export function startsOperand(latex: string): boolean {
    const head = latex.trimStart();
    if (head === '') return false;
    if (/[\^_]/.test(head[0])) return false;
    return OPERAND_START.test(head[0]) || head[0] === '\\';
}

/**
 * The multiplication signs to place before and after an inserted template, given what sits
 * on either side of the caret. Empty strings mean no sign is needed on that side.
 */
export function multiplicationFor(before: string, after: string): { before: string; after: string } {
    return {
        before: alreadySigned(before, 'end') || !endsOperand(before) ? '' : TIMES,
        // A template always ends in an operand (`\sqrt{#0}`, `(#0)`, `{#0}^{2}`), so only the
        // right-hand neighbour decides whether a sign is needed there.
        after: alreadySigned(after, 'start') || !startsOperand(after) ? '' : TIMES,
    };
}

/**
 * Whether the neighbour already carries a sign on the side the new one would go.
 *
 * A sign next to a sign is not two multiplications. `\cdot\cdot` is read as one macro name
 * by a reader that takes a command as a run of letters, so the second is not an operator
 * at all and the line comes out carrying a variable named `cdot`. This happens when a
 * template is inserted into a field where an earlier insert is still uncommitted.
 */
function alreadySigned(neighbour: string, edge: 'start' | 'end'): boolean {
    const trimmed = edge === 'end' ? neighbour.trimEnd() : neighbour.trimStart();
    return trimmed.startsWith(TIMES) || trimmed.endsWith(TIMES);
}

/**
 * The LaTeX to hand MathLive for one insert: the template, bracketed by whatever
 * multiplication the neighbours call for.
 *
 * The trailing sign carries a space of its own. A macro name is read as a run of letters,
 * so `\cdot` written straight against the text after the caret becomes the single command
 * `\cdotx` -- which is not an operator at all, and committed as the variable `cdotx`.
 */
export function wrapInsert(template: string, before: string, after: string): string {
    const { before: lead, after: trail } = multiplicationFor(before, after);
    if (lead === '' && trail === '') return template;
    return lead === '' ? `${template} ${trail} ` : trail === '' ? `${lead} ${template}` : `${lead} ${template} ${trail} `;
}

/**
 * Takes off a trailing sign that an insert added and nothing was typed after.
 *
 * The sign exists so that whatever the user types next is unambiguously a product. If
 * they type nothing, it is just a `*` waiting for an operand, and the Calcpad reader would
 * oblige with `* 0` -- a value the document would carry with nothing to show for it. So it
 * is dropped at the point of writing, while the half-typed `+` a person left behind is
 * still refused.
 *
 * Compared as text, not by pattern: `TIMES` is a macro, and a backslash is not something
 * to drop into a regular expression.
 */
export function stripProvisionalTimes(latex: string): string {
    const trimmed = latex.trimEnd();
    if (!trimmed.endsWith(TIMES)) return latex;
    return trimmed.slice(0, -TIMES.length).trimEnd();
}