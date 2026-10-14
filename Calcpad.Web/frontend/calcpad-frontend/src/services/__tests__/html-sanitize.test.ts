import { describe, it, expect } from 'vitest'
import { sanitizeRenderedHtml } from '../html-sanitize'

describe('sanitizeRenderedHtml', () => {
    it('passes allowed tags through', () => {
        const html = '<p>hello</p><div>world</div>'
        expect(sanitizeRenderedHtml(html)).toBe('<p>hello</p><div>world</div>')
    })

    it('strips script tags with their content', () => {
        const html = '<p>before</p><script>alert(1)</script><p>after</p>'
        expect(sanitizeRenderedHtml(html)).toBe('<p>before</p><p>after</p>')
    })

    it('strips style tags with their content', () => {
        const html = '<style>body{color:red}</style><p>text</p>'
        expect(sanitizeRenderedHtml(html)).toBe('<p>text</p>')
    })

    it('strips iframe tags', () => {
        const html = '<iframe src="evil.com"></iframe><p>safe</p>'
        expect(sanitizeRenderedHtml(html)).toBe('<p>safe</p>')
    })

    it('unwraps disallowed but non-dangerous tags', () => {
        const html = '<font color="red">text</font>'
        expect(sanitizeRenderedHtml(html)).toBe('text')
    })

    it('keeps allowed attributes', () => {
        const html = '<p class="intro" id="p1">text</p>'
        expect(sanitizeRenderedHtml(html)).toBe('<p class="intro" id="p1">text</p>')
    })

    it('removes disallowed attributes', () => {
        const html = '<p onclick="alert(1)" style="color:red">text</p>'
        expect(sanitizeRenderedHtml(html)).toBe('<p>text</p>')
    })

    it('removes event handler attributes', () => {
        const html = '<div onload="evil()" onerror="bad()">content</div>'
        expect(sanitizeRenderedHtml(html)).toBe('<div>content</div>')
    })

    it('allows data:image URLs in src', () => {
        const html = '<img src="data:image/png;base64,abc123">'
        expect(sanitizeRenderedHtml(html)).toBe('<img src="data:image/png;base64,abc123">')
    })

    it('removes http URLs from src', () => {
        const html = '<img src="http://evil.com/x.png">'
        expect(sanitizeRenderedHtml(html)).toBe('<img>')
    })

    it('allows https URLs in href', () => {
        const html = '<a href="https://example.com">link</a>'
        expect(sanitizeRenderedHtml(html)).toBe('<a href="https://example.com">link</a>')
    })

    it('handles self-closing tags', () => {
        const html = '<br /><hr/>'
        expect(sanitizeRenderedHtml(html)).toBe('<br/><hr/>')
    })

    it('preserves MathML tags', () => {
        const html = '<math><mrow><mi>x</mi><mo>=</mo><mn>5</mn></mrow></math>'
        expect(sanitizeRenderedHtml(html)).toBe(html)
    })

    it('preserves SVG tags', () => {
        const html = '<svg><circle cx="5" cy="5" r="3"/></svg>'
        expect(sanitizeRenderedHtml(html)).toBe(html)
    })

    it('drops HTML comments', () => {
        const html = '<p>before</p><!-- comment --><p>after</p>'
        expect(sanitizeRenderedHtml(html)).toBe('<p>before</p><p>after</p>')
    })

    it('handles text with stray < characters', () => {
        const html = 'a < b and c > d'
        expect(sanitizeRenderedHtml(html)).toBe('a < b and c > d')
    })

    it('encodes attribute values', () => {
        const html = '<p title="a &quot;b&quot;">text</p>'
        // The sanitizer re-encodes & as &amp; since it does not decode entities first
        expect(sanitizeRenderedHtml(html)).toBe('<p title="a &amp;quot;b&amp;quot;">text</p>')
    })

    it('rejects attributes with < or > in values', () => {
        const html = '<p title="<script>">text</p>'
        expect(sanitizeRenderedHtml(html)).toBe('<p>text</p>')
    })
})
