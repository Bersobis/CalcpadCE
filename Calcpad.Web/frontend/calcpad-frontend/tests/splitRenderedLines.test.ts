// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { splitRenderedLines } from '../src/api/client';

/**
 * The engine's debug output tags each rendered line with `id="line-N"`. These
 * tests pin the contract the live display depends on: one entry per source line,
 * `null` where nothing was rendered, and a stable index for every line.
 */
function page(body: string): string {
    return `<!DOCTYPE html><html><head><style>.eq{}</style></head><body>${body}</body></html>`;
}

describe('splitRenderedLines', () => {
    it('maps each rendered line to its source line', () => {
        const html = page(
            '<p id="line-1" data-source-line="1" class="line"><span class="eq">a = 5</span></p>\n'
            + '<p id="line-2" data-source-line="2" class="line"><span class="eq">b = a + 1</span> = <span class="eq">6</span></p>',
        );
        const lines = splitRenderedLines(html, 'a = 5\nb = a + 1');
        expect(lines).toHaveLength(2);
        expect(lines[0]).toContain('a = 5');
        expect(lines[1]).toContain('6');
    });

    it('leaves a gap for a line the engine did not render', () => {
        const html = page(
            '<p id="line-1" class="line">a</p>'
            + '<p id="line-3" class="line">c</p>',
        );
        const lines = splitRenderedLines(html, 'a\nb\nc');
        expect(lines[0]).toContain('a');
        expect(lines[1]).toBeNull();
        expect(lines[2]).toContain('c');
    });

    it('keeps one entry per source line, even for a blank document', () => {
        expect(splitRenderedLines(page(''), '')).toHaveLength(1);
        expect(splitRenderedLines(page(''), 'a\n\nb')).toHaveLength(3);
    });

    it('ignores an anchor past the end of the source', () => {
        const html = page('<p id="line-1" class="line">a</p><p id="line-9" class="line">z</p>');
        const lines = splitRenderedLines(html, 'a');
        expect(lines).toEqual([expect.stringContaining('a')]);
    });

    it('keeps the first match when an anchor repeats', () => {
        const html = page(
            '<p id="line-1" class="line">first</p>'
            + '<p id="line-1" class="line">second</p>',
        );
        const lines = splitRenderedLines(html, 'only');
        expect(lines[0]).toContain('first');
        expect(lines[0]).not.toContain('second');
    });

    it('reads nested markup out of the line element, not the wrapper', () => {
        const html = page(
            '<p id="line-1" class="line"><span class="matrix"><span class="tr">'
            + '<span class="td"></span><span class="td">1</span><span class="td">2</span><span class="td"></span>'
            + '</span></span></p>',
        );
        const lines = splitRenderedLines(html, 'M = [1; 2]');
        expect(lines[0]).toContain('matrix');
        expect(lines[0]).toContain('2');
    });
});
