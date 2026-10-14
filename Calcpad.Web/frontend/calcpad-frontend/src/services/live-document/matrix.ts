/**
 * Matrix literal parsing and building.
 *
 * Calcpad writes matrices as `[a; b; c|d; e; f]`: `|` separates rows and `;`
 * separates the elements inside a row (see docs/matrices.md), and a shorter row is padded
 * with zeros out to the widest one.
 */

/**
 * The matrix literal on a line, as a grid of cell texts, or null when the line holds
 * none.
 */
export function parseMatrixLiteral(text: string): string[][] | null {
    const open = text.indexOf('[');
    if (open < 0) return null;
    // Outermost bracket only: a line may hold an index or a call around the matrix.
    let depth = 0;
    let close = -1;
    for (let i = open; i < text.length; ++i) {
        const c = text[i];
        if (c === '[') ++depth;
        else if (c === ']') {
            if (--depth === 0) {
                close = i;
                break;
            }
        }
    }
    if (close < 0) return null;
    const body = text.slice(open + 1, close).trim();
    if (body.length === 0) return null;
    // A matrix body is the only place `|` and `;` both separate values, so require one of
    // them rather than mistaking `[1, 2]`-style vector brackets for a matrix.
    if (!body.includes('|') && !body.includes(';')) return null;
    return body.split('|').map(row =>
        row.split(';').map(cell => cell.trim())
    );
}

/** The bounds of the matrix literal on a line, or null when it holds none. */
export function matrixLiteralRange(text: string): { start: number; end: number } | null {
    const open = text.indexOf('[');
    if (open < 0 || parseMatrixLiteral(text) == null) return null;
    let depth = 0;
    for (let i = open; i < text.length; ++i) {
        const c = text[i];
        if (c === '[') ++depth;
        else if (c === ']') {
            if (--depth === 0) return { start: open, end: i + 1 };
        }
    }
    return null;
}

/** Writes a grid of cell texts as a Calcpad matrix literal: `|` between rows, `;` within. */
export function buildMatrixLiteral(rows: string[][]): string {
    return '[' + rows.map(row => row.join(';')).join('|') + ']';
}
