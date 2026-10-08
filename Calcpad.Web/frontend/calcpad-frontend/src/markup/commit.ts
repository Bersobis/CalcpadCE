/**
 * Deciding whether a markup block can be edited graphically, and writing it back.
 *
 * The same shape as the math editor's gate: a block is offered for graphical
 * editing only when it is certain to survive the round trip, and everything else
 * falls back to the source editor with a reason. Writing back is the other half
 * — a `#html` line is replaced by its edited markup, a `#markdown` region by the
 * Markdown the edited markup converts to.
 *
 * Pure apart from the DOM work the converter and the checker already do.
 */

import type { MarkupBlock } from './parse-modes';
import { checkMarkupHtml } from './check';
import { htmlToMarkdown } from './html-to-markdown';
import { markupBlockHtml } from './rendered';

export interface MarkupEditability {
    ok: boolean;
    /** Set when `ok` is false: what stopped it, for the user-facing note. */
    reason?: string;
    /** Set when `ok` is true: the author markup to open in the editing surface. */
    html?: string;
}

export type MarkupCommitResult =
    | { ok: true; lines: string[] }
    | { ok: false; reason: string };

/** Elements that never need a closing tag, so they do not affect balance. */
const VOID_TAGS = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img',
    'input', 'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

/**
 * Whether a fragment opens and closes its own tags.
 *
 * A line inside a multi-line construct — the CSS between `<style>` and
 * `</style>`, say — is not a fragment, and editing it on its own would detach it
 * from the element it belongs to. Balanced tags is the cheap, reliable test for
 * "this line stands alone".
 */
export function hasBalancedTags(html: string): boolean {
    const stack: string[] = [];
    for (const raw of html.match(/<\/?[a-zA-Z][\w-]*(?:\s[^<>]*)?\/?>/g) ?? []) {
        const name = /^<\/?([a-zA-Z][\w-]*)/.exec(raw)![1].toLowerCase();
        if (VOID_TAGS.has(name) || raw.endsWith('/>')) continue;
        if (raw.startsWith('</')) {
            if (stack.pop() !== name) return false;
        } else {
            stack.push(name);
        }
    }
    return stack.length === 0;
}

/**
 * Whether a markup block may be opened graphically, and the markup to open.
 *
 * The two modes get their markup from different places, because they are
 * different things. An `#html` line is written to the output verbatim, so the
 * author's own source line *is* the markup — no rendering involved, and nothing
 * to reconstruct. A `#markdown` block is prose that only the engine can render,
 * so its markup comes from `rowHtml`, the anchored elements the render produced.
 */
export function checkMarkupEditable(
    block: MarkupBlock,
    sourceLines: readonly string[],
    rowHtml: readonly (string | null)[],
): MarkupEditability {
    if (block.mode === 'html') {
        const html = sourceLines.slice(block.startLine, block.endLine + 1).join('\n').trim();
        if (html === '') return { ok: false, reason: 'nothing on this line' };
        // A line with no tag of its own is a continuation of a multi-line
        // construct such as `<style>`; only a self-contained line stands alone.
        if (!/<[a-zA-Z]/.test(html)) return { ok: false, reason: 'this line is part of a multi-line element' };
        if (!hasBalancedTags(html)) return { ok: false, reason: 'this line is part of a multi-line element' };
        return { ok: true, html };
    }

    const html = markupBlockHtml(block, rowHtml);
    if (html === '') return { ok: false, reason: 'nothing rendered for this block' };

    const safe = checkMarkupHtml(html);
    if (!safe.ok) return { ok: false, reason: `${safe.reason} has no Markdown spelling` };

    if (htmlToMarkdown(html) === null) {
        return { ok: false, reason: 'a construct with no Markdown spelling' };
    }
    return { ok: true, html };
}

/**
 * The source lines that replace a markup block's content.
 *
 * `editedHtml` is what the editing surface holds. A `#html` line is written back
 * as the author's markup, and may become several lines if the user pressed
 * Enter; a `#markdown` region is written back as Markdown.
 */
export function commitMarkupBlock(block: MarkupBlock, editedHtml: string): MarkupCommitResult {
    if (block.mode === 'html') {
        const lines = editedHtml.replace(/\s+$/, '').split('\n');
        if (lines.length === 0 || lines.every(line => line.trim() === '')) {
            return { ok: false, reason: 'the line is empty' };
        }
        return { ok: true, lines };
    }

    const safe = checkMarkupHtml(editedHtml);
    if (!safe.ok) return { ok: false, reason: `${safe.reason} has no Markdown spelling` };

    const markdown = htmlToMarkdown(editedHtml);
    if (markdown === null) return { ok: false, reason: 'a construct with no Markdown spelling' };

    return { ok: true, lines: markdown.replace(/\n+$/, '').split('\n') };
}
