// The document model — a worksheet as an ordered list of regions.
//
// The `.cpd` text stays the single source of truth: this module only *classifies* lines and
// memoises the parse so the renderer never re-parses a line it has already seen. Consecutive
// non-editable lines collapse into one source block, so a run of comments reads as the
// paragraph the author wrote rather than as N separate rows.

import { MathNode } from './model';
import { classifyEdit } from './gate';

export type LineKind = 'blank' | 'comment' | 'directive' | 'solver' | 'markup' | 'equation' | 'source';

export interface ClassifiedLine {
    readonly index: number;
    readonly text: string;
    readonly kind: LineKind;
    /** Parsed AST for equation lines; `null` otherwise. */
    readonly node: MathNode | null;
}

export interface LineRegion {
    readonly kind: 'equation' | 'block';
    readonly startLine: number;
    readonly endLine: number;
    /** For an equation region, the AST; for a block, `null`. */
    readonly node: MathNode | null;
    /** Raw text, newline-joined for a block. */
    readonly text: string;
}

export function classifyLine(text: string, index = 0): ClassifiedLine {
    const trimmed = text.trim();
    if (trimmed === '') return { index, text, kind: 'blank', node: null };
    if (trimmed.startsWith('#')) return { index, text, kind: 'directive', node: null };
    if (trimmed.startsWith('"') || trimmed.startsWith("'")) return { index, text, kind: 'comment', node: null };
    if (trimmed.startsWith('$')) return { index, text, kind: 'solver', node: null };
    if (trimmed.startsWith('<')) return { index, text, kind: 'markup', node: null };

    const verdict = classifyEdit(text);
    if (verdict.kind === 'editable' && verdict.node) {
        return { index, text, kind: 'equation', node: verdict.node };
    }
    return { index, text, kind: 'source', node: null };
}

export function isEquationLine(text: string): boolean {
    return classifyLine(text).kind === 'equation';
}

export function splitWorksheet(text: string): ClassifiedLine[] {
    return text.split(/\r\n|\r|\n/).map((line, index) => classifyLine(line, index));
}

/**
 * Group lines into regions. Equation lines become their own region; everything else is merged
 * into a block so the source reads continuously.
 *
 * `classify` is injectable so a `LineModel` can supply its memoised version — classifying a line
 * costs a parse, a print and a re-parse, and the panel re-renders the whole document on every
 * commit.
 */
export function lineRegions(
    text: string,
    classify: (line: string, index: number) => ClassifiedLine = classifyLine,
): LineRegion[] {
    const lines = text.split(/\r\n|\r|\n/).map((line, index) => classify(line, index));
    const regions: LineRegion[] = [];
    let blockStart = -1;

    const flushBlock = (endLine: number): void => {
        if (blockStart < 0) return;
        regions.push({
            kind: 'block',
            startLine: blockStart,
            endLine,
            node: null,
            text: lines.slice(blockStart, endLine + 1).map((l) => l.text).join('\n'),
        });
        blockStart = -1;
    };

    for (const line of lines) {
        if (line.kind === 'equation') {
            flushBlock(line.index - 1);
            regions.push({ kind: 'equation', startLine: line.index, endLine: line.index, node: line.node, text: line.text });
        } else if (blockStart < 0) {
            blockStart = line.index;
        }
    }
    flushBlock(lines.length - 1);
    return regions;
}

interface CachedClassification {
    readonly kind: LineKind;
    readonly node: MathNode | null;
}

/**
 * A parse cache keyed by line text. Equations are short and a document has hundreds of lines, so
 * memoising here turns every re-render into a map lookup instead of a re-parse.
 *
 * Only the *classification* is cached, never the line index: two identical lines share one entry,
 * and returning the cached index would report the first occurrence's position for both.
 */
export class LineModel {
    private readonly cache = new Map<string, CachedClassification>();

    classify(text: string, index = 0): ClassifiedLine {
        let hit = this.cache.get(text);
        if (!hit) {
            const classified = classifyLine(text, index);
            hit = { kind: classified.kind, node: classified.node };
            if (this.cache.size > 4000) this.cache.clear();
            this.cache.set(text, hit);
        }
        return { index, text, kind: hit.kind, node: hit.node };
    }

    regions(text: string): LineRegion[] {
        return lineRegions(text, (line, index) => this.classify(line, index));
    }

    clear(): void {
        this.cache.clear();
    }
}
