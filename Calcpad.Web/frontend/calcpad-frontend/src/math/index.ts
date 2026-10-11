// Calcpad math — a from-scratch, dependency-free rendering and editing engine built on MathML.
//
//   Calcpad text  ⇄  MathML AST  ⇄  native MathML (render)  /  OMML (Word interop)
//
// No LaTeX, no MathLive: the AST is the only model, the browser typesets it, and every layer
// is a pure function so the whole engine runs headless in Node for tests and corpus measurement.

export * from './model';
export * from './grammar';

export type { Token, TokenType, TokenizeResult } from './tokenizer';
export { parseCalcpad } from './parser';
export type { ParseResult, ParseError } from './parser';
export { printCalcpad } from './printer';
export {
    toMathMlString, toMathMlDocument, toMathMlElement, renderMathMl, moDisplay,
    MATHML_NS, PATH_ATTR,
} from './serialize';
export { fromOmml, toOmml } from './omml';
export { parseXml, serializeXml, type XmlElement } from './xml';
export {
    classifyLine, isEquationLine, splitWorksheet, lineRegions, LineModel,
    type LineRegion, type LineKind, type ClassifiedLine,
} from './line-model';
export { isFixpoint, classifyEdit, isCommittableText, sameMeaning, type Editability } from './gate';
export {
    anchorsOf, moveHorizontal, moveVertical, hasEmptySlot, emptySlotPaths,
    firstAnchor, lastAnchor, type Anchor,
} from './caret';
export {
    applyCharacter, insertStructure, deleteBackward, deleteForward, STRUCTURES, PALETTE_SYMBOLS,
    type Structure, type StructureId,
} from './insert';
export { hitTest, anchorRect, type HitTarget, type CaretRect } from './hit-test';
export { History } from './history';
export { supportsMathMlCore } from './capability';
