/**
 * Core types for the live editor's view of a document.
 *
 * These types are pure data — no DOM, no framework — so both the browser-side
 * message bridge and the VS Code extension host can use them without pulling in
 * Vue or browser APIs.
 */

/** One source line, with what the renderer produced for it when it produced anything. */
export interface LiveLine {
    /** 1-based source line number, matching the editor's gutter. */
    number: number;
    /** Raw source text of the line, without the line break. */
    text: string;
    /** Rendered HTML for the line, when the render tagged one for it. */
    rendered?: string;
    /**
     * The renderer failed on this line, so `rendered` is a message about the source
     * rather than the source set as maths. Nothing in it stands for a piece of the
     * source, so it is shown but never edited through.
     */
    error?: boolean;
    /** Whether the line takes part in live editing. */
    editable: boolean;
}

/** The complete live view of a document. */
export interface LiveDocument {
    lines: LiveLine[];
    /** Lines in the source, blank ones included. */
    totalLines: number;
    /** How many of those lines are editable. */
    editableCount: number;
    /** Whether the source ends with a line break — an editor shows no line after it. */
    endsWithNewline: boolean;
}

/** What the renderer made of one source line. */
export interface RenderedLine {
    html: string;
    /** The renderer failed on the line, so this is a message rather than the maths. */
    error: boolean;
}
