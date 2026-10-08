// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
    parseModeMap,
    markupBlocks,
    markupBlockAt,
    isEndDirective,
    openerMode,
    stripLineAnchors,
    markupBlockHtml,
    hasBalancedTags,
    checkMarkupHtml,
    htmlToMarkdown,
    checkMarkupEditable,
    commitMarkupBlock,
} from '../src/markup';
import type { MarkupBlock } from '../src/markup';

/** A worksheet, one entry per line. */
const sheet = (parts: string[]): string[] => parts;

describe('parse modes', () => {
    it('marks a #html block and leaves the directives out of it', () => {
        const source = sheet(['x = 5', '#html', '<b>hi</b>', '#end html', 'y = 6']);
        const map = parseModeMap(source);
        expect(map.map(m => m.mode)).toEqual(['cpd', 'cpd', 'html', 'html', 'cpd']);
        expect(map.map(m => m.directive)).toEqual([false, true, false, true, false]);
    });

    it('marks a #markdown block', () => {
        const map = parseModeMap(sheet(['#markdown', '## Head', 'text', '#end markdown']));
        expect(map.map(m => m.mode)).toEqual(['cpd', 'markdown', 'markdown', 'markdown']);
    });

    it('runs an unterminated block to the end of the file', () => {
        const map = parseModeMap(sheet(['#markdown', 'text', 'more']));
        expect(map.map(m => m.mode)).toEqual(['cpd', 'markdown', 'markdown']);
    });

    it('treats only the matching #end as a directive', () => {
        // `#end markdown` inside `#html` is content, not a close.
        const map = parseModeMap(sheet(['#html', '#end markdown', '#end html']));
        expect(map[1].directive).toBe(false);
        expect(map[1].mode).toBe('html');
        expect(map[2].directive).toBe(true);
    });

    it('tracks a nested #cpd block inside #html', () => {
        const map = parseModeMap(sheet(['#html', '<div>', '#cpd', 'A = 2', '#end cpd', '</div>', '#end html']));
        expect(map.map(m => m.mode)).toEqual(['cpd', 'html', 'html', 'cpd', 'cpd', 'html', 'html']);
    });

    it('needs a word boundary, so #htmlnotes is not a directive', () => {
        expect(openerMode('#htmlnotes')).toBeNull();
        expect(openerMode('#html')).toBe('html');
        expect(openerMode('#html x > 3')).toBe('html');
        expect(openerMode('#HTML')).toBe('html');
    });

    it('does not treat #md as a mode opener', () => {
        // `#md on` is a different feature: a toggle for comment rendering.
        expect(openerMode('#md on')).toBeNull();
        expect(parseModeMap(sheet(['#md on', 'text'])).every(m => m.mode === 'cpd')).toBe(true);
    });

    it('matches the end directive case-insensitively', () => {
        expect(isEndDirective('#END HTML', 'html')).toBe(true);
        expect(isEndDirective('#end html', 'markdown')).toBe(false);
    });
});

describe('markup blocks', () => {
    it('groups a markdown region into one block', () => {
        const source = sheet(['x = 5', '#markdown', '## H', 'text', '#end markdown', 'y = 6']);
        expect(markupBlocks(source)).toEqual([{ mode: 'markdown', startLine: 2, endLine: 3 }]);
    });

    it('reports each html line as its own block', () => {
        const source = sheet(['#html', '<b>a</b>', '<i>b</i>', '#end html']);
        expect(markupBlocks(source)).toEqual([
            { mode: 'html', startLine: 1, endLine: 1 },
            { mode: 'html', startLine: 2, endLine: 2 },
        ]);
    });

    it('finds the block containing a line', () => {
        const blocks = markupBlocks(sheet(['#markdown', 'a', 'b', '#end markdown']));
        expect(markupBlockAt(blocks, 1)?.startLine).toBe(1);
        expect(markupBlockAt(blocks, 2)?.endLine).toBe(2);
        expect(markupBlockAt(blocks, 9)).toBeNull();
    });

    it('returns nothing when there is no markup', () => {
        expect(markupBlocks(sheet(['x = 1', 'y = 2']))).toEqual([]);
    });
});

describe('line anchors', () => {
    it('removes the attributes the engine injects', () => {
        expect(stripLineAnchors('<div class="note" id="line-3" data-source-line="3" class="line">x</div>'))
            .toBe('<div class="note">x</div>');
    });

    it('leaves author attributes alone', () => {
        expect(stripLineAnchors('<a href="/a" title="t">x</a>')).toBe('<a href="/a" title="t">x</a>');
    });

    it('reassembles a block from the lines it rendered into', () => {
        const block: MarkupBlock = { mode: 'markdown', startLine: 1, endLine: 3 };
        const rows = [
            null,
            '<h2 id="line-2" data-source-line="2" class="line">Head</h2>',
            null,
            '<p id="line-4" data-source-line="4" class="line">Body</p>',
        ];
        expect(markupBlockHtml(block, rows)).toBe('<h2>Head</h2>\n<p>Body</p>');
    });
});

describe('balanced tags', () => {
    it('accepts a self-contained element', () => {
        expect(hasBalancedTags('<div class="note">x</div>')).toBe(true);
        expect(hasBalancedTags('<b>x</b> is large')).toBe(true);
    });

    it('rejects a line that is part of a multi-line element', () => {
        expect(hasBalancedTags('<style>')).toBe(false);
        expect(hasBalancedTags('</style>')).toBe(false);
        expect(hasBalancedTags('    .note { color: red; }')).toBe(true); // no tags at all
    });

    it('ignores void elements', () => {
        expect(hasBalancedTags('a<br>b')).toBe(true);
        expect(hasBalancedTags('<img src="x.png">')).toBe(true);
    });
});

describe('checkMarkupHtml', () => {
    it('accepts the modelled subset', () => {
        expect(checkMarkupHtml('<h2>Head</h2><p>Text with <strong>bold</strong>.</p>').ok).toBe(true);
        expect(checkMarkupHtml('<ul><li>one</li></ul>').ok).toBe(true);
        expect(checkMarkupHtml('<table><tr><td>a</td></tr></table>').ok).toBe(true);
        expect(checkMarkupHtml('<a href="https://x.test">x</a>').ok).toBe(true);
    });

    it('refuses scripting and framing elements', () => {
        for (const html of [
            '<script>alert(1)</script>',
            '<style>p{}</style>',
            '<iframe src="x"></iframe>',
            '<form><input type="text"></form>',
            '<svg><circle r="1"/></svg>',
            '<div onclick="x()">hi</div>',
        ]) {
            expect(checkMarkupHtml(html).ok, html).toBe(false);
        }
    });

    it('refuses attributes with no Markdown meaning', () => {
        expect(checkMarkupHtml('<p class="note">x</p>').ok).toBe(false);
        expect(checkMarkupHtml('<p style="color:red">x</p>').ok).toBe(false);
    });

    it('refuses a scripting URL', () => {
        expect(checkMarkupHtml('<a href="javascript:alert(1)">x</a>').ok).toBe(false);
        expect(checkMarkupHtml('<img src="javascript:alert(1)">').ok).toBe(false);
        expect(checkMarkupHtml('<a href="https://ok.test">x</a>').ok).toBe(true);
        expect(checkMarkupHtml('<a href="#anchor">x</a>').ok).toBe(true);
    });

    it('allows a task-list checkbox but no other input', () => {
        expect(checkMarkupHtml('<ul><li><input type="checkbox" checked disabled>done</li></ul>').ok).toBe(true);
        expect(checkMarkupHtml('<input type="text">').ok).toBe(false);
    });

    it('reports what it refused', () => {
        expect(checkMarkupHtml('<script>x</script>').reason).toContain('<script>');
    });
});

describe('html to markdown', () => {
    it('converts headings and paragraphs', () => {
        expect(htmlToMarkdown('<h2>Head</h2><p>Body</p>')).toBe('## Head\n\nBody\n');
    });

    it('converts the inline set', () => {
        expect(htmlToMarkdown('<p><strong>b</strong> <em>i</em> <code>c</code></p>'))
            .toBe('**b** *i* `c`\n');
        expect(htmlToMarkdown('<p><del>d</del> <ins>u</ins> <sub>s</sub> <sup>p</sup></p>'))
            .toBe('~~d~~ ++u++ ~s~ ^p^\n');
    });

    it('converts links and images', () => {
        expect(htmlToMarkdown('<p><a href="/a">text</a></p>')).toBe('[text](/a)\n');
        expect(htmlToMarkdown('<p><img src="/i.png" alt="alt"></p>')).toBe('![alt](/i.png)\n');
    });

    it('converts lists', () => {
        expect(htmlToMarkdown('<ul><li>one</li><li>two</li></ul>')).toBe('- one\n- two\n');
        expect(htmlToMarkdown('<ol><li>one</li><li>two</li></ol>')).toBe('1. one\n2. two\n');
    });

    it('converts a task list', () => {
        expect(htmlToMarkdown('<ul><li><input type="checkbox" checked disabled>done</li></ul>'))
            .toBe('- [x] done\n');
    });

    it('converts a blockquote and a rule', () => {
        expect(htmlToMarkdown('<blockquote><p>quoted</p></blockquote>')).toBe('> quoted\n');
        expect(htmlToMarkdown('<hr>')).toBe('---\n');
    });

    it('converts a fenced code block and keeps its language', () => {
        expect(htmlToMarkdown('<pre><code class="language-js">let x = 1;</code></pre>'))
            .toBe('```js\nlet x = 1;\n```\n');
    });

    it('converts a pipe table with alignment', () => {
        const html = '<table><thead><tr><th>Case</th><th align="right">Load</th></tr></thead>'
            + '<tbody><tr><td>Dead</td><td align="right">5</td></tr></tbody></table>';
        expect(htmlToMarkdown(html)).toBe('| Case | Load |\n| --- | ---: |\n| Dead | 5 |\n');
    });

    it('escapes text that would otherwise become markup', () => {
        expect(htmlToMarkdown('<p>a * b _ c</p>')).toBe('a \\* b \\_ c\n');
        expect(htmlToMarkdown('<p>2 &lt; 3</p>')).toBe('2 &lt; 3\n');
        expect(htmlToMarkdown('<p>a ~~ b</p>')).toBe('a \\~\\~ b\n');
    });

    it('collapses whitespace the way HTML renders it', () => {
        // Markdig writes a task-list checkbox as `<input> done`, and the item's
        // own text starts with a space: keeping both would write `- [x]  done`.
        expect(htmlToMarkdown('<ul><li><input type="checkbox" checked disabled> done</li></ul>'))
            .toBe('- [x] done\n');
    });

    it('escapes a pipe inside a table cell', () => {
        expect(htmlToMarkdown('<table><tr><td>a|b</td></tr></table>')).toBe('| a\\|b |\n| --- |\n');
    });

    it('declines anything outside the subset', () => {
        expect(htmlToMarkdown('<p>a <span>b</span></p>')).toBeNull();
        expect(htmlToMarkdown('<div class="x">y</div>')).toBeNull();
        expect(htmlToMarkdown('<p><a>x</a></p>')).toBeNull(); // link with no href
    });
});

describe('checkMarkupEditable', () => {
    it('opens a self-contained html line from its own source', () => {
        // An `#html` line is written to the output verbatim, so the author's
        // source line is the markup — nothing has to be reconstructed.
        const block: MarkupBlock = { mode: 'html', startLine: 1, endLine: 1 };
        const source = ['#html', '<div class="note">hi</div>', '#end html'];
        const check = checkMarkupEditable(block, source, []);
        expect(check.ok).toBe(true);
        expect(check.html).toBe('<div class="note">hi</div>');
    });

    it('declines an html line that is part of a multi-line element', () => {
        const block: MarkupBlock = { mode: 'html', startLine: 1, endLine: 1 };
        const source = ['#html', '<style>', '  .n { color: red; }', '</style>', '#end html'];
        expect(checkMarkupEditable(block, source, []).reason).toContain('multi-line');
        expect(checkMarkupEditable({ ...block, startLine: 2, endLine: 2 }, source, []).ok).toBe(false);
    });

    it('declines a markdown block holding raw HTML it cannot spell', () => {
        const block: MarkupBlock = { mode: 'markdown', startLine: 1, endLine: 1 };
        const rows = [null, '<div class="x" id="line-2" data-source-line="2" class="line">y</div>'];
        const check = checkMarkupEditable(block, ['#markdown', 'x', '#end markdown'], rows);
        expect(check.ok).toBe(false);
        expect(check.reason).toContain('no Markdown spelling');
    });

    it('opens a markdown block from the elements the engine rendered', () => {
        const block: MarkupBlock = { mode: 'markdown', startLine: 1, endLine: 2 };
        const rows = [
            null,
            '<h2 id="line-2" data-source-line="2" class="line">Head</h2>',
            '<p id="line-3" data-source-line="3" class="line">Body</p>',
        ];
        const check = checkMarkupEditable(block, ['#markdown', '## Head', 'Body', '#end markdown'], rows);
        expect(check.ok).toBe(true);
        expect(check.html).toBe('<h2>Head</h2>\n<p>Body</p>');
    });

    it('accepts the classes the engine itself writes', () => {
        // Markdig tags a task list and a code fence's language; refusing every
        // `class` would decline output the engine produces.
        const block: MarkupBlock = { mode: 'markdown', startLine: 1, endLine: 1 };
        const rows = [null, '<ul class="contains-task-list" id="line-2" data-source-line="2" class="line">'
            + '<li class="task-list-item"><input type="checkbox" checked disabled>done</li></ul>'];
        expect(checkMarkupEditable(block, ['#markdown', '- [x] done', '#end markdown'], rows).ok).toBe(true);

        const code = [null, '<pre id="line-2" data-source-line="2" class="line">'
            + '<code class="language-js">let x = 1;</code></pre>'];
        expect(checkMarkupEditable(block, ['#markdown', '```js', '```', '#end markdown'], code).ok).toBe(true);
    });

    it('still refuses a class the engine would not write', () => {
        const block: MarkupBlock = { mode: 'markdown', startLine: 1, endLine: 1 };
        const rows = [null, '<p class="mine" id="line-2" data-source-line="2" class="line">x</p>'];
        expect(checkMarkupEditable(block, ['#markdown', 'x', '#end markdown'], rows).ok).toBe(false);
    });
});

describe('commitMarkupBlock', () => {
    it('writes an html line back as markup', () => {
        const block: MarkupBlock = { mode: 'html', startLine: 1, endLine: 1 };
        expect(commitMarkupBlock(block, '<div>edited</div>'))
            .toEqual({ ok: true, lines: ['<div>edited</div>'] });
    });

    it('lets an html edit grow to several lines', () => {
        const block: MarkupBlock = { mode: 'html', startLine: 1, endLine: 1 };
        expect(commitMarkupBlock(block, '<div>\n  edited\n</div>'))
            .toEqual({ ok: true, lines: ['<div>', '  edited', '</div>'] });
    });

    it('refuses to blank an html line', () => {
        const block: MarkupBlock = { mode: 'html', startLine: 1, endLine: 1 };
        expect(commitMarkupBlock(block, '   ').ok).toBe(false);
    });

    it('writes a markdown block back as Markdown', () => {
        const block: MarkupBlock = { mode: 'markdown', startLine: 1, endLine: 1 };
        const result = commitMarkupBlock(block, '<h2>Head</h2><p>Body</p>');
        expect(result).toEqual({ ok: true, lines: ['## Head', '', 'Body'] });
    });

    it('refuses markdown it cannot spell', () => {
        const block: MarkupBlock = { mode: 'markdown', startLine: 1, endLine: 1 };
        const result = commitMarkupBlock(block, '<p>a <span>b</span></p>');
        expect(result.ok).toBe(false);
    });
});

describe('round trip through the converter', () => {
    // What the editor holds must convert back to the Markdown it came from, or a
    // commit would silently rewrite the author's block.
    it.each([
        ['## Head\n', '<h2>Head</h2>'],
        ['Body text\n', '<p>Body text</p>'],
        ['**bold** and *em*\n', '<p><strong>bold</strong> and <em>em</em></p>'],
        ['- one\n- two\n', '<ul><li>one</li><li>two</li></ul>'],
        ['1. one\n2. two\n', '<ol><li>one</li><li>two</li></ol>'],
        ['> quoted\n', '<blockquote><p>quoted</p></blockquote>'],
        ['| A | B |\n| --- | --- |\n| 1 | 2 |\n', '<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>'],
        ['[text](/a)\n', '<p><a href="/a">text</a></p>'],
    ])('converts %s back to itself', (markdown, html) => {
        expect(htmlToMarkdown(html)).toBe(markdown);
    });
});
