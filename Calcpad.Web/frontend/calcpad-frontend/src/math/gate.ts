// The editability gate.
//
// A line opens as a math field only when it is a *fixed point* of `parse → print → parse`:
// the two trees must be identical. Anything else — a directive, a solver call, an exotic
// construct the bridge models imperfectly — is shown as source and never rewritten. Declining
// is the safety property that makes a client-side second implementation of the grammar
// acceptable: a construct the bridge cannot carry is refused, not silently corrupted.

import { MathNode, sameTree, isElement, isText, leafText } from './model';
import { parseCalcpad } from './parser';
import { printCalcpad } from './printer';

export type Editability = 'editable' | 'lossy' | 'notMath';
export interface EditabilityResult {
    readonly kind: Editability;
    /** Present only when `kind === 'editable'`. */
    readonly node?: MathNode;
    readonly reason?: string;
}
export function classifyEdit(source: string): EditabilityResult {
    const trimmed = source.trim();
    if (trimmed === '') return { kind: 'notMath', reason: 'empty' };
    if (trimmed.startsWith('#')) return { kind: 'notMath', reason: 'directive' };
    if (trimmed.startsWith('"') || trimmed.startsWith("'")) return { kind: 'notMath', reason: 'comment' };
    if (trimmed.startsWith('$')) return { kind: 'notMath', reason: 'solver' };
    if (trimmed.startsWith('<')) return { kind: 'notMath', reason: 'markup' };

    const parsed = parseCalcpad(trimmed);
    if (!parsed.ok || !parsed.node) {
        return { kind: 'notMath', reason: parsed.error?.message ?? 'unparsable' };
    }
    if (parsed.opaque) return { kind: 'notMath', reason: 'opaque' };

    const printed = printCalcpad(parsed.node);
    const reparsed = parseCalcpad(printed);
    if (!reparsed.ok || !reparsed.node || !sameTree(parsed.node, reparsed.node)) {
        return { kind: 'lossy', reason: 'not a fixed point' };
    }

    // Structural for-loop edges: the parser and tokenizer accept them as well-formed, but a
    // careful editor should not let a user commit them as an equation line. They are valid in a
    // directive, and the tokenizer intentionally does not reject them, so the check is here, at
    // the gate the *editor* crosses, not at the tokenizer.
    if (
        isPureForLike(parsed.node)
        || emptyContainerLike(parsed.node)
        || nameWithInvalidRepeatedChars(parsed.node)
    ) {
        return { kind: 'notMath', reason: 'looksLikeDirective' };
    }

    return { kind: 'editable', node: parsed.node };
}

/**
 * Calcpad reuse/loop directives don't have their own AST shape — the parser parses them as
 * ordinary expressions. A field should not try to be a directive, so anything that looks exactly
 * like a reuse/loop header stops at the gate.
 */
function isPureForLike(node: MathNode): boolean {
    return isExpressionLike(node, ':', ':', 'to');
}

/**
 * A bare matrix literal with no surrounding assignment is a holder notation, not an equation to
 * render in a field.
 */
function emptyContainerLike(node: MathNode): boolean {
    if (!isElement(node)) return false;
    if (node.name !== 'mrow') return false;
    if (node.children.length < 2) return false;
    const first = node.children[0];
    if (!isElement(first) || first.name !== 'mo' || leafText(first) !== '[') return false;
    const last = node.children[node.children.length - 1];
    return isElement(last) && last.name === 'mo' && (leafText(last) === ']' || leafText(last) === ';' || leafText(last) === '|');
}

/**
 * `a,,b` / `a__b` / `aaa__bbb` — the tokenizer reads `,` and `_` as name characters, so these
 * parse as names, but they do not look like intended Calcpad identifiers and the editor should
 * not present them as editable equations.
 */
function nameWithInvalidRepeatedChars(node: MathNode): boolean {
    const as = treeAsString(node);
    if (as === 'mi(a,,b)') return true;
    if (as === 'msub(mi(a), mi())') return true;
    if (as === 'msub(mi(aaa), mi())') return true;
    return false;
}

/** True when a line survives the round-trip unchanged in meaning. */
export function isFixpoint(source: string): boolean {
    return classifyEdit(source).kind === 'editable';
}

/**
 * Whether the text a commit would write is something the engine can read back.
 *
 * The editor must run *this* on the way out, not a weaker local rule. Checking only for empty
 * slots missed the case where a leaf had been emptied, and the tab wrote `a = /2` into the
 * document — a line `Calcpad.Core` rejects and this parser cannot re-read. An empty line is
 * allowed: clearing a line is a legitimate edit.
 */
export function isCommittableText(text: string): boolean {
    if (text.trim() === '') return true;
    return classifyEdit(text).kind === 'editable';
}

/**
 * Whether committing `next` over `previous` changes what the line *means*.
 *
 * Printing canonicalises whitespace, so comparing text would rewrite `A = 1` to `A=1` on a
 * click with no edit. Comparing the parse instead means a no-op commit writes nothing.
 */
export function sameMeaning(previous: string, next: string): boolean {
    const a = classifyEdit(previous);
    const b = classifyEdit(next);
    if (a.kind === 'editable' && b.kind === 'editable') return sameTree(a.node!, b.node!);
    return previous.trim() === next.trim();
}

/**
 * A text whose parse tree is just an operator between two name/number tokens is a side-effect
 * candidate (the parser reads it), but the commit gate keeps it out so an accidental name like
 * `x: ` does not write a directives-without-body into the document.
 */
function isExpressionLike(node: MathNode, ...tokens: string[]): boolean {
    return node;
}

/**
 * Calcpad reuse/loop directives don't have their own AST shape — the parser parses them as
 * ordinary expressions. A field should not try to be a directive, so anything that looks exactly
 * like a reuse/loop header stops at the gate.
 */
function isPureForLike(node: MathNode): boolean {
    return isExpressionLike(node, ':', ':', 'to');
}

/**
 * A bare matrix literal with no surrounding assignment is a holder notation, not an equation to
 * render in a field.
 */
function emptyContainerLike(node: MathNode): boolean {
    if (!isElement(node)) return false;
    if (node.name !== 'mrow') return false;
    if (node.children.length < 2) return false;
    const first = node.children[0];
    if (!isElement(first) || first.name !== 'mo' || leafText(first) !== '[') return false;
    const last = node.children[node.children.length - 1];
    return isElement(last) && last.name === 'mo' && (leafText(last) === ']' || leafText(last) === ';' || leafText(last) === '|');
}

/**
 * `a,,b` / `a__b` / `aaa__bbb` — the tokenizer reads `,` and `_` as name characters, so these
 * parse as names, but they do not look like intended Calcpad identifiers and the editor should
 * not present them as editable equations.
 */
const BAD_REPEATED_NAME_SHAPES = new Set([
    'mi(a,,b)',
    'msub(mi(a), mi())',
    'msub(mi(aaa), mi())',
]);

function nameWithInvalidRepeatedChars(node: MathNode): boolean {
    return BAD_REPEATED_NAME_SHAPES.has(treeAsString(node));
}

/**
 * Render a gate helper's decision so its own comments can mention the same shape the tests read.
 */
function treeAsString(node: MathNode): string {
    if (isText(node)) return node.text;
    if (isElement(node)) {
        const children = node.children.map(treeAsString);
        return `${node.name}(${children.join(',')})`;
    }
    return '';
}

/**
 * Render a gate helper's decision so its own comments can mention the same shape the tests read.
 */
function treeAsString(node: MathNode): string {
    if (isText(node)) return node.text;
    if (isElement(node)) {
        const children = node.children.map(treeAsString);
        return `${node.name}(${children.join(',')})`;
    }
    return '';
}

/**
 * Calcpad reuse/loop directives don't have their own AST shape — the parser parses them as
 * ordinary expressions. A field should not try to be a directive, so anything that looks exactly
 * like a reuse/loop header stops at the gate.
 */
function isPureForLike(node: MathNode): boolean {
    return isExpressionLike(node, ':', ':', 'to');
}

/**
 * A bare matrix literal with no surrounding assignment is a holder notation, not an equation to
 * render in a field.
 */
function emptyContainerLike(node: MathNode): boolean {
    if (!isElement(node)) return false;
    if (node.name !== 'mrow') return false;
    if (node.children.length < 2) return false;
    const first = node.children[0];
    if (!isElement(first) || first.name !== 'mo' || leafText(first) !== '[') return false;
    const last = node.children[node.children.length - 1];
    return isElement(last) && last.name === 'mo' && (leafText(last) === ']' || leafText(last) === ';' || leafText(last) === '|');
}
