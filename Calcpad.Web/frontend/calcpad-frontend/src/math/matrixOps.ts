/**
 * Adding and removing matrix rows and columns.
 *
 * The operations act on Calcpad source text rather than on LaTeX, because the document
 * is the source of truth and LaTeX is only MathLive's editing surface. Each one parses
 * the source, reshapes the first bracketed literal it finds, and prints the result back —
 * so a resize is indistinguishable from the author having typed it.
 *
 * Calcpad has no separate matrix and vector types: `[1; 2; 3]` is a 1×3 matrix and the
 * engine pads a ragged `[1; 2; 3|4]` out to 2×3 with zeros. Both are resizable here for
 * that reason, and a result that comes back with one row prints as the vector it is.
 *
 * Only the *first* literal in the expression is resized. A line with two matrices is a
 * rare shape, and guessing which one the author meant would be worse than being
 * predictable about the first.
 */

import { astToCalcpad, calcpadToAst } from './calcpad';
import { childrenOf } from './mathjson';
import type { MathJSON } from './mathjson';

export type MatrixOp = 'addRow' | 'removeRow' | 'addCol' | 'removeCol';

/** The cells a new row or column starts with: `0` is the neutral element for every operator. */
function zeroCell(): MathJSON {
    return { type: 'Number', n: 0 };
}

/** A bracketed literal, normalised to rows. Null when the node is not one. */
interface Grid {
    node: MathJSON;
    rows: MathJSON[][];
    left: string;
    right: string;
}

function asGrid(node: MathJSON): Grid | null {
    if (node.type === 'Matrix') {
        return { node, rows: node.rows, left: node.left ?? '[', right: node.right ?? ']' };
    }
    if (node.type === 'Delimited' && (node.left ?? '[') === '[') {
        return { node, rows: [node.body], left: '[', right: node.right ?? ']' };
    }
    return null;
}

/** The widest row, which is the column count the engine holds the literal to. */
function widthOf(rows: MathJSON[][]): number {
    return rows.reduce((max, row) => Math.max(max, row.length), 0);
}

/** Pads short rows out with zeros, so the result is the rectangle the engine expects. */
function padTo(rows: MathJSON[][], cols: number): MathJSON[][] {
    return rows.map((row) => (row.length < cols
        ? [...row, ...Array.from({ length: cols - row.length }, zeroCell)]
        : row));
}

function addRow(rows: MathJSON[][]): MathJSON[][] {
    const cols = widthOf(rows);
    return [...rows, Array.from({ length: cols }, zeroCell)];
}

function removeRow(rows: MathJSON[][]): MathJSON[][] {
    // A matrix needs at least one row; there is nothing to remove below that.
    return rows.length <= 1 ? rows : rows.slice(0, -1);
}

function addCol(rows: MathJSON[][]): MathJSON[][] {
    return padTo(rows, widthOf(rows) + 1);
}

function removeCol(rows: MathJSON[][]): MathJSON[][] {
    if (widthOf(rows) <= 1) return rows;
    return rows.map((row) => (row.length > 1 ? row.slice(0, -1) : row));
}

const OPERATIONS: Record<MatrixOp, (rows: MathJSON[][]) => MathJSON[][]> = {
    addRow, removeRow, addCol, removeCol,
};

/** The first bracketed literal in the tree, in reading order, or null if there is none. */
function findGrid(node: MathJSON): Grid | null {
    const here = asGrid(node);
    if (here) return here;
    for (const child of childrenOf(node)) {
        const found = findGrid(child);
        if (found) return found;
    }
    return null;
}

/** Rebuilds `node` with `replacement` in place of the literal `findGrid` located. */
function replaceGrid(node: MathJSON, replacement: MathJSON): MathJSON {
    // The literal itself takes the replacement whole; descending into it would splice
    // the new grid into its own cells.
    if (asGrid(node)) return replacement;
    switch (node.type) {
        case 'Operator':
        case 'Function':
            return { ...node, args: node.args.map((a) => replaceGrid(a, replacement)) };
        case 'Group':
        case 'Delimited':
        case 'Units':
        case 'Statements':
            return { ...node, body: node.body.map((b) => replaceGrid(b, replacement)) };
        case 'Matrix':
            return { ...node, rows: node.rows.map((r) => r.map((c) => replaceGrid(c, replacement))) };
        default:
            return node;
    }
}

/** A one-row result is a vector, and Calcpad writes it as one. */
function toNode(grid: Grid, rows: MathJSON[][]): MathJSON {
    return rows.length > 1
        ? { type: 'Matrix', rows, left: grid.left, right: grid.right }
        : { type: 'Delimited', body: rows[0] ?? [], left: grid.left, right: grid.right };
}

/** True when the expression holds a bracketed literal the user could resize. */
export function hasMatrix(source: string): boolean {
    try {
        return findGrid(calcpadToAst(source)) !== null;
    } catch {
        return false;
    }
}

/**
 * Applies `op` to the first bracketed literal in `source`, returning the new Calcpad text.
 *
 * Returns the source unchanged when it holds no literal, or when the operation would
 * leave nothing to remove — a caller must never be handed a matrix it cannot render.
 */
export function applyMatrixOp(source: string, op: MatrixOp): string {
    let ast: MathJSON;
    try {
        ast = calcpadToAst(source);
    } catch {
        return source;
    }

    const grid = findGrid(ast);
    if (!grid) return source;

    const before = astToCalcpad(ast);
    const rows = OPERATIONS[op](grid.rows);
    if (rows === grid.rows) return source;

    const next = astToCalcpad(replaceGrid(ast, toNode(grid, rows)));
    return next === before ? source : next;
}

/** The current size of the first literal in `source`, for labelling the controls. */
export function matrixSize(source: string): { rows: number; cols: number } | null {
    try {
        const grid = findGrid(calcpadToAst(source));
        return grid ? { rows: grid.rows.length, cols: widthOf(grid.rows) } : null;
    } catch {
        return null;
    }
}