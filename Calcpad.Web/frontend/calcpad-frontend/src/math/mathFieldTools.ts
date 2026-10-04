/**
 * What a docked toolbar needs from a field, without knowing which field it is.
 *
 * The buttons used to live inside `CalcpadMathField`, so every line of the live canvas
 * carried its own copy. At sidebar width that wrapped 21 buttons into one column beside
 * each equation. One toolbar for the whole canvas, pointed at whichever field the user is
 * working on, is both narrower and the arrangement the rest of the panel already uses:
 * a bordered collapsible section above the content, like the Insert tab's palette.
 *
 * The field still owns the operations. The toolbar only says *which* field, so it needs
 * no knowledge of MathLive beyond what these three calls do.
 */

import type { MatrixOp } from './matrixOps';

/** Re-exported so a toolbar needs one import for everything it renders. */
export type { MatrixOp };

export interface MatrixSize {
    rows: number;
    cols: number;
}

/**
 * The handle a field hands over while it is being worked on. `size` is a getter because
 * a resize changes it without the toolbar re-rendering from scratch.
 */
export interface MathFieldHandle {
    /** Size of the bracketed literal, or null when the expression holds none. */
    readonly size: MatrixSize | null;
    /** Inserts a template at the caret, leaving the slot selected. */
    insert(latex: string): void;
    /** Dispatches a MathLive command, which is where its undo history lives. */
    command(name: string): void;
    /** Reshapes the matrix and commits it at once. */
    reshape(op: MatrixOp): void;
}

export const MATRIX_BUTTONS: { op: MatrixOp; label: string; title: string }[] = [
    { op: 'addRow', label: '+Row', title: 'Add a row' },
    { op: 'removeRow', label: '−Row', title: 'Remove the last row' },
    { op: 'addCol', label: '+Col', title: 'Add a column' },
    { op: 'removeCol', label: '−Col', title: 'Remove the last column' },
];

/**
 * Undo / redo go to MathLive, which owns its own history for the field. They are offered
 * on every editable field rather than only when a matrix is present, because the thing a
 * user most wants to take back is usually the last thing they typed.
 */
export const EDIT_BUTTONS: { command: string; label: string; title: string }[] = [
    { command: 'undo', label: '↶', title: 'Undo the last edit' },
    { command: 'redo', label: '↷', title: 'Redo' },
];

/**
 * A removal that would leave the field with no matrix to edit is offered but disabled,
 * rather than hidden: the row stays in place so the control does not shift sideways.
 */
export function matrixOpDisabled(op: MatrixOp, size: MatrixSize): boolean {
    return (op === 'removeRow' && size.rows <= 1) || (op === 'removeCol' && size.cols <= 1);
}
