/**
 * Graphical editing of the HTML and Markdown parts of a worksheet.
 *
 * Calcpad switches a region into `#html` or `#markdown` with a directive, and
 * those lines are content rather than arithmetic. This module decides which
 * lines are content, whether a block is safe to open in a rich-text surface, and
 * how to write an edit back as HTML or Markdown.
 *
 * Everything is pure apart from `DOMParser`, so the whole pipeline is testable
 * without a browser — the same shape as the math editor's `mathml/` core.
 */

export type { ParseMode, LineMode, MarkupBlock } from './parse-modes';
export { openerMode, isEndDirective, parseModeMap, markupBlocks, markupBlockAt } from './parse-modes';

export {
    MARKDOWN_BLOCK_TAGS,
    MARKDOWN_INLINE_TAGS,
    ALLOWED_ATTRIBUTES,
    isModelledTag,
    htmlToMarkdown,
} from './html-to-markdown';

export type { MarkupCheck } from './check';
export { checkMarkupHtml } from './check';

export { stripLineAnchors, markupBlockHtml } from './rendered';

export type { MarkupEditability, MarkupCommitResult } from './commit';
export { hasBalancedTags, checkMarkupEditable, commitMarkupBlock } from './commit';
