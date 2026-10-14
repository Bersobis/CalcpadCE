import { describe, it, expect } from 'vitest'
import { extractRenderedLines } from '../render'

describe('extractRenderedLines', () => {
    it('returns empty map for empty HTML', () => {
        expect(extractRenderedLines('')).toEqual(new Map())
    })

    it('extracts a single tagged element', () => {
        const html = '<p data-source-line="1">hello</p>'
        const result = extractRenderedLines(html)
        expect(result.get(1)).toEqual({ html: 'hello', error: false })
    })

    it('extracts multiple lines', () => {
        const html = `
            <p data-source-line="1">first</p>
            <p data-source-line="2">second</p>
            <p data-source-line="3">third</p>
        `
        const result = extractRenderedLines(html)
        expect(result.get(1)).toEqual({ html: 'first', error: false })
        expect(result.get(2)).toEqual({ html: 'second', error: false })
        expect(result.get(3)).toEqual({ html: 'third', error: false })
    })

    it('keeps the first occurrence of a repeated line', () => {
        const html = `
            <p data-source-line="5">iteration 1</p>
            <p data-source-line="5">iteration 2</p>
        `
        const result = extractRenderedLines(html)
        expect(result.get(5)).toEqual({ html: 'iteration 1', error: false })
    })

    it('skips nested tags with the same attribute', () => {
        const html = '<div data-source-line="1"><span data-source-line="1">inner</span></div>'
        const result = extractRenderedLines(html)
        expect(result.get(1)).toEqual({ html: '<span data-source-line="1">inner</span>', error: false })
    })

    it('detects error boxes by class', () => {
        const html = '<p class="err" data-source-line="1">bad</p>'
        const result = extractRenderedLines(html)
        expect(result.get(1)).toEqual({ html: 'bad', error: true })
    })

    it('detects errors in nested content', () => {
        const html = '<div data-source-line="1"><span class="err">nested error</span></div>'
        const result = extractRenderedLines(html)
        expect(result.get(1)).toEqual({ html: '<span class="err">nested error</span>', error: true })
    })

    it('captures void elements (e.g. plots as img)', () => {
        const html = '<img data-source-line="5" class="plot" src="data:image/png;base64,abc">'
        const result = extractRenderedLines(html)
        expect(result.get(5)).toEqual({
            html: '<img data-source-line="5" class="plot" src="data:image/png;base64,abc">',
            error: false,
        })
    })

    it('captures self-closing tags', () => {
        const html = '<br data-source-line="3" />'
        const result = extractRenderedLines(html)
        expect(result.get(3)).toEqual({
            html: '<br data-source-line="3" />',
            error: false,
        })
    })

    it('ignores tags without data-source-line', () => {
        const html = '<p>no line</p><p data-source-line="2">has line</p>'
        const result = extractRenderedLines(html)
        expect(result.has(1)).toBe(false)
        expect(result.get(2)).toEqual({ html: 'has line', error: false })
    })

    it('ignores closing tags', () => {
        const html = '</p><p data-source-line="1">content</p>'
        const result = extractRenderedLines(html)
        expect(result.get(1)).toEqual({ html: 'content', error: false })
    })

    it('ignores comments and processing instructions', () => {
        const html = '<!-- comment --><p data-source-line="1">content</p>'
        const result = extractRenderedLines(html)
        expect(result.get(1)).toEqual({ html: 'content', error: false })
    })

    it('handles tags with quoted attributes containing >', () => {
        const html = '<p data-source-line="1" title="a > b">content</p>'
        const result = extractRenderedLines(html)
        expect(result.get(1)).toEqual({ html: 'content', error: false })
    })

    it('handles deeply nested same-tag structures', () => {
        const html = '<div data-source-line="1"><div><div>deep</div></div></div>'
        const result = extractRenderedLines(html)
        expect(result.get(1)).toEqual({
            html: '<div><div>deep</div></div>',
            error: false,
        })
    })
})
