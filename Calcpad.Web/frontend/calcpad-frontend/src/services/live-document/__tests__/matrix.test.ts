import { describe, it, expect } from 'vitest'
import { parseMatrixLiteral, matrixLiteralRange, buildMatrixLiteral } from '../matrix'

describe('parseMatrixLiteral', () => {
    it('parses a simple matrix', () => {
        const result = parseMatrixLiteral('A = [1; 2; 3|4; 5; 6]')
        expect(result).toEqual([
            ['1', '2', '3'],
            ['4', '5', '6'],
        ])
    })

    it('parses a single-row matrix', () => {
        const result = parseMatrixLiteral('[a; b; c]')
        expect(result).toEqual([['a', 'b', 'c']])
    })

    it('parses a single-column matrix', () => {
        const result = parseMatrixLiteral('[x|y|z]')
        expect(result).toEqual([['x'], ['y'], ['z']])
    })

    it('trims whitespace around cells', () => {
        const result = parseMatrixLiteral('[ 1 ; 2 | 3 ; 4 ]')
        expect(result).toEqual([
            ['1', '2'],
            ['3', '4'],
        ])
    })

    it('returns null when no brackets', () => {
        expect(parseMatrixLiteral('x = 5')).toBeNull()
    })

    it('returns null for empty brackets', () => {
        expect(parseMatrixLiteral('[]')).toBeNull()
    })

    it('returns null for brackets without ; or |', () => {
        expect(parseMatrixLiteral('[1, 2, 3]')).toBeNull()
    })

    it('handles nested brackets by using outermost', () => {
        const result = parseMatrixLiteral('f([1; 2|3; 4])')
        expect(result).toEqual([
            ['1', '2'],
            ['3', '4'],
        ])
    })
})

describe('matrixLiteralRange', () => {
    it('returns the range of the matrix literal', () => {
        const range = matrixLiteralRange('A = [1; 2]')
        expect(range).toEqual({ start: 4, end: 10 })
    })

    it('returns null when there is no matrix', () => {
        expect(matrixLiteralRange('x = 5')).toBeNull()
    })
})

describe('buildMatrixLiteral', () => {
    it('builds a matrix string', () => {
        const result = buildMatrixLiteral([
            ['1', '2', '3'],
            ['4', '5', '6'],
        ])
        expect(result).toBe('[1;2;3|4;5;6]')
    })

    it('builds a single-row matrix', () => {
        expect(buildMatrixLiteral([['a', 'b']])).toBe('[a;b]')
    })

    it('builds a single-column matrix', () => {
        expect(buildMatrixLiteral([['x'], ['y']])).toBe('[x|y]')
    })
})
