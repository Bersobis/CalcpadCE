import { describe, it, expect } from 'vitest'
import { splitSourceLines, isLiveEditableLine } from '../source'

describe('splitSourceLines', () => {
    it('splits on newlines', () => {
        expect(splitSourceLines('a\nb\nc')).toEqual(['a', 'b', 'c'])
    })

    it('produces an extra empty line for a trailing newline', () => {
        expect(splitSourceLines('a\nb\n')).toEqual(['a', 'b', ''])
    })

    it('handles a single line without newline', () => {
        expect(splitSourceLines('hello')).toEqual(['hello'])
    })

    it('handles empty string', () => {
        expect(splitSourceLines('')).toEqual([''])
    })

    it('handles multiple consecutive newlines', () => {
        expect(splitSourceLines('a\n\n\nb')).toEqual(['a', '', '', 'b'])
    })
})

describe('isLiveEditableLine', () => {
    it('returns true for non-empty, non-comment lines', () => {
        expect(isLiveEditableLine('x = 5', false)).toBe(true)
        expect(isLiveEditableLine('  y = 10  ', false)).toBe(true)
    })

    it('returns false for comment lines', () => {
        expect(isLiveEditableLine("' this is a comment", false)).toBe(false)
        expect(isLiveEditableLine("  ' indented comment", false)).toBe(false)
    })

    it('returns false for blank lines in the middle', () => {
        expect(isLiveEditableLine('', false)).toBe(false)
        expect(isLiveEditableLine('   ', false)).toBe(false)
    })

    it('returns true for the last blank line', () => {
        expect(isLiveEditableLine('', true)).toBe(true)
        expect(isLiveEditableLine('   ', true)).toBe(true)
    })
})
