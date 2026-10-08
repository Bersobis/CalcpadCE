/**
 * Which lines of a worksheet are HTML or Markdown rather than Calcpad.
 *
 * Calcpad switches parsing with `#html`, `#markdown` and `#cpd`, and each has an
 * `#end` form that pops back to the mode it replaced. This mirrors
 * `Calcpad.Highlighter/Tokenizer/ParseModeTracker` — the same tracker the
 * highlighter and linter use — so the editor classifies a line exactly as the
 * engine will. Getting this wrong would mean offering a rich-text surface over a
 * line the engine parses as arithmetic.
 *
 * Everything here is pure: a list of lines in, a mode per line out. That is what
 * lets the live display decide what to render without touching the DOM.
 */

/** The three parsing modes a line can be in. */
export type ParseMode = 'cpd' | 'html' | 'markdown';

/** A line's classification. */
export interface LineMode {
    /** The mode in effect *before* the line's own content. */
    mode: ParseMode;
    /** True when the line is a mode directive rather than content. */
    directive: boolean;
}

/** A run of consecutive content lines in one non-Calcpad mode. */
export interface MarkupBlock {
    mode: 'html' | 'markdown';
    /** 0-based index of the first content line. */
    startLine: number;
    /** 0-based index of the last content line, inclusive. */
    endLine: number;
}

const OPENERS: ReadonlyArray<readonly [string, ParseMode]> = [
    ['#html', 'html'],
    ['#cpd', 'cpd'],
    ['#markdown', 'markdown'],
];

/**
 * A directive word match: the prefix, case-insensitively, followed by whitespace
 * or the end of the line. `#htmlnotes` is a variable, `#html x > 3` is a directive
 * with a condition.
 */
function startsWithWord(line: string, word: string): boolean {
    if (line.length < word.length) return false;
    if (line.slice(0, word.length).toLowerCase() !== word) return false;
    return line.length === word.length || /\s/.test(line[word.length]);
}

/** The mode an opener line switches to, or `null` when the line is not an opener. */
export function openerMode(trimmedLine: string): ParseMode | null {
    for (const [word, mode] of OPENERS) {
        if (startsWithWord(trimmedLine, word)) return mode;
    }
    return null;
}

/**
 * Whether the line closes the mode in effect.
 *
 * Only the `#end` matching the current mode closes a block, so `#end markdown`
 * inside `#html` is content. In Calcpad mode every `#end` form is a directive,
 * which is how an unterminated block is closed from the outside.
 */
export function isEndDirective(trimmedLine: string, mode: ParseMode): boolean {
    if (mode === 'html') return startsWithWord(trimmedLine, '#end html');
    if (mode === 'markdown') return startsWithWord(trimmedLine, '#end markdown');
    return startsWithWord(trimmedLine, '#end html')
        || startsWithWord(trimmedLine, '#end cpd')
        || startsWithWord(trimmedLine, '#end markdown');
}

/** Classify every line of a worksheet. */
export function parseModeMap(lines: readonly string[]): LineMode[] {
    const out: LineMode[] = [];
    const stack: ParseMode[] = [];
    let mode: ParseMode = 'cpd';

    for (const line of lines) {
        const trimmed = line.trim();
        const ended = isEndDirective(trimmed, mode);
        const opened = ended ? null : openerMode(trimmed);
        const directive = ended || opened !== null;

        // The mode of a directive line is the one it acts on, not the one it
        // selects — a `#html` line is not itself HTML content.
        out.push({ mode, directive });

        if (ended) mode = stack.length > 0 ? stack.pop()! : 'cpd';
        else if (opened) {
            stack.push(mode);
            mode = opened;
        }
    }
    return out;
}

/**
 * The units the graphical editor works on.
 *
 * The two modes are grouped differently on purpose. A `#markdown` region is
 * rendered a block at a time — Markdig reads consecutive lines together — so its
 * lines have to be edited as one unit; a table or a list spans several. A
 * `#html` line is written to the output verbatim and stands alone, so each is
 * its own unit.
 */
export function markupBlocks(lines: readonly string[]): MarkupBlock[] {
    const map = parseModeMap(lines);
    const blocks: MarkupBlock[] = [];
    let markdownStart = -1;

    const closeMarkdown = (endLine: number): void => {
        if (markdownStart === -1) return;
        blocks.push({ mode: 'markdown', startLine: markdownStart, endLine });
        markdownStart = -1;
    };

    // The sentinel pass closes a region that runs to the end of the file.
    for (let i = 0; i <= map.length; i++) {
        const mode: ParseMode = i < map.length && !map[i].directive ? map[i].mode : 'cpd';
        if (mode !== 'markdown') closeMarkdown(i - 1);
        if (mode === 'html') blocks.push({ mode: 'html', startLine: i, endLine: i });
        else if (mode === 'markdown' && markdownStart === -1) markdownStart = i;
    }
    return blocks;
}

/** The markup block containing `line`, or `null` when the line is Calcpad or a directive. */
export function markupBlockAt(blocks: readonly MarkupBlock[], line: number): MarkupBlock | null {
    for (const block of blocks) {
        if (line >= block.startLine && line <= block.endLine) return block;
    }
    return null;
}
