import { describe, it, expect } from 'vitest'
import { tokenizeLine, annotateSlots } from '../math-slots'

describe('tokenizeLine', () => {
    it('tokenizes identifiers', () => {
        const tokens = tokenizeLine('x = a + b')
        expect(tokens.map(t => t.text)).toEqual(['x', '=', 'a', '+', 'b'])
    })

    it('tokenizes numbers', () => {
        const tokens = tokenizeLine('y = 3.14')
        expect(tokens.map(t => t.text)).toEqual(['y', '=', '3.14'])
    })

    it('stops at comment quotes', () => {
        const tokens = tokenizeLine("x = 5 ' this is ignored")
        expect(tokens.map(t => t.text)).toEqual(['x', '=', '5'])
    })

    it('returns empty for blank lines', () => {
        expect(tokenizeLine('')).toEqual([])
    })

    it('returns empty for comment-only lines', () => {
        expect(tokenizeLine("' comment")).toEqual([])
    })

    it('maps operators to rendered glyphs', () => {
        const tokens = tokenizeLine('a * b - c')
        expect(tokens.find(t => t.text === '*')?.rendered).toBe('·')
        expect(tokens.find(t => t.text === '-')?.rendered).toBe('−')
    })

    it('renders pi as π', () => {
        const tokens = tokenizeLine('pi')
        expect(tokens[0]?.rendered).toBe('π')
    })

    it('renders infinity as ∞', () => {
        const tokens = tokenizeLine('infinity')
        expect(tokens[0]?.rendered).toBe('∞')
    })

    it('marks structural names as null', () => {
        const tokens = tokenizeLine('sqrt(x)')
        expect(tokens.find(t => t.text === 'sqrt')?.rendered).toBeNull()
    })

    it('marks structural operators as null', () => {
        const tokens = tokenizeLine('a ^ b / c')
        expect(tokens.find(t => t.text === '^')?.rendered).toBeNull()
        expect(tokens.find(t => t.text === '/')?.rendered).toBeNull()
    })
})

describe('annotateSlots', () => {
    it('returns null for empty HTML', () => {
        expect(annotateSlots('', 'x = 5')).toBeNull()
    })

    it('returns null for blank source', () => {
        expect(annotateSlots('<var>x</var>', '')).toBeNull()
    })

    it('wraps matching variables', () => {
        const map = annotateSlots('<var>x</var> = <mn>5</mn>', 'x = 5')
        expect(map).not.toBeNull()
        expect(map!.slots.length).toBeGreaterThan(0)
        expect(map!.html).toContain('data-ms-slot')
    })

    it('returns null when nothing matches', () => {
        const map = annotateSlots('<p>completely different</p>', 'x = 5')
        expect(map).toBeNull()
    })

    it('returns null for comment lines', () => {
        const map = annotateSlots('<p>text</p>', "' comment")
        expect(map).toBeNull()
    })

    it('matches numbers in rendered output', () => {
        const map = annotateSlots('<mn>42</mn>', '42')
        expect(map).not.toBeNull()
        expect(map!.slots.length).toBe(1)
    })

    it('wraps operators that have rendered glyphs', () => {
        const map = annotateSlots('<mo>·</mo>', 'a * b')
        expect(map).not.toBeNull()
    })
})
