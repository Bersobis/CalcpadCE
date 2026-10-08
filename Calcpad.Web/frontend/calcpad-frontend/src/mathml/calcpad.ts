/**
 * The bridge between Calcpad source text and the editor's MathML model.
 *
 * Both directions live here so they can be tested against each other: the only
 * claim the editor makes about a line is that `source → MathML → source` parses
 * back to the *same tree*. `checkGraphicallyEditable` proves that before a line is
 * ever opened, so a construct this bridge does not fully understand shows its
 * source instead of being quietly rewritten. Nothing here uses LaTeX.
 *
 * The Calcpad dialect modelled is the expression subset: assignment, arithmetic,
 * comparisons, logic, function calls, `sqrt`/`root`, subscripts, powers, the unit
 * target, postfix `!`/`°`, and bracketed vector/matrix literals. Labels and
 * directives are deliberately out of scope — the live display already edits
 * those, and declining them here is safer than guessing.
 */

import type { MathMlElement, MathMlNode } from './ast';
import { el, elementAt, equalNodes, isElement, isText, rootOf, tokenText, txt } from './ast';
import { serializeMathMl } from './serialize';
import { parseMathMl } from './parse';

// ---- operator tables --------------------------------------------------------

/** Binding power, lowest first. Calcpad's own precedence, from docs/quick-reference.md. */
const PRECEDENCE: Record<string, number> = {
    '=': 1, '←': 1,
    '∠': 2,
    '∧': 2, '∨': 2, '⊕': 2,
    '<': 3, '>': 3, '≤': 3, '≥': 3, '≡': 3, '≠': 3,
    '+': 4, '-': 4,
    '*': 5, '/': 5, '\\': 5, '⦼': 5, '%': 5,
    '!': 8, '°': 8,
};

/** Operators written with a space on each side, so the output reads like Calcpad. */
const SPACED_OPERATORS = new Set(['+', '-', '=', '←', '<', '>', '≤', '≥', '≠', '≡', '∧', '∨', '⊕']);

/** Everything the tokenizer treats as an operator rather than part of a name. */
const OPERATOR_CHARS = new Set('+-*/÷\\⦼^_!=←<>≤≥≠≡∧∨⊕∠();,|°%[]'.split(''));

/** Constructs the editor declines rather than risk rewriting them. */
const UNSUPPORTED_CHARS = new Set(["'", '"', '{', '}', '#', '$']);

const PREC_ATOM = 9;
const PREC_POWER = 7;
const PREC_FRACTION = 5;
const PREC_MULTIPLICATIVE = 5;
const PREC_EXPONENT = 7;
const PREC_BASE = 8;

// ---- tokenizer --------------------------------------------------------------

interface Token {
    kind: 'number' | 'name' | 'operator' | 'end';
    text: string;
    start: number;
    end: number;
}

function isWordChar(ch: string): boolean {
    return !/\s/.test(ch) && !OPERATOR_CHARS.has(ch);
}

function tokenize(source: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;
    while (i < source.length) {
        const ch = source[i];
        if (/\s/.test(ch)) {
            i++;
            continue;
        }
        const start = i;
        if (OPERATOR_CHARS.has(ch)) {
            // `!=`, `<=`, `>=`, `==` spell the same operator as their single glyph.
            const two = source.slice(i, i + 2);
            const pair = two === '!=' ? '≠' : two === '<=' ? '≤' : two === '>=' ? '≥' : two === '==' ? '≡' : null;
            if (pair) {
                tokens.push({ kind: 'operator', text: pair, start, end: i + 2 });
                i += 2;
                continue;
            }
            tokens.push({ kind: 'operator', text: ch, start, end: i + 1 });
            i++;
            continue;
        }
        if (/[0-9]/.test(ch)) {
            while (i < source.length && /[0-9.]/.test(source[i])) i++;
            tokens.push({ kind: 'number', text: source.slice(start, i), start, end: i });
            continue;
        }
        while (i < source.length && isWordChar(source[i])) i++;
        tokens.push({ kind: 'name', text: source.slice(start, i), start, end: i });
    }
    tokens.push({ kind: 'end', text: '', start: source.length, end: source.length });
    return tokens;
}

// ---- Calcpad → MathML -------------------------------------------------------

/** A parser that fails loudly: any token it cannot place aborts the whole line. */
class ExpressionParser {
    private index = 0;

    constructor(private readonly tokens: Token[]) {}

    private peek(): Token {
        return this.tokens[this.index];
    }

    private take(): Token {
        return this.tokens[this.index++];
    }

    private atOperator(...texts: string[]): boolean {
        const token = this.peek();
        return token.kind === 'operator' && texts.includes(token.text);
    }

    private expectOperator(text: string): void {
        if (!this.atOperator(text)) throw new Error(`Expected "${text}"`);
        this.index++;
    }

    /** Assignment is right-associative and the loosest binding. */
    parseAssignment(): MathMlNode[] {
        const left = this.parseLogical();
        if (this.atOperator('=', '←')) {
            const operator = this.take().text;
            const right = this.parseAssignment();
            return [...left, token(operator), ...right];
        }
        return left;
    }

    private parseLogical(): MathMlNode[] {
        let nodes = this.parseComparison();
        while (this.atOperator('∧', '∨', '⊕', '∠')) {
            const operator = this.take().text;
            nodes = [...nodes, token(operator), ...this.parseComparison()];
        }
        return nodes;
    }

    private parseComparison(): MathMlNode[] {
        let nodes = this.parseAdditive();
        while (this.atOperator('<', '>', '≤', '≥', '≡', '≠')) {
            const operator = this.take().text;
            nodes = [...nodes, token(operator), ...this.parseAdditive()];
        }
        return nodes;
    }

    private parseAdditive(): MathMlNode[] {
        let nodes = this.parseMultiplicative();
        while (this.atOperator('+', '-')) {
            const operator = this.take().text;
            nodes = [...nodes, token(operator), ...this.parseMultiplicative()];
        }
        return nodes;
    }

    private parseMultiplicative(): MathMlNode[] {
        let nodes = this.parseUnary();
        for (;;) {
            if (this.atOperator('*', '\\', '⦼', '%')) {
                const operator = this.take().text;
                nodes = [...nodes, token(operator), ...this.parseUnary()];
                continue;
            }
            // `/` and `÷` become a fraction, which is how MathML spells division.
            // The whole left operand so far is the numerator — `*` and `/` bind
            // equally and associate left, so `a*b/c` is `(a*b)/c`.
            if (this.atOperator('/', '÷')) {
                this.index++;
                const denominator = this.parseUnary();
                nodes = [el('mfrac', [slot(nodes), slot(denominator)])];
                continue;
            }
            // Implicit multiplication — `2x`, `50m`, `2(a)`, `(a)(b)`. It stays as
            // juxtaposition in the tree, which is exactly how Calcpad spells it.
            if (this.startsOperand()) {
                nodes = [...nodes, ...this.parseUnary()];
                continue;
            }
            return nodes;
        }
    }

    /** True when the next token can begin an operand, i.e. an implicit product follows. */
    private startsOperand(): boolean {
        const token = this.peek();
        return token.kind === 'number' || token.kind === 'name' || this.atOperator('(', '[');
    }

    private parseUnary(): MathMlNode[] {
        if (this.atOperator('+', '-')) {
            const operator = this.take().text;
            return [token(operator), ...this.parseUnary()];
        }
        return this.parsePower();
    }

    private parsePower(): MathMlNode[] {
        let nodes = this.parsePostfix();
        for (;;) {
            // Subscript and superscript are the two structures that hang off an
            // operand; `x_1^2` nests as a power over a subscript, as MathML does.
            if (this.atOperator('_')) {
                this.index++;
                const subscript = this.parsePostfix();
                nodes = [el('msub', [slot(nodes), slot(subscript)])];
                continue;
            }
            if (this.atOperator('^')) {
                this.index++;
                const exponent = this.parseUnary();
                nodes = [el('msup', [slot(nodes), slot(exponent)])];
                continue;
            }
            return nodes;
        }
    }

    private parsePostfix(): MathMlNode[] {
        let nodes = this.parsePrimary();
        while (this.atOperator('!', '°')) {
            const operator = this.take().text;
            nodes = [...nodes, token(operator)];
        }
        return nodes;
    }

    private parsePrimary(): MathMlNode[] {
        const tokenAt = this.peek();
        if (tokenAt.kind === 'end') throw new Error('Unexpected end of expression');
        if (tokenAt.kind === 'number') {
            this.index++;
            return [el('mn', [txt(tokenAt.text)])];
        }
        if (tokenAt.kind === 'operator') {
            if (tokenAt.text === '(') {
                this.index++;
                const inner = this.parseAssignment();
                this.expectOperator(')');
                return [el('mrow', [token('('), ...inner, token(')')])];
            }
            if (tokenAt.text === '[') return this.parseLiteral();
            // A bare `|` inside brackets is the row divisor and is handled by
            // `parseLiteral`; anywhere else `splitUnitTarget` has already taken it.
            throw new Error(`Unexpected operator "${tokenAt.text}"`);
        }
        this.index++;
        return this.parseName(tokenAt.text);
    }

    /**
     * A bracketed vector or matrix literal.
     *
     * `[a; b; c]` is one row of cells separated by `;`; a `|` opens the next row,
     * so `[a; b|c; d]` is 2×2. Calcpad gives `|` the row-divisor meaning only
     * inside brackets — outside them it is the unit target, which is why
     * `splitUnitTarget` tracks bracket depth as well as parentheses. The literal
     * becomes an `mtable`, so every cell is an ordinary slot the caret can enter.
     */
    private parseLiteral(): MathMlNode[] {
        this.expectOperator('[');
        const rows: MathMlNode[][][] = [[]];
        let cell: MathMlNode[] = [];
        for (;;) {
            if (this.peek().kind === 'end') throw new Error('Unclosed "["');
            if (this.atOperator(']')) break;
            if (this.atOperator(';')) {
                this.index++;
                rows[rows.length - 1].push(cell);
                cell = [];
                continue;
            }
            if (this.atOperator('|')) {
                this.index++;
                rows[rows.length - 1].push(cell);
                cell = [];
                rows.push([]);
                continue;
            }
            const before = this.index;
            cell.push(...this.parseLogical());
            if (this.index === before) throw new Error('Unexpected token in a matrix literal');
        }
        rows[rows.length - 1].push(cell);
        this.expectOperator(']');
        return [el('mtable', rows.map(row => el('mtr', row.map(nodes => el('mtd', [slot(nodes)])))))];
    }

    private parseName(name: string): MathMlNode[] {
        if (!this.atOperator('(')) return [el('mi', [txt(name)])];

        this.index++;
        const args: MathMlNode[][] = [[]];
        let depth = 1;
        while (depth > 0) {
            if (this.peek().kind === 'end') throw new Error(`Unclosed "(" after "${name}"`);
            if (this.atOperator(';') && depth === 1) {
                this.index++;
                args.push([]);
                continue;
            }
            if (this.atOperator('(')) depth++;
            if (this.atOperator(')')) {
                depth--;
                if (depth === 0) break;
            }
            const before = this.index;
            const piece = this.parseLogical();
            if (this.index === before) throw new Error('Empty function argument');
            args[args.length - 1].push(...piece);
        }
        this.expectOperator(')');

        // `sqrt` and `root` have their own MathML elements; every other call is a
        // name followed by a parenthesised argument list.
        if (name === 'sqrt' && args.length === 1) return [el('msqrt', [slot(args[0])])];
        if (name === 'root' && args.length === 2) return [el('mroot', [slot(args[0]), slot(args[1])])];

        const body: MathMlNode[] = [token('(')];
        args.forEach((argument, i) => {
            if (i > 0) body.push(token(';'));
            body.push(...argument);
        });
        body.push(token(')'));
        return [el('mi', [txt(name)]), el('mrow', body)];
    }

    atEnd(): boolean {
        return this.peek().kind === 'end';
    }
}

/** Wrap a run of nodes in the `mrow` every MathML slot uses, so slots are uniform. */
function slot(children: MathMlNode[]): MathMlElement {
    return el('mrow', children);
}

function token(text: string): MathMlNode {
    if (/^[0-9.]+$/.test(text)) return el('mn', [txt(text)]);
    if (SPACED_OPERATORS.has(text) || OPERATOR_CHARS.has(text)) return el('mo', [txt(text)]);
    return el('mi', [txt(text)]);
}

/**
 * Split a line at the first top-level `|`, the unit target.
 *
 * `|` is overloaded: between `[` and `]` it separates matrix rows, and only
 * outside any bracket pair is it the unit target. So both bracket kinds count
 * towards the depth, or `[a; b|c; d]` would be cut in half.
 */
function splitUnitTarget(source: string): { expression: string; units: string | null } {
    let depth = 0;
    for (let i = 0; i < source.length; i++) {
        const ch = source[i];
        if (ch === '(' || ch === '[') depth++;
        else if (ch === ')' || ch === ']') depth--;
        else if (ch === '|' && depth === 0) {
            return { expression: source.slice(0, i), units: source.slice(i + 1).trim() };
        }
    }
    return { expression: source, units: null };
}

export interface CalcpadParseResult {
    root: MathMlElement | null;
    /** Set when `root` is null: the construct that stopped the parse. */
    reason?: string;
}

/** Parse one Calcpad line into the editor's MathML root. */
export function calcpadLineToMathMl(source: string): CalcpadParseResult {
    const trimmed = source.trim();
    if (trimmed === '') return { root: null, reason: 'empty line' };

    const unsupported = [...UNSUPPORTED_CHARS].find(ch => trimmed.includes(ch));
    if (unsupported) return { root: null, reason: `the "${unsupported}" construct` };

    const { expression, units } = splitUnitTarget(trimmed);
    const parser = new ExpressionParser(tokenize(expression));
    try {
        const nodes = parser.parseAssignment();
        if (!parser.atEnd()) return { root: null, reason: 'trailing text' };
        if (units !== null) {
            nodes.push(el('mo', [txt('|')]), el('mtext', [txt(units)]));
        }
        return { root: rootOf(nodes) };
    } catch (error) {
        return { root: null, reason: error instanceof Error ? error.message : 'parse error' };
    }
}

// ---- MathML → Calcpad -------------------------------------------------------

/** Binding power of a node when it appears as an operand. */
function nodePrecedence(node: MathMlNode): number {
    if (!isElement(node)) return PREC_ATOM;
    switch (node.name) {
        case 'mfrac': return PREC_FRACTION;
        case 'msup': return PREC_POWER;
        case 'msub': case 'msubsup': return 8;
        case 'mo': return PRECEDENCE[tokenText(node) ?? ''] ?? PREC_ATOM;
        default: return PREC_ATOM;
    }
}

/** The lowest binding power among a run of siblings — the run's own precedence. */
function sequencePrecedence(children: MathMlNode[]): number {
    let min = PREC_ATOM;
    for (const child of children) min = Math.min(min, nodePrecedence(child));
    return min;
}

/**
 * Whether two adjacent operands need an explicit `*`. Juxtaposition is Calcpad's
 * implicit multiplication (`2x`, `2(x)`), so an operator is only written where
 * leaving it out would merge the two tokens into one (`xy`, `23`, `x2`).
 */
export function needsMultiply(left: string, right: string): boolean {
    const a = left[left.length - 1];
    const b = right[0];
    if (!a || !b) return false;
    if (!/[\p{L}\p{N}_]/u.test(a)) return false;
    // A following `(` is a call or an implicit product; both spell the same.
    if (b === '(' || b === '[') return false;
    if (!/[\p{L}\p{N}_]/u.test(b)) return false;
    // `2x` is implicit multiplication the author wrote that way.
    if (/[0-9]/.test(a) && /[\p{L}_]/u.test(b)) return false;
    return true;
}

function isSpacedOperator(text: string): boolean {
    return text.length > 0 && SPACED_OPERATORS.has(text);
}

/**
 * Join a run of siblings into Calcpad text. Returns `null` for anything unsupported.
 *
 * Spacing is decided per token rather than per character: an operator earns a
 * space on both sides only when it is *binary*, which is what tells `a - b` from
 * the unary `-a^2`. Without that, a leading minus would come back as `- a^2`.
 */
function sequenceToCalcpad(children: MathMlNode[]): string | null {
    const parts: { text: string; binary: boolean }[] = [];
    for (const child of children) {
        const text = toCalcpad(child, 1);
        if (text === null) return null;
        if (text === '') continue;
        const isOperator = isElement(child) && child.name === 'mo';
        const previous = parts[parts.length - 1];
        // Binary when an operand precedes it; a second operator in a row is unary.
        const binary = isOperator && isSpacedOperator(text) && previous !== undefined && !previous.binary;
        parts.push({ text, binary });
    }

    let out = '';
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (i > 0) {
            const previous = parts[i - 1];
            if (needsMultiply(previous.text, part.text)) out += '*';
            else if (previous.binary || part.binary || previous.text.endsWith(';')) out += ' ';
        }
        out += part.text;
    }
    return out;
}

/** Serialize one node, bracketing it when its own binding power is too weak here. */
function toCalcpad(node: MathMlNode, minPrecedence: number): string | null {
    const raw = rawToCalcpad(node);
    if (raw === null) return null;
    return nodePrecedence(node) < minPrecedence ? `(${raw})` : raw;
}

function slotToCalcpad(node: MathMlNode | undefined, minPrecedence: number): string | null {
    if (!node) return '';
    if (!isElement(node)) return isText(node) ? node.text : null;
    return toCalcpad(node, minPrecedence);
}

function rawToCalcpad(node: MathMlNode): string | null {
    if (isText(node)) return node.text;
    switch (node.name) {
        case 'mi': case 'mn': case 'mo': case 'mtext':
            return tokenText(node) ?? '';
        case 'mrow':
            return sequenceToCalcpad(node.children);
        case 'mfrac':
            return joinBinary(slotToCalcpad(node.children[0], PREC_MULTIPLICATIVE), '/', slotToCalcpad(node.children[1], PREC_MULTIPLICATIVE + 1));
        case 'msqrt': {
            const inner = sequenceToCalcpad(innerChildren(node));
            return inner === null ? null : `sqrt(${inner})`;
        }
        case 'mroot': {
            const base = sequenceToCalcpad(innerChildren(node, 0));
            const degree = sequenceToCalcpad(innerChildren(node, 1));
            return base === null || degree === null ? null : `root(${base}; ${degree})`;
        }
        case 'msup':
            return joinBinary(slotToCalcpad(node.children[0], PREC_BASE), '^', slotToCalcpad(node.children[1], PREC_EXPONENT));
        case 'msub':
            return joinBinary(slotToCalcpad(node.children[0], PREC_BASE), '_', slotToCalcpad(node.children[1], PREC_BASE));
        case 'msubsup':
            return joinBinary(
                joinBinary(slotToCalcpad(node.children[0], PREC_BASE), '_', slotToCalcpad(node.children[1], PREC_BASE)),
                '^',
                slotToCalcpad(node.children[2], PREC_EXPONENT),
            );
        case 'mfenced': {
            const inner = sequenceToCalcpad(node.children);
            if (inner === null) return null;
            const open = node.attributes.open ?? '(';
            const close = node.attributes.close ?? ')';
            return `${open}${inner}${close}`;
        }
        case 'mtable':
            return tableToCalcpad(node);
        default:
            return null;
    }
}

/**
 * A `mtable` back to a Calcpad literal: cells joined with `; `, rows with `|`.
 *
 * Calcpad writes the cell separator spaced and the row separator tight —
 * `[a; b|c; d]` — so the printed line is the one the author would have typed.
 * Anything that is not a plain `mtable > mtr > mtd` shape is refused, which
 * leaves the line to the source editor rather than guessing at it.
 */
function tableToCalcpad(node: MathMlElement): string | null {
    const rows: string[] = [];
    for (const row of node.children) {
        if (!isElement(row) || row.name !== 'mtr') return null;
        const cells: string[] = [];
        for (const cell of row.children) {
            if (!isElement(cell) || cell.name !== 'mtd') return null;
            const inner = sequenceToCalcpad(innerChildren(cell));
            if (inner === null) return null;
            cells.push(inner);
        }
        rows.push(cells.join('; '));
    }
    return `[${rows.join('|')}]`;
}

function joinBinary(left: string | null, operator: string, right: string | null): string | null {
    if (left === null || right === null) return null;
    return `${left}${operator}${right}`;
}

/** The children of a slot child, unwrapping the `mrow` every slot uses. */
function innerChildren(node: MathMlElement, index = 0): MathMlNode[] {
    const child = node.children[index];
    if (!child) return [];
    return isElement(child) && child.name === 'mrow' ? child.children : [child];
}

/** Serialize the editor's MathML root back to one Calcpad line. `null` when unsupported. */
export function mathMlToCalcpadLine(root: MathMlElement): string | null {
    const expression = elementAt(root, [0]);
    if (!expression) return '';
    return sequenceToCalcpad(expression.children);
}

// ---- the editability gate ---------------------------------------------------

export interface EditabilityCheck {
    ok: boolean;
    reason?: string;
    root?: MathMlElement;
}

/**
 * Decide whether a line can be opened graphically.
 *
 * The test is a fixed point on the *tree*, not the text: parse the source, write
 * it back, parse that, and require the two trees to match. Spacing and bracket
 * spelling may differ between passes — they are not meaning — but a construct the
 * bridge models imperfectly shows up as a different tree and the line is left to
 * the source editor.
 */
export function checkGraphicallyEditable(source: string): EditabilityCheck {
    const first = calcpadLineToMathMl(source);
    if (!first.root) return { ok: false, reason: first.reason };

    const text = mathMlToCalcpadLine(first.root);
    if (text === null) return { ok: false, reason: 'an unsupported structure' };

    const second = calcpadLineToMathMl(text);
    if (!second.root) return { ok: false, reason: 'the round-trip did not parse' };
    if (!equalNodes(first.root, second.root)) {
        return { ok: false, reason: 'the round-trip changed the expression' };
    }
    return { ok: true, root: first.root };
}

/** The MathML markup for a line, or `null` when the line is not graphically editable. */
export function lineToMathMlMarkup(source: string): string | null {
    const check = checkGraphicallyEditable(source);
    return check.root ? serializeMathMl(check.root) : null;
}

export { parseMathMl };
