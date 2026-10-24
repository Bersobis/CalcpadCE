// The editability gate.
//
// A line opens as a math field only when it is a *fixed point* of `parse → print → parse`:
// the two trees must be identical. Anything else — a directive, a solver call, an exotic
// construct the bridge models imperfectly — is shown as source and never rewritten. Declining
// is the safety property that makes a client-side second implementation of the grammar
// acceptable: a construct the bridge cannot carry is refused, not silently corrupted.

import { MathNode, sameTree, isElement, leafText } from './model';
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
 * Calcpad reuse/loop directives don't have their own AST shape — the parser reads them as
 * ordinary expressions with the `to` keyword in them (`i = 1 to 10`). A field should not try to
 * be a directive, so a line carrying the `to` token stops at the gate. A stray `:` header never
 * reaches here: the tokenizer refuses `:` in equation context outright.
 */
function isPureForLike(node: MathNode): boolean {
    if (!isElement(node)) return false;
    const text = leafText(node);
    if (node.name === 'mi' && text !== null && text.toLowerCase() === 'to') return true;
    return node.children.some(isPureForLike);
}

/**
 * A bare bracket row with no operands between the delimiters — holder notation, not an
 * equation to render in a field. `[1; 2]` has operands and stays editable; `[]` has none.
 */
function emptyContainerLike(node: MathNode): boolean {
    if (!isElement(node) || node.name !== 'mrow' || node.children.length < 2) return false;
    const first = node.children[0];
    if (!isElement(first) || first.name !== 'mo' || leafText(first) !== '[') return false;
    const last = node.children[node.children.length - 1];
    if (!isElement(last) || last.name !== 'mo') return false;
    const closer = leafText(last);
    if (closer !== ']' && closer !== ';' && closer !== '|') return false;
    return node.children.slice(1, -1).every(child => isElement(child) && child.name === 'mo');
}

/**
 * `a,,b` / `a__b` / `aaa__bbb` / `1..2` / `1.2.3` — the tokenizer reads `,`, `_` and `.` as
 * name/number characters, so these parse as single tokens, but they do not look like intended
 * Calcpad identifiers and the editor should not present them as editable equations.
 */
function nameWithInvalidRepeatedChars(node: MathNode): boolean {
    const text = leafText(node);
    const named = isElement(node) && (node.name === 'mi' || node.name === 'mn');
    if (text !== null && named) {
        if (text.includes(',,')) return true;
        if (text.includes('__') || text.startsWith('_')) return true;
        if (text.split('.').length > 2) return true;
    }
    return isElement(node) ? node.children.some(nameWithInvalidRepeatedChars) : false;
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
