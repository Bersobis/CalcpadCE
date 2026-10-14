/**
 * Source-line analysis: splitting, editable detection, and related utilities.
 */

/**
 * Splits a document the way an editor counts its lines. A trailing line break closes the
 * last line and starts an empty one after it — which is the blank line the next expression
 * is typed on — so `"a\nb"` is two lines and `"a\nb\n"` is three, matching what the editor's
 * gutter shows. This is what keeps the panel's line numbers and its "N of M lines" in step
 * with the editor beside it.
 */
export function splitSourceLines(content: string): string[] {
    return content.split('\n');
}

/**
 * Whether a line is a live-editing target.
 *
 * Comments only feed the report, and a blank line in the middle of a document is
 * spacing rather than something to compute, so neither is offered for editing. The
 * final blank line is the exception: it is where the next expression goes, which is
 * exactly what a live editor is for.
 */
export function isLiveEditableLine(text: string, isLastLine: boolean): boolean {
    const trimmed = text.trim();
    if (trimmed.length === 0) return isLastLine;
    if (trimmed.startsWith("'")) return false;
    return true;
}
