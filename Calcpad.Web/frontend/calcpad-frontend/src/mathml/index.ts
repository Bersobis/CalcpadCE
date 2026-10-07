/**
 * The MathML-native graphical editor core.
 *
 * A Calcpad line becomes a MathML tree (`calcpadLineToMathMl`), the tree is
 * edited through caret operations that preserve semantic structure
 * (`mrow`/`mfrac`/`msqrt`/`msup`/`msub`), and it is written back as Calcpad text
 * (`mathMlToCalcpadLine`). No LaTeX is used anywhere in the pipeline.
 */

export type { MathMlNode, MathMlElement, MathMlText, MathMlName } from './ast';
export {
    el,
    txt,
    isElement,
    isText,
    isToken,
    tokenText,
    token,
    tokenName,
    cloneNode,
    pathKey,
    parsePathKey,
    nodeAt,
    elementAt,
    parentOf,
    equalNodes,
    rootOf,
    expressionOf,
    SLOT_NAMES,
} from './ast';

export { serializeMathMl, serializeWithPaths } from './serialize';
export { parseMathMl, parseExpression, hasUnmodelledElement } from './parse';

export type { CalcpadParseResult, EditabilityCheck } from './calcpad';
export {
    calcpadLineToMathMl,
    mathMlToCalcpadLine,
    checkGraphicallyEditable,
    lineToMathMlMarkup,
    needsMultiply,
} from './calcpad';

export type { Anchor, EditorSelection, EditResult, StructureKind } from './caret';
export {
    anchorsOf,
    sameAnchor,
    canonicalize,
    anchorIndex,
    firstAnchor,
    lastAnchor,
    moveHorizontal,
    moveToStartOfLine,
    moveToEndOfLine,
    moveVertical,
    orderedSelection,
    hasSelection,
    selectionText,
    hasEmptySlot,
    tokenNameFor,
    buildStructure,
    mergeable,
    insertText,
    insertPair,
    insertCall,
    deleteBackward,
    deleteForward,
    deleteSelection,
    applyCharacter,
    applyCharacterToSelection,
    deleteBackwardInSelection,
    deleteForwardInSelection,
} from './caret';
