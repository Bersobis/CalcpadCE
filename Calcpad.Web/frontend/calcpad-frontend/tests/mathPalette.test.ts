import { describe, it, expect } from 'vitest';
import {
    MATH_PALETTE,
    PALETTE_GROUPS,
    paletteAction,
    paletteGroup,
    searchPalette,
} from '../src/text/math-palette';
import { applyPaletteAction } from '../src/mathml/palette';
import { calcpadLineToMathMl, checkGraphicallyEditable, mathMlToCalcpadLine } from '../src/mathml/calcpad';
import { serializeMathMl } from '../src/mathml/serialize';
import type { MathMlElement } from '../src/mathml/ast';
import { equalNodes, nodeAt, tokenText } from '../src/mathml/ast';
import type { Anchor } from '../src/mathml/caret';
import { anchorsOf, applyCharacter, hasEmptySlot, lastAnchor } from '../src/mathml/caret';

/** Apply a button to a line, with `|` marking the caret and `[]` a selection. */
function run(id: string, line: string, selection: { start: number; end: number }) {
    const action = paletteAction(id);
    if (!action) throw new Error(`no palette action ${id}`);
    return action.apply(line, selection);
}

/** A caret selection at `index`. */
function caret(index: number) {
    return { start: index, end: index };
}

describe('math palette — structure', () => {
    it('wraps a selected expression in a square root', () => {
        const result = run('sqrt', 'a + b', { start: 0, end: 5 });
        expect(result.text).toBe('sqrt(a + b)');
        // The wrapped expression stays selected, so a second button composes.
        expect(result.selection).toEqual({ start: 5, end: 10 });
    });

    it('opens an empty square root and parks the caret inside', () => {
        const result = run('sqrt', 'x = ', caret(4));
        expect(result.text).toBe('x = sqrt()');
        expect(result.selection).toEqual(caret(9));
    });

    it('keeps the caret in the radicand for an n-th root with a selection', () => {
        const result = run('nroot', 'a', { start: 0, end: 1 });
        expect(result.text).toBe('root(a; )');
        // Caret lands in the empty degree slot, after the `; `.
        expect(result.selection).toEqual(caret(8));
    });

    it('appends a power after the caret rather than wrapping nothing', () => {
        const result = run('power', 'x', caret(1));
        expect(result.text).toBe('x^()');
        expect(result.selection).toEqual(caret(3));
    });

    it('brackets the base of a power when there is a selection', () => {
        const result = run('power', 'a + b', { start: 0, end: 5 });
        expect(result.text).toBe('(a + b)^()');
        expect(result.selection).toEqual(caret(9));
    });

    it('builds a fraction with the caret in the denominator after a selection', () => {
        const result = run('fraction', 'n', { start: 0, end: 1 });
        expect(result.text).toBe('(n)/()');
        // `(` `n` `)` `/` `(` `)` — the caret is between the last two brackets.
        expect(result.selection).toEqual(caret(5));
    });

    it('builds an empty fraction with the caret in the numerator', () => {
        const result = run('fraction', '', caret(0));
        expect(result.text).toBe('()/()');
        expect(result.selection).toEqual(caret(1));
    });

    it('wraps a selection in parentheses', () => {
        const result = run('brackets', 'a + b', { start: 0, end: 5 });
        expect(result.text).toBe('(a + b)');
    });

    it('emits a 2x2 matrix literal with the caret in the first cell', () => {
        const result = run('matrix2x2', '', caret(0));
        expect(result.text).toBe('[; |; ]');
        expect(result.selection).toEqual(caret(1));
    });
});

describe('math palette — operators, relations and greek', () => {
    it('inserts an operator at the caret, keeping the surrounding text', () => {
        const result = run('op-0', 'a b', caret(2));
        expect(result.text).toBe('a +b');
        expect(result.selection).toEqual(caret(3));
    });

    it('replaces the selection with an operator', () => {
        const result = run('op-4', 'a  b', { start: 2, end: 3 });
        expect(result.text).toBe('a ÷b');
    });

    it('inserts a relation glyph', () => {
        const result = run('rel-1', 'a = b', caret(2));
        expect(result.text).toBe('a ≠= b');
    });

    it('inserts a greek letter', () => {
        const result = run('greek-sigma', '', caret(0));
        expect(result.text).toBe('σ');
        expect(result.selection).toEqual(caret(1));
    });

    it('normalizes a reversed selection', () => {
        const result = run('sqrt', 'abc', { start: 3, end: 0 });
        expect(result.text).toBe('sqrt(abc)');
    });

    it('clips a selection past the end of the line', () => {
        const result = run('sqrt', 'ab', { start: 0, end: 99 });
        expect(result.text).toBe('sqrt(ab)');
    });
});

describe('math palette — catalog', () => {
    it('has a unique id for every button', () => {
        const ids = MATH_PALETTE.map(action => action.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('files every button under a declared group', () => {
        for (const action of MATH_PALETTE) {
            expect(PALETTE_GROUPS).toContain(action.group);
        }
    });

    it('leaves the caret inside the line for every action', () => {
        for (const action of MATH_PALETTE) {
            const result = action.apply('a = 1', caret(5));
            expect(result.selection.start).toBeGreaterThanOrEqual(0);
            expect(result.selection.start).toBeLessThanOrEqual(result.text.length);
            expect(result.selection.end).toBe(result.selection.start);
        }
    });

    it('never drops the text outside the selection', () => {
        for (const action of MATH_PALETTE) {
            const result = action.apply('before after', { start: 7, end: 12 });
            expect(result.text.startsWith('before ')).toBe(true);
        }
    });

    it('groups and searches the catalog', () => {
        expect(paletteGroup('Structures').length).toBeGreaterThan(0);
        expect(searchPalette('sqrt').map(a => a.id)).toContain('sqrt');
        expect(searchPalette('SINE')).toEqual([]);
        expect(searchPalette('')).toHaveLength(MATH_PALETTE.length);
    });

    it('inserts only operators the engine documents', () => {
        // docs/quick-reference.md "Operators". A glyph outside this set is not
        // parsed, so a button for it would break the line it was meant to build —
        // the silent-loss failure mode the palette must never introduce.
        const supported = new Set([
            '!', '^', '/', '÷', '\\', '⦼', '*', '-', '+', '≡', '≠', '<', '>', '≤', '≥',
            '∧', '∨', '∠', '⊕', '=', '←', '_', '°',
        ]);
        for (const action of [...paletteGroup('Operators'), ...paletteGroup('Relations')]) {
            expect(supported.has(action.label), `unsupported operator ${action.label}`).toBe(true);
        }
    });
});

// ---- every button must actually do something -------------------------------

/** A parsed line to press buttons against. */
function tree(source: string): MathMlElement {
    const parsed = calcpadLineToMathMl(source);
    if (!parsed.root) throw new Error(`cannot parse ${source}: ${parsed.reason}`);
    return parsed.root;
}

/** Press a button at the end of `x = 1`, the way the editor does. */
function press(actionId: string) {
    const action = paletteAction(actionId);
    if (!action) throw new Error(`no palette action ${actionId}`);
    const root = tree('x = 1');
    const result = applyPaletteAction(root, lastAnchor(root), action);
    if (!result) throw new Error(`"${actionId}" has no graphical mapping`);
    return { root, result };
}

/**
 * The first position a user would type into to close an open slot.
 *
 * Two shapes need filling: an empty `mrow` — a fraction's denominator, a table
 * cell — has a `gap` anchor, while an empty `()` is two adjacent bracket tokens
 * with no gap between them, so the caret has to go just after the opener.
 */
function openSlotAnchor(root: MathMlElement): Anchor | null {
    const gap = anchorsOf(root).find(a => a.kind === 'gap');
    if (gap) return gap;
    for (const anchor of anchorsOf(root)) {
        if (anchor.kind !== 'char' || anchor.offset !== 1) continue;
        const text = tokenText(nodeAt(root, anchor.path)!);
        if (text === '(' || text === '[') return anchor;
    }
    return null;
}

/**
 * Finish the edit a button started, the way a user would.
 *
 * A button is allowed to leave the line mid-edit — a fraction has an empty
 * denominator, and a binary operator is still waiting for its right operand
 * (`x = 1 +`). Both are the same "held open" state as a bare `b/`, not a defect.
 * So: fill the blanks, and if the line still does not parse, supply the operand
 * the trailing operator is waiting for.
 */
function finishEdit(root: MathMlElement, caret: Anchor): MathMlElement {
    let current = root;
    let anchor = caret;
    for (let guard = 0; guard < 24; guard++) {
        const text = mathMlToCalcpadLine(current);
        if (text !== null && checkGraphicallyEditable(text).ok) return current;
        const at = (hasEmptySlot(current) ? openSlotAnchor(current) : null) ?? anchor;
        const next = applyCharacter(current, at, '2');
        current = next.root;
        anchor = next.anchor;
    }
    return current;
}

describe('math palette — every button drives the graphical editor', () => {
    it('maps every button in the catalog onto a tree operation', () => {
        // The regression this pins: `vector` and `2×2` were filed under Structures
        // with no mapping, so clicking them did nothing at all. A control that
        // silently does nothing is indistinguishable from a broken one.
        for (const action of MATH_PALETTE) {
            const root = tree('x = 1');
            const result = applyPaletteAction(root, lastAnchor(root), action);
            expect(result, `no graphical mapping for "${action.id}"`).not.toBeNull();
        }
    });

    it('changes the tree for every button', () => {
        for (const action of MATH_PALETTE) {
            const { root, result } = press(action.id);
            expect(
                serializeMathMl(result.root),
                `"${action.id}" left the expression unchanged`,
            ).not.toBe(serializeMathMl(root));
        }
    });

    it('leaves the caret on a real position for every button', () => {
        for (const action of MATH_PALETTE) {
            const { result } = press(action.id);
            expect(
                nodeAt(result.root, result.anchor.path),
                `"${action.id}" put the caret off the tree`,
            ).not.toBeNull();
        }
    });

    it('produces a line the editor can commit once the edit is finished', () => {
        // The end-to-end property: whatever a button builds must print back to
        // Calcpad the bridge accepts, or the line would silently stop being
        // editable the moment the user pressed it.
        for (const action of MATH_PALETTE) {
            const { result } = press(action.id);
            const finished = finishEdit(result.root, result.anchor);

            const text = mathMlToCalcpadLine(finished);
            expect(text, `"${action.id}" produced text that will not print`).not.toBeNull();
            expect(
                checkGraphicallyEditable(text!).ok,
                `"${action.id}" produced ${text}, which is not graphically editable`,
            ).toBe(true);
        }
    });

    it('produces a tree a reload would reproduce, for every button', () => {
        // The invariant the editor rests on: the tree it holds must be the tree
        // its own parser builds from the text it prints. A button that breaks it
        // leaves the line in a state the editor models differently from a
        // reopened one — the edit "works" until you click away and back.
        for (const action of MATH_PALETTE) {
            const { result } = press(action.id);
            const finished = finishEdit(result.root, result.anchor);
            const text = mathMlToCalcpadLine(finished);
            expect(text, `"${action.id}" produced text that will not print`).not.toBeNull();

            const reopened = calcpadLineToMathMl(text!).root;
            expect(reopened, `"${action.id}" produced ${text}, which does not re-parse`).not.toBeNull();
            expect(
                equalNodes(finished, reopened!),
                `"${action.id}" produced a tree a reload would not reproduce (${text})`,
            ).toBe(true);
        }
    });

    it('builds the structures the operator buttons stand for', () => {
        // The Operators buttons must do what typing the character does. They used
        // to insert a bare glyph, so `/` left a flat slash where typing `/`
        // builds a fraction.
        expect(serializeMathMl(press('op-3').result.root)).toContain('<mfrac>');
        expect(serializeMathMl(press('op-4').result.root)).toContain('<mfrac>');
        expect(serializeMathMl(press('op-5').result.root)).toContain('<msup>');
        expect(serializeMathMl(press('op-6').result.root)).toContain('<msub>');
    });

    it('agrees with typing for every character button', () => {
        // Pressing a button and typing its glyph must produce the same tree.
        for (const action of MATH_PALETTE) {
            if (action.group !== 'Operators' && action.group !== 'Relations') continue;
            const root = tree('x = 1');
            const typed = applyCharacter(root, lastAnchor(root), action.label).root;
            const { result } = press(action.id);
            expect(
                serializeMathMl(result.root),
                `"${action.id}" (${action.label}) differs from typing it`,
            ).toBe(serializeMathMl(typed));
        }
    });

    it('builds a bracketed literal for the vector and matrix buttons', () => {
        // These two were the dead ones; assert they build real tables rather than
        // merely changing something.
        expect(serializeMathMl(press('vector').result.root)).toContain('<mtable>');
        expect(serializeMathMl(press('matrix2x2').result.root)).toContain('<mtable>');
    });

    it('gives the cube-root button a filled degree', () => {
        // `cbrt` used to build `root(x; )` — an open slot for a degree the button
        // had already promised in its own tooltip.
        const built = press('cbrt').result.root;
        expect(mathMlToCalcpadLine(built)).toContain('root(1; 3)');
        expect(hasEmptySlot(built)).toBe(false);
    });
});
