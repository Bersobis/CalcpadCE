// Calcpad printer — MathML AST back to Calcpad source.
//
// The inverse of `parser.ts` for every construct the parser can build. Brackets are inserted
// only where precedence requires them, and a node that already carries its own brackets is
// never wrapped twice — the bug that made brackets accumulate one per round-trip.

import { MathElement, MathNode, isElement, isText, leafText } from './model';
import { LEVEL, opSpec } from './grammar';

// Lower binds tighter, so an atomic operand is *tighter than everything* and therefore never
// needs brackets. Using `Infinity` here was the bug that bracketed every literal.
const ATOMIC = Number.NEGATIVE_INFINITY;

interface BracketContext {
    readonly level: number;
    readonly side: 'left' | 'right';
    readonly assoc: 'left' | 'right';
}

type RowKind = 'abs' | 'delimited' | 'unary' | 'binary' | 'product';

const OPENERS = new Set(['(', '[']);
const CLOSERS = new Set([')', ']']);

export function printCalcpad(node: MathNode): string {
    return print(node);
}

function print(node: MathNode): string {
    if (isText(node)) return node.text;

    switch (node.name) {
        case 'math':
            return printAll(node);
        case 'mn':
        case 'mi':
            return leafText(node) ?? '';
        case 'mo':
            return (leafText(node) ?? '').trim() === ';' ? '; ' : leafText(node) ?? '';
        case 'mtext':
            return leafText(node) ?? '';
        case 'mfrac':
            return printOperand(node.children[0], { level: LEVEL.MULT, side: 'left', assoc: 'left' })
                + '/' +
                printOperand(node.children[1], { level: LEVEL.MULT, side: 'right', assoc: 'left' });
        case 'msup':
            // The exponent is parsed by `parseUnary`, so a prefix minus needs no brackets:
            // `10^-4` re-parses to the same tree, while `10^(-4)` would come back as a group.
            return printOperand(node.children[0], { level: LEVEL.POWER, side: 'left', assoc: 'right' })
                + '^' +
                printOperand(node.children[1], { level: LEVEL.NEG, side: 'right', assoc: 'right' });
        case 'msqrt':
            return `sqrt(${print(node.children[0])})`;
        case 'mroot': {
            const cp = node.attrs['data-cp'];
            const base = print(node.children[0]);
            if (cp === 'cbrt') return `cbrt(${base})`;
            return `root(${base}; ${print(node.children[1])})`;
        }
        case 'msub':
            return print(node.children[0]) + '_' + print(node.children[1]);
        case 'mtable':
            return printTable(node);
        case 'mrow':
            return printRow(node);
        default:
            return printAll(node);
    }
}

function printAll(node: MathElement): string {
    return node.children.map((child) => (isText(child) ? child.text : printChild(child))).join('');
}

/** Print one child of a delimited run: operators keep their spacing, operands are bare. */
function printChild(child: MathNode): string {
    if (isText(child)) return child.text;
    if (child.name === 'mo') return moText(child);
    return print(child);
}

function moText(node: MathElement): string {
    const text = leafText(node) ?? '';
    if (text === ';') return '; ';
    const spec = opSpec(text);
    if (!spec) return text;
    return spec.spaced ? ` ${text} ` : text;
}

function printRow(node: MathElement): string {
    const kind = classifyRow(node);
    switch (kind) {
        case 'abs':
            return `abs(${print(node.children[1])})`;
        case 'delimited':
            return printAll(node);
        case 'unary':
            return '-' + printOperand(node.children[1], { level: LEVEL.NEG, side: 'right', assoc: 'left' });
        case 'binary': {
            const opIndex = findTopOperator(node);
            const spec = opSpec(leafText(node.children[opIndex]) ?? '');
            // Only a clean `[operand, operator, operand]` row is printed as one operation.
            // Anything else falls back to concatenating every child: dropping the extras would
            // be silent data loss, which is the one thing this printer must never do.
            if (!spec || opIndex !== 1 || node.children.length !== 3) return printAll(node);
            const left = printOperand(node.children[0], { level: spec.level, side: 'left', assoc: spec.assoc });
            const right = printOperand(node.children[2], { level: spec.level, side: 'right', assoc: spec.assoc });
            const middle = spec.spaced ? ` ${spec.glyph} ` : spec.glyph;
            return left + middle + right;
        }
        case 'product':
            return node.children
                .map((child) => printOperand(child, { level: LEVEL.IMPLICIT, side: 'right', assoc: 'left' }))
                .join('');
    }
}

function printTable(node: MathElement): string {
    const rows = node.children.map((row) =>
        isElement(row) && row.name === 'mtr'
            ? row.children.map((cell) => (isElement(cell) ? print(cell.children[0] ?? cell) : print(cell))).join('; ')
            : print(row)
    );
    return rows.join(' | ');
}

function printOperand(node: MathNode | undefined, ctx: BracketContext): string {
    if (node === undefined) return '';
    if (isEmptyRow(node)) return '';
    if (isElement(node) && classifyRow(node) === 'delimited') return print(node);
    const p = precedence(node);
    const needs = ctx.side === 'left'
        ? (ctx.assoc === 'left' ? p > ctx.level : p >= ctx.level)
        : (ctx.assoc === 'left' ? p >= ctx.level : p > ctx.level);
    const text = print(node);
    return needs ? `(${text})` : text;
}

/** An unfilled slot has no Calcpad spelling, so it prints as nothing and is held open. */
function isEmptyRow(node: MathNode): boolean {
    return isElement(node) && node.name === 'mrow' && node.children.length === 0;
}

function precedence(node: MathNode): number {
    if (isText(node)) return ATOMIC;
    switch (node.name) {
        case 'mfrac': return LEVEL.MULT;
        case 'msup': return LEVEL.POWER;
        case 'mrow': {
            if (node.children.length === 0) return ATOMIC;
            switch (classifyRow(node)) {
                case 'abs': return ATOMIC;
                case 'delimited': return ATOMIC;
                case 'unary': return LEVEL.NEG;
                case 'binary': {
                    const op = leafText(node.children[findTopOperator(node)]) ?? '';
                    return opSpec(op)?.level ?? ATOMIC;
                }
                case 'product': return LEVEL.IMPLICIT;
            }
            return ATOMIC;
        }
        default: return ATOMIC;
    }
}

function classifyRow(node: MathElement): RowKind {
    if (node.attrs['data-cp'] === 'abs') return 'abs';
    if (node.children.length === 0) return 'product';
    const first = node.children[0];
    if (isElement(first) && first.name === 'mo') {
        const text = leafText(first) ?? '';
        if (OPENERS.has(text)) {
            const last = node.children[node.children.length - 1];
            if (isElement(last) && last.name === 'mo' && CLOSERS.has(leafText(last) ?? '')) return 'delimited';
        }
        if (text === '-') return 'unary';
    }
    // A function call: a name — with or without a subscript, `sin(x)` or `τ_xy(x; y)` —
    // immediately followed by `(`.
    const second = node.children[1];
    const isNameLike = isElement(first) && (first.name === 'mi' || first.name === 'msub');
    if (isNameLike && isElement(second) && second.name === 'mo' && (leafText(second) ?? '') === '(') {
        return 'delimited';
    }
    return findTopOperator(node) >= 0 ? 'binary' : 'product';
}

/**
 * Index of the top-level operator `<mo>` in a binary row, or -1 for a product.
 *
 * The search starts at 1: a leading operator is a *prefix*, and treating it as binary made the
 * printer emit it twice (`mrow[mo(+), mi(ab)]` printed as `+ + ab`).
 */
function findTopOperator(node: MathElement): number {
    for (let i = 1; i < node.children.length; i++) {
        const child = node.children[i];
        if (isElement(child) && child.name === 'mo') {
            const text = leafText(child) ?? '';
            if (opSpec(text)) return i;
        }
    }
    return -1;
}
