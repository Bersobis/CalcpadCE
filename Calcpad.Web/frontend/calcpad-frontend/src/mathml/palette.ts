/**
 * The palette's mapping onto the tree.
 *
 * The catalog in `../text/math-palette` is text-oriented: each button knows how
 * to splice Calcpad source into a line, which is what source mode uses. The
 * graphical editor works on a tree instead, so it needs a second mapping from
 * the *same* buttons onto caret operations. That mapping is pure, so it lives
 * here rather than in the Vue component — which is what lets the palette test
 * prove that every button in the catalog does something.
 *
 * A `null` return means the button could not be applied. That is deliberately
 * not the same as "did nothing quietly": the catalog test asserts no shipped
 * button ever returns `null`, so a new button that forgets its mapping fails the
 * suite instead of shipping as a dead control.
 */

import type { MathMlElement } from './ast';
import type { Anchor, EditResult, StructureKind } from './caret';
import { applyCharacter, buildStructure, insertCall, insertPair, insertTable } from './caret';
import type { PaletteAction } from '../text/math-palette';

/** Buttons that map straight onto a MathML structure. */
const STRUCTURE_BY_ID: Record<string, StructureKind> = {
    sqrt: 'sqrt',
    cbrt: 'cbrt',
    nroot: 'root',
    power: 'power',
    subscript: 'subscript',
    fraction: 'fraction',
};

/** Buttons that build a bracketed literal, and the shape they start at. */
const TABLE_BY_ID: Record<string, { rows: number; cols: number }> = {
    vector: { rows: 1, cols: 3 },
    matrix2x2: { rows: 2, cols: 2 },
};

/** Buttons that become a `name(...)` call rather than a structure. */
const CALL_BY_ID: Record<string, string> = {
    abs: 'abs',
    floor: 'floor',
    ceil: 'ceil',
    sum: 'sum',
    product: 'product',
};

/** Groups whose buttons stand for a single character, so typing it is the action. */
const CHARACTER_GROUPS = new Set(['Operators', 'Relations', 'Greek']);

/**
 * Apply a palette button to the tree at `anchor`.
 *
 * The order matters: identity first, then the `brackets` special case, then the
 * literal shapes, then calls, then bare characters. `abs`, `floor` and `ceil`
 * are filed under Structures but are calls, which is why they are matched before
 * the character fallback rather than by their group.
 *
 * The character groups go through `applyCharacter` rather than inserting the
 * glyph directly: a button must do exactly what typing its character does, or
 * `/` would leave a flat slash where typing `/` builds a fraction.
 */
export function applyPaletteAction(
    root: MathMlElement,
    anchor: Anchor,
    action: PaletteAction,
): EditResult | null {
    const structure = STRUCTURE_BY_ID[action.id];
    if (structure) return buildStructure(root, anchor, structure);

    if (action.id === 'brackets') return insertPair(root, anchor, '(', ')');

    const table = TABLE_BY_ID[action.id];
    if (table) return insertTable(root, anchor, table.rows, table.cols);

    const call = CALL_BY_ID[action.id] ?? (action.group === 'Functions' ? action.label : null);
    if (call) return insertCall(root, anchor, call);

    if (CHARACTER_GROUPS.has(action.group)) return applyCharacter(root, anchor, action.label);

    return null;
}
