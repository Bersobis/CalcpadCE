/**
 * Recovering author markup from what the engine rendered.
 *
 * With `includeLineAnchors` on — which is what the live display always asks for —
 * the engine injects `id="line-N" data-source-line="N" class="line"` into the
 * **first tag of each rendered chunk**, so click-to-source can jump to the right
 * line. That is exactly the tag the rich-text editor needs to hand back to the
 * author, so the attributes have to come off first: they are not the author's
 * markup, and `class` is not in the modelled attribute set, so leaving them in
 * would make every block fail its own check.
 *
 * For `#html` a chunk is one source line. For `#markdown` a chunk is one Markdig
 * block, attributed to the block's *first* source line — so a `#markdown` region
 * is reassembled by concatenating the chunks its lines produced.
 */

import type { MarkupBlock } from './parse-modes';

// The attribute triple the engine injects. The duplicate `class` it produces
// (`class="note" class="line"`) is the engine's own output, not the author's.
const INJECTED_ATTRIBUTES = /\s+(?:id="line-\d+"|data-source-line="\d+"|class="line")/g;

/** Remove the line anchors the engine injected, leaving the author's markup. */
export function stripLineAnchors(html: string): string {
    return html.replace(INJECTED_ATTRIBUTES, '').trim();
}

/**
 * The rendered HTML for a whole markup block, anchors removed.
 *
 * Lines the block did not render into are skipped rather than treated as empty,
 * so a `#markdown` region made of several Markdig blocks comes back as one
 * fragment in document order.
 */
export function markupBlockHtml(block: MarkupBlock, rowHtml: readonly (string | null)[]): string {
    const parts: string[] = [];
    for (let line = block.startLine; line <= block.endLine; line++) {
        const html = rowHtml[line];
        if (!html) continue;
        const stripped = stripLineAnchors(html);
        if (stripped !== '') parts.push(stripped);
    }
    return parts.join('\n');
}
