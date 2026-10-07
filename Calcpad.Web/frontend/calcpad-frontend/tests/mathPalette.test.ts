import { describe, it, expect } from 'vitest';
import {
    MATH_PALETTE,
    PALETTE_GROUPS,
    paletteAction,
    paletteGroup,
    searchPalette,
} from '../src/text/math-palette';

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
