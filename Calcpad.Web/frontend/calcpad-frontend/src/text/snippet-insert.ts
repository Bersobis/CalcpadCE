/**
 * The shape these helpers actually read. Two `InsertItem` interfaces exist —
 * one for the snippet payloads the server sends (`types/snippets`, `description`
 * required) and one the Vue components consume (`vue/types`, `description`
 * optional) — and both satisfy this, so the helpers work with either.
 */
export interface SnippetSource {
    tag: string;
    label?: string;
    parameters?: { name: string }[];
}

const SNIPPET_PLACEHOLDER = '§';

function escapeSnippetText(text: string): string {
    return text.replace(/[\\$}]/g, '\\$&');
}

/**
 * Build a TextMate-style snippet string from an InsertItem by replacing each `§` placeholder in
 * the tag with a `${N:name}` tab stop defaulting to the parameter name (`...` for variadic
 * placeholders). Output is compatible with both Monaco and VS Code snippet insertion.
 */
export function buildInsertSnippet(item: SnippetSource): string {
    const segments = item.tag.split(SNIPPET_PLACEHOLDER);
    let result = escapeSnippetText(segments[0]);
    for (let i = 1; i < segments.length; i++) {
        const param = item.parameters?.[i - 1];
        const name = param ? param.name : '...';
        result += '${' + i + ':' + escapeSnippetText(name) + '}';
        result += escapeSnippetText(segments[i]);
    }
    return result;
}

/** True when the snippet's tag contains at least one `§` placeholder. */
export function hasSnippetPlaceholders(item: SnippetSource): boolean {
    return item.tag.includes(SNIPPET_PLACEHOLDER);
}

/**
 * Replace every `§` in `text` with the corresponding parameter name from
 * `item.parameters` (or `...` for variadic placeholders beyond the declared
 * parameters). Used for plain-text display (no snippet syntax) — e.g. the
 * autocomplete dropdown label and the Insert Tab.
 */
export function replaceParameterPlaceholders(
    text: string,
    item: { parameters?: { name: string }[] }
): string {
    if (!text.includes(SNIPPET_PLACEHOLDER)) return text;
    const segments = text.split(SNIPPET_PLACEHOLDER);
    let result = segments[0];
    for (let i = 1; i < segments.length; i++) {
        const param = item.parameters?.[i - 1];
        result += (param ? param.name : '...') + segments[i];
    }
    return result;
}

/**
 * Format the display label for an InsertItem: prefers `item.label` over the
 * tag, then substitutes `§` placeholders with parameter names.
 */
export function formatInsertLabel(item: SnippetSource): string {
    return replaceParameterPlaceholders(item.label || item.tag, item);
}

/** Largest matrix the literal builder will emit, so a typo cannot insert thousands of cells. */
export const MATRIX_MAX_SIZE = 12

function matrixDimension(value: number): number {
    if (!Number.isFinite(value)) return 1
    return Math.min(MATRIX_MAX_SIZE, Math.max(1, Math.trunc(value)));
}

/**
 * Build a square-bracket matrix literal snippet `rows` x `cols`. Calcpad separates
 * columns with `;` and rows with `|` (docs/matrices.md), so `[1; 2|3; 4]` is a 2x2.
 * Every cell is its own tab stop, letting the user type straight across the grid.
 */
export function buildMatrixLiteralSnippet(rows: number, cols: number, name = 'A'): string {
    const rowCount = matrixDimension(rows)
    const colCount = matrixDimension(cols)
    let stop = 0
    const body: string[] = []
    for (let r = 0; r < rowCount; r++) {
        const cells: string[] = []
        for (let c = 0; c < colCount; c++) {
            cells.push('${' + (++stop) + ':0}')
        }
        body.push(cells.join('; '))
    }
    return name + ' = [' + body.join('|') + ']'
}
