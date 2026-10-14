/**
 * Assembles the live document from source text and rendered HTML.
 */

import type { LiveDocument, LiveLine } from './types';
import type { RenderedLine } from './types';
import { splitSourceLines, isLiveEditableLine } from './source';
import { extractRenderedLines } from './render';

/**
 * Assembles the live document from the source and, when there is one, the HTML of a
 * render that kept its line anchors.
 */
export function buildLiveDocument(content: string, html: string | null): LiveDocument {
    const texts = splitSourceLines(content);
    const rendered = html ? extractRenderedLines(html) : null;
    const last = texts.length;
    const lines: LiveLine[] = texts.map((text, index) => {
        const number = index + 1;
        const entry = rendered?.get(number);
        return {
            number,
            text,
            rendered: entry?.html,
            error: entry?.error,
            editable: isLiveEditableLine(text, number === last),
        };
    });
    return {
        lines,
        totalLines: lines.length,
        editableCount: lines.filter(line => line.editable).length,
        endsWithNewline: content.length > 0 && content.endsWith('\n'),
    };
}
