/**
 * Extracts per-line rendered HTML from a debug render produced by Calcpad.Core.
 *
 * Calcpad.Core tags the outermost element of every rendered line with
 * `data-source-line="N"` (`ExpressionParser.LineAttributes`), so the rendered form of
 * line N is that element's content. This module parses the HTML string directly so it
 * works in both browser and extension-host contexts where there is no DOM.
 */

import type { RenderedLine } from './types';

/** HTML elements with no content, so a source line tagged on one renders nothing. */
const VOID_ELEMENTS = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

/** The renderer's error box, which marks a line it could not evaluate. */
const ERROR_CLASS = /\bclass\s*=\s*"[^"]*\berr\b[^"]*"/;

/**
 * Reads the per-line HTML out of a debug render.
 *
 * Nested tags carrying the attribute belong to the enclosing line and are left inside
 * it, and a repeated source line — a loop body rendered once per iteration — keeps the
 * first occurrence, which is the iteration whose source the user is looking at.
 *
 * A line the renderer could not evaluate comes back as an error box instead, which is
 * flagged so the caller can tell the two apart: a message is shown, but it is not a
 * rendering of the source and nothing in it can be edited as though it were.
 */
export function extractRenderedLines(html: string): Map<number, RenderedLine> {
    const rendered = new Map<number, RenderedLine>();
    // Spans of the elements already captured, so a nested tag with the same attribute
    // is recognised as belonging to its parent rather than to its own line.
    const spans: Array<{ start: number; end: number }> = [];
    let i = 0;

    while (i < html.length) {
        const lt = html.indexOf('<', i);
        if (lt < 0) break;
        const after = html[lt + 1];
        if (after === undefined || after === '/' || after === '!' || after === '?') {
            i = lt + 1;
            continue;
        }
        if (!/[a-zA-Z]/.test(after)) {
            i = lt + 1;
            continue;
        }
        // Walk to the '>' that closes the opening tag, stepping over quoted attribute
        // values so a '>' inside one does not end the tag early.
        let j = lt + 1;
        let quote = '';
        while (j < html.length) {
            const c = html[j];
            if (quote) {
                if (c === quote) quote = '';
            } else if (c === '"' || c === "'") {
                quote = c;
            } else if (c === '>') {
                break;
            }
            ++j;
        }
        if (j >= html.length) break;
        const tagEnd = j;
        const selfClosing = html[tagEnd - 1] === '/';
        const nameMatch = /^<([a-zA-Z][a-zA-Z0-9-]*)/.exec(html.slice(lt, lt + 40));
        const tagName = nameMatch ? nameMatch[1].toLowerCase() : '';
        i = tagEnd + 1;

        if (!tagName) continue;

        const openTag = html.slice(lt, tagEnd + 1);
        const attr = /\sdata-source-line\s*=\s*"(\d+)"/.exec(openTag);
        if (!attr) continue;

        const line = Number(attr[1]);
        if (!Number.isFinite(line) || line < 1) continue;
        // Retire spans this tag starts after: they can no longer contain anything.
        for (let k = spans.length - 1; k >= 0; --k) {
            if (spans[k].end < lt) spans.splice(k, 1);
        }
        if (spans.some(s => s.start < lt && lt < s.end)) continue;

        if (selfClosing || VOID_ELEMENTS.has(tagName)) {
            // Void and self-closing tags have no children; the tag itself is the render.
            if (!rendered.has(line)) {
                rendered.set(line, {
                    html: html.slice(lt, tagEnd + 1),
                    error: ERROR_CLASS.test(openTag),
                });
            }
            continue;
        }

        const closeIndex = findClosingTag(html, tagName, tagEnd + 1);
        if (closeIndex < 0) continue;
        spans.push({ start: lt, end: closeIndex });
        if (!rendered.has(line)) {
            const inner = html.slice(tagEnd + 1, closeIndex);
            // The error box is the anchored element itself on some renders and a child
            // of it on others, so both the tag and its content are checked.
            rendered.set(line, {
                html: inner,
                error: ERROR_CLASS.test(openTag) || ERROR_CLASS.test(inner),
            });
        }
    }

    return rendered;
}

/** Index of the `</tag>` that closes an element opened before `from`, or -1. */
function findClosingTag(html: string, tag: string, from: number): number {
    const openRe = new RegExp(`<${tag}(?=[\\s/>])`, 'gi');
    const closeRe = new RegExp(`</${tag}\\s*>`, 'gi');
    let depth = 1;
    let i = from;
    while (i < html.length) {
        openRe.lastIndex = i;
        closeRe.lastIndex = i;
        const nextOpen = openRe.exec(html);
        const nextClose = closeRe.exec(html);
        if (nextClose == null) return -1;
        if (nextOpen != null && nextOpen.index < nextClose.index) {
            ++depth;
            i = nextOpen.index + nextOpen[0].length;
            continue;
        }
        if (--depth === 0) return nextClose.index;
        i = nextClose.index + nextClose[0].length;
    }
    return -1;
}
