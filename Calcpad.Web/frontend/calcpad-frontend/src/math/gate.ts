// The editability gate.
//
// A line opens as a math field only when it is a *fixed point* of `parse → print → parse`:
// the two trees must be identical. Anything else — a directive, a solver call, an exotic
// construct the bridge models imperfectly — is shown as source and never rewritten. Declining
// is the safety property that makes a client-side second implementation of the grammar
// acceptable: a construct the bridge cannot carry is refused, not silently corrupted.

import { MathNode, sameTree } from './model';
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
    return { kind: 'editable', node: parsed.node };
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
