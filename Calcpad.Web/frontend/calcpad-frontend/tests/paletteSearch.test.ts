import { describe, it, expect } from 'vitest';
import { MATH_PALETTE, paletteAction } from '../src/text/math-palette';
import { rankPalette, wrapIndex } from '../src/text/palette-search';

describe('rankPalette', () => {
    it('answers a function name', () => {
        const top = rankPalette(MATH_PALETTE, 'sin').slice(0, 3).map(a => a.id);
        expect(top).toContain('fn-sin');
        // `asin` also contains "sin" but must not outrank the exact name.
        expect(top[0]).toBe('fn-sin');
    });

    it('answers a glyph', () => {
        expect(rankPalette(MATH_PALETTE, '√')[0].id).toBe('sqrt');
        expect(rankPalette(MATH_PALETTE, 'Σ')[0].id).toBe('sum');
    });

    it('finds a structure by a word inside its title', () => {
        const ids = rankPalette(MATH_PALETTE, 'root').map(a => a.id);
        expect(ids).toContain('cbrt');
        expect(ids).toContain('nroot');
    });

    it('finds a matrix literal', () => {
        expect(rankPalette(MATH_PALETTE, 'matrix').map(a => a.id)).toContain('matrix2x2');
    });

    it('returns nothing for a term nothing matches', () => {
        expect(rankPalette(MATH_PALETTE, 'zzzz')).toEqual([]);
    });

    it('opens on what was used recently', () => {
        const recent = ['fn-tan', 'sqrt'];
        const ids = rankPalette(MATH_PALETTE, '', recent).map(a => a.id);
        expect(ids.slice(0, 2)).toEqual(recent);
        // Everything else still follows, so nothing becomes unreachable.
        expect(ids).toHaveLength(MATH_PALETTE.length);
    });

    it('puts the exact name first even when a weaker match was used recently', () => {
        // `asin` contains "sin", so it matches — but a recent use must not lift it
        // above the exact answer.
        const ids = rankPalette(MATH_PALETTE, 'sin', ['fn-asin']).map(a => a.id);
        expect(ids[0]).toBe('fn-sin');
        expect(ids).toContain('fn-asin');
    });

    it('breaks an equal match towards the recent action', () => {
        // Both are "roots"; recency decides between them.
        const ids = rankPalette(MATH_PALETTE, 'root', ['nroot']).map(a => a.id);
        expect(ids[0]).toBe('nroot');
        expect(ids).toContain('cbrt');
    });

    it('ignores a recent id that is no longer in the catalog', () => {
        const ids = rankPalette(MATH_PALETTE, '', ['gone', 'sqrt']).map(a => a.id);
        expect(ids[0]).toBe('sqrt');
        expect(ids).toHaveLength(MATH_PALETTE.length);
    });

    it('ranks every action uniquely, so nothing is dropped', () => {
        for (const query of ['', 'a', 'x', 'n']) {
            const ids = rankPalette(MATH_PALETTE, query).map(a => a.id);
            expect(new Set(ids).size).toBe(ids.length);
        }
        expect(paletteAction('sqrt')).toBeDefined();
    });
});

describe('wrapIndex', () => {
    it('wraps at both ends', () => {
        expect(wrapIndex(0, -1, 3)).toBe(2);
        expect(wrapIndex(2, 1, 3)).toBe(0);
        expect(wrapIndex(1, 1, 3)).toBe(2);
    });

    it('is safe for an empty list', () => {
        expect(wrapIndex(0, 1, 0)).toBe(0);
    });
});
