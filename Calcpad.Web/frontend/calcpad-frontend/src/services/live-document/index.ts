/**
 * The live editor's view of a document: which source lines it has, which of them can be
 * edited in place, and what the renderer made of each one.
 *
 * Everything here is pure so both hosts can use it — the browser-side message bridge of
 * the web/desktop app and the extension host behind the VS Code webview, where there is
 * no DOM to parse the render with.
 *
 * This module is organised into focused sub-modules for testability and clarity.
 * All previously-public exports are preserved for backward compatibility.
 */

// ---- Types ------------------------------------------------------------------
export type { LiveLine, LiveDocument, RenderedLine } from './types';

// ---- Source line utilities --------------------------------------------------
export { splitSourceLines, isLiveEditableLine } from './source';

// ---- Render extraction ------------------------------------------------------
export { extractRenderedLines } from './render';

// ---- Matrix literals --------------------------------------------------------
export { parseMatrixLiteral, matrixLiteralRange, buildMatrixLiteral } from './matrix';

// ---- Document assembly ------------------------------------------------------
export { buildLiveDocument } from './document';
