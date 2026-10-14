import { describe, it, expect } from 'vitest'
import { buildLiveDocument } from '../document'

describe('buildLiveDocument', () => {
    it('builds from source only', () => {
        const doc = buildLiveDocument('a = 5\nb = 10', null)
        expect(doc.lines).toHaveLength(2)
        expect(doc.lines[0]).toMatchObject({ number: 1, text: 'a = 5', editable: true })
        expect(doc.lines[1]).toMatchObject({ number: 2, text: 'b = 10', editable: true })
        expect(doc.totalLines).toBe(2)
        expect(doc.editableCount).toBe(2)
        expect(doc.endsWithNewline).toBe(false)
    })

    it('counts a trailing newline as an extra empty line', () => {
        const doc = buildLiveDocument('a = 5\n', null)
        expect(doc.lines).toHaveLength(2)
        expect(doc.lines[1]).toMatchObject({ number: 2, text: '', editable: true })
        expect(doc.totalLines).toBe(2)
        expect(doc.endsWithNewline).toBe(true)
    })

    it('marks comment lines as non-editable', () => {
        const doc = buildLiveDocument("x = 5\n' comment\ny = 10", null)
        expect(doc.lines[0].editable).toBe(true)
        expect(doc.lines[1].editable).toBe(false)
        expect(doc.lines[2].editable).toBe(true)
        expect(doc.editableCount).toBe(2)
    })

    it('marks blank middle lines as non-editable', () => {
        const doc = buildLiveDocument('a = 5\n\nb = 10', null)
        expect(doc.lines[0].editable).toBe(true)
        expect(doc.lines[1].editable).toBe(false)
        expect(doc.lines[2].editable).toBe(true)
    })

    it('marks the last blank line as editable', () => {
        const doc = buildLiveDocument('a = 5\n', null)
        expect(doc.lines[1].editable).toBe(true)
    })

    it('attaches rendered HTML when provided', () => {
        const html = '<p data-source-line="1">rendered a</p><p data-source-line="2">rendered b</p>'
        const doc = buildLiveDocument('a = 5\nb = 10', html)
        expect(doc.lines[0].rendered).toBe('rendered a')
        expect(doc.lines[1].rendered).toBe('rendered b')
    })

    it('flags error lines', () => {
        const html = '<p class="err" data-source-line="1">error msg</p>'
        const doc = buildLiveDocument('bad syntax', html)
        expect(doc.lines[0].error).toBe(true)
        expect(doc.lines[0].rendered).toBe('error msg')
    })

    it('handles empty source', () => {
        const doc = buildLiveDocument('', null)
        expect(doc.lines).toHaveLength(1)
        expect(doc.lines[0]).toMatchObject({ number: 1, text: '', editable: true })
    })
})
