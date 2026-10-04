/**
 * Calcpad text syntax: tokenizer, recursive-descent parser to MathJSON, and printer back
 * to Calcpad source. See `Setup/AI/Work/CALCPAD_LANGUAGE_REFERENCE_FOR_CLAUDE.md`.
 */

import type { MathJSON, MathNumber } from './mathjson';
import { formatNumberAsCalcpad } from './mathjson';

/** SI prefixes that Calcpad accepts in front of a base unit. */
const PREFIXES = ['da', 'y', 'z', 'a', 'f', 'p', 'n', 'μ', 'u', 'm', 'c', 'd', 'h', 'k', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y'];

/** Unit stems after prefix removal. Mirrors the tables in the Calcpad language reference. */
const BASE_UNITS = new Set([
    // dimensionless
    '%', '‰', '‱', 'pcm', 'ppm', 'ppb', 'ppt', 'ppq',
    // angle
    '°', '′', '″', 'deg', 'rad', 'grad', 'gra', 'rev',
    // mass
    'g', 'kg', 't', 'kt', 'Mt', 'Gt', 'Da', 'gr', 'dr', 'oz', 'lb', 'lbm', 'st', 'qr', 'cwt', 'ton', 'slug',
    // length
    'm', 'AU', 'ly', 'th', 'in', 'ft', 'yd', 'ch', 'fur', 'mi', 'ftm', 'cable', 'nmi', 'li', 'rod', 'pole', 'perch', 'lea',
    // time
    's', 'min', 'h', 'd', 'w', 'y',
    // frequency / speed
    'Hz', 'rpm', 'kmh', 'mph', 'knot',
    // electric current / charge / potential
    'A', 'C', 'V', 'F', 'S', 'W', 'Wb', 'T', 'H', 'lm', 'lx',
    // temperature
    'K', '°C', '°F', '°R', 'Δ°C', 'Δ°F',
    // substance / activity / radiation
    'mol', 'cd', 'kat', 'Bq', 'Gy', 'Sv', 'Ci', 'Rd',
    // derived
    'N', 'Pa', 'J', 'Nm', 'Ohm', 'Ω', 'cal', 'kcal', 'erg', 'eV', 'Wh', 'BTU', 'therm', 'quad', 'ha', 'a', 'L',
    'P', 'cP', 'St', 'cSt', 'dyn', 'gf', 'kgf', 'tf', 'ozf', 'lbf', 'oz_f', 'lb_f', 'kip', 'kipf', 'kip_m', 'kipm',
    'tonf', 'ton_f', 'pdl', 'bar', 'atm', 'at', 'Torr', 'mmHg', 'inHg', 'osi', 'osf', 'psi', 'psf', 'ksi', 'ksf',
    'tsi', 'tsf', 'hp', 'hpE', 'hpS', 'ks', 'rood', 'ac', 'fl_oz', 'gi', 'pt', 'qt', 'gal', 'bbl', 'pk', 'bu',
    '€', '£', '₤', '¥', '¢', '₽', '₹', '₩', '₪',
]);

function buildUnitSet(): Set<string> {
    const all = new Set<string>(BASE_UNITS);
    for (const base of BASE_UNITS) {
        if (base.length > 8) continue;
        for (const p of PREFIXES) {
            // SI keeps the prefix's own case: kN, MN, mN and daN are all correct as
            // plain concatenations. No case-flipping — it invents units that don't exist.
            all.add(p + base);
        }
    }
    return all;
}

const UNIT_NAMES = buildUnitSet();

export function isUnitName(name: string): boolean {
    return UNIT_NAMES.has(name);
}

/**
 * Calcpad unit symbols overlap with plausible variable names (`a`, `c`, `m`, `s`, `w` are
 * all units), so a multi-character name is always a unit and a one-character name only
 * where nothing else is possible. Guessing the other way would turn variables into units.
 */
function isUnambiguousUnit(name: string): boolean {
    return name.length > 1 && isUnitName(name);
}

type TokenType = 'number' | 'ident' | 'op' | 'lparen' | 'rparen' | 'lbracket' | 'rbracket' | 'comma' | 'semi' | 'text' | 'eof';

/**
 * Attaches a trailing `_` to whatever it decorates. Calcpad writes it inside the name
 * (`V_Rd_c_`), and it may land on an identifier or on the subscript it follows, so both
 * have to keep it for the round trip to be faithful.
 */
function appendUnderscore(node: MathJSON): MathJSON {
    if (node.type === 'Identifier') return { ...node, sym: node.sym + '_' };
    if (node.type === 'Sub') return { ...node, sub: appendUnderscore(node.sub) };
    if (node.type === 'Sup') return { ...node, sup: appendUnderscore(node.sup) };
    if (node.type === 'Index') return { ...node, index: appendUnderscore(node.index) };
    return node;
}

interface Token {
    type: TokenType;
    value: string;
    n?: number;
    start: number;
    end: number;
}

// `←` (assignment to an outer scope) and `∠` (phasor angle) are operators in
// `docs/quick-reference.md`. Leaving them out made the tokenizer read them as variable
// names, so `a ← 5` parsed as `a * ← * 5` and the glyph was lost on the way back.
const MULTI_CHAR_OPS = ['≤', '≥', '≠', '≡', '∧', '∨', '⊕', '⦼', '∗', '·', '÷', '←', '∠'];
const SINGLE_CHAR_OPS = '+-*/\\^!<>=|_';

const isDigit = (c: string): boolean => c >= '0' && c <= '9';
const isIdentStart = (c: string): boolean => /\p{L}|\p{Nl}/u.test(c);
// `_` is deliberately not an identifier character: in Calcpad it is the subscript
// operator, so `s_1` must lex as `s`, `_`, `1` rather than one name.
//
// The Unicode subscript digits are the other documented spelling of the same thing
// (`x₁` and `x_1` both name `x` with subscript 1), so they continue a name rather than
// standing alone as one.
const SUBSCRIPT_DIGIT_CLASS = '\\u2080-\\u2089';
const isIdentPart = (c: string): boolean =>
    new RegExp(`[\\p{L}\\p{Nl}\\p{Nd}${SUBSCRIPT_DIGIT_CLASS}′″‴⁗]`, 'u').test(c);

export function tokenize(src: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;

    while (i < src.length) {
        const c = src[i];
        // A `'` or `"` opens a quoted literal, as `ExpressionParser.GetTokens` does. It is
        // *not* a comment: `1' - for |Mx|` is a user-entered value with a label, and
        // `k_2(n)' => 'A_1(m; n)` is a label of ` => `. The literal runs to the next
        // identical quote or to the end of the line; the other quote is an ordinary
        // character inside it, and a doubled quote is an escaped one.
        if (c === "'" || c === '"') {
            let j = i + 1;
            while (j < src.length) {
                if (src[j] === c) {
                    if (src[j + 1] === c) { j += 2; continue; }
                    j++;
                    break;
                }
                j++;
            }
            tokens.push({ type: 'text', value: src.slice(i, j), start: i, end: j });
            i = j;
            continue;
        }
        if (/\s/.test(c)) {
            i++;
            continue;
        }

        const start = i;

        if (isDigit(c) || (c === '.' && isDigit(src[i + 1]))) {
            while (i < src.length && isDigit(src[i])) i++;
            if (src[i] === '.' && isDigit(src[i + 1])) {
                i++;
                while (i < src.length && isDigit(src[i])) i++;
            } else if (src[i] === '.' && !isIdentStart(src[i + 1] ?? '')) {
                i++;
            }
            if (src[i] === 'e' || src[i] === 'E') {
                const save = i;
                i++;
                if (src[i] === '+' || src[i] === '-') i++;
                if (isDigit(src[i])) {
                    while (i < src.length && isDigit(src[i])) i++;
                } else {
                    i = save;
                }
            }
            const text = src.slice(start, i);
            tokens.push({ type: 'number', value: text, n: Number(text), start, end: i });
            continue;
        }

        if (isIdentStart(c)) {
            i++;
            while (i < src.length && isIdentPart(src[i])) i++;
            tokens.push({ type: 'ident', value: src.slice(start, i), start, end: i });
            // `x.1` indexes a vector/matrix/array; the `.` is an operator here, unlike the
            // decimal point in `1.5`, which follows digits rather than a name.
            if (src[i] === '.' && isDigit(src[i + 1] ?? '')) {
                tokens.push({ type: 'op', value: '.', start: i, end: i + 1 });
                i++;
            }
            continue;
        }

        if (c === '(') { tokens.push({ type: 'lparen', value: c, start, end: ++i }); continue; }
        if (c === ')') { tokens.push({ type: 'rparen', value: c, start, end: ++i }); continue; }
        if (c === '[') { tokens.push({ type: 'lbracket', value: c, start, end: ++i }); continue; }
        if (c === ']') { tokens.push({ type: 'rbracket', value: c, start, end: ++i }); continue; }
        if (c === ',' || c === ';') {
            tokens.push({ type: c === ',' ? 'comma' : 'semi', value: c, start, end: ++i });
            continue;
        }

        const multi = MULTI_CHAR_OPS.find((op) => src.startsWith(op, i));
        if (multi) {
            i += multi.length;
            tokens.push({ type: 'op', value: multi, start, end: i });
            continue;
        }

        if (SINGLE_CHAR_OPS.includes(c)) {
            tokens.push({ type: 'op', value: c, start, end: ++i });
            continue;
        }

        // Unknown character: keep it as an identifier so round-tripping never drops input.
        tokens.push({ type: 'ident', value: c, start, end: ++i });
    }

    tokens.push({ type: 'eof', value: '', start: src.length, end: src.length });
    return tokens;
}

/**
 * Binary precedence. `|` is loosest because a trailing unit target applies to the whole
 * left-hand side (`1.23 m + 35 cm + 12 mm | cm`).
 */
const BINARY_PRECEDENCE: Record<string, number> = {
    '=': 1,
    '|': 2,
    '+': 3,
    '-': 3,
    '∗': 4, '*': 4, '·': 4,
    '/': 4, '÷': 4, '\\': 4, '⦼': 4,
    // `←` assigns to an outer scope and `∠` builds a phasor. Both sit at assignment
    // level; without a precedence the parser consumed the left side and dropped the right.
    '←': 1, '∠': 2,
};

const RIGHT_ASSOCIATIVE = new Set(['^']);
const COMPARISON_OPS = new Set(['<', '>', '≤', '≥', '≠', '≡']);
const LOGICAL_OPS = new Set(['∧', '∨', '⊕']);

export interface ParseOptions {
    /**
     * Treat `text(...)` as an upright unit run instead of a function call. ASCIIMath
     * marks units explicitly this way; Calcpad infers them from the unit table.
     */
    textUnitCalls?: boolean;
    /** Recognise bare unit names as units. On by default. */
    unitNames?: boolean;
}

class Parser {
    private pos = 0;
    /** Non-zero while parsing the target of a `|` unit delimiter. */
    private unitDepth = 0;
    /** Non-zero inside `[...]`, where `|` divides matrix rows instead. */
    private bracketDepth = 0;

    constructor(private readonly tokens: Token[], private readonly options: ParseOptions = {}, private readonly source?: string) {}

    private peek(offset = 0): Token {
        return this.tokens[Math.min(this.pos + offset, this.tokens.length - 1)];
    }

    private next(): Token {
        return this.tokens[Math.min(this.pos++, this.tokens.length - 1)];
    }

    private at(type: TokenType, value?: string): boolean {
        const t = this.peek();
        return t.type === type && (value === undefined || t.value === value);
    }

    private eat(type: TokenType, value?: string): boolean {
        if (!this.at(type, value)) return false;
        this.pos++;
        return true;
    }

    private span(from: number, to: number): [number, number] {
        return [this.tokens[from].start, this.tokens[Math.min(to, this.tokens.length - 1)].end];
    }

    parseExpression(): MathJSON {
        const first = this.parseAssignment();
        if (!this.at('semi') && !this.at('comma')) return first;

        // Calcpad allows several statements per physical line: `x = 1; y = 2`.
        const body: MathJSON[] = [first];
        const seps: string[] = [];
        let trailing = '';
        while (this.at('semi') || this.at('comma')) {
            const sep = this.next().value;
            if (this.at('eof')) {
                // A dangling separator is part of the line, e.g. `x = 1;`.
                trailing = sep;
                break;
            }
            seps.push(sep);
            body.push(this.parseAssignment());
        }
        return { type: 'Statements', body, seps, trailing, source: this.span(0, this.pos) };
    }

    private parseAssignment(): MathJSON {
        const from = this.pos;

        // `A = 0.01m^2` defines a variable called A, even though `A` is also the ampere
        // symbol. An assignment target is always a definition, never a unit, so it is
        // taken as an identifier directly rather than going through unit recognition.
        if (this.at('ident') && this.peek(1).type === 'op' && this.peek(1).value === '=') {
            const name = this.next();
            this.next();
            const rhs = this.parseAssignment();
            return {
                type: 'Operator',
                op: '=',
                args: [
                    { type: 'Identifier', sym: name.value, source: [name.start, name.end] },
                    rhs,
                ],
                form: 'infix',
                source: this.span(from, this.pos),
            };
        }

        const lhs = this.parseBinary(2);
        if (this.at('op', '=') || this.at('op', '←')) {
            const op = this.peek().value;
            this.next();
            const rhs = this.parseAssignment();
            return {
                type: 'Operator',
                op,
                args: [lhs, rhs],
                form: 'infix',
                source: this.span(from, this.pos),
            };
        }
        return lhs;
    }

    private parseBinary(minPrec: number): MathJSON {
        const from = this.pos;
        let left = this.parseUnary();

        for (;;) {
            const t = this.peek();
            const isCompare = t.type === 'op' && COMPARISON_OPS.has(t.value);
            const isLogical = t.type === 'op' && LOGICAL_OPS.has(t.value);
            const op = t.type === 'op' ? t.value : undefined;
            const prec = op !== undefined ? BINARY_PRECEDENCE[op] : undefined;

            let effective: number | undefined;
            if (op === '|' && this.bracketDepth > 0) break;
            if (prec !== undefined) effective = prec;
            else if (isCompare) effective = 2.5;
            else if (isLogical) effective = 2.25;
            else if (this.atImplicitMultiplication()) effective = 4;

            if (effective === undefined || effective < minPrec) break;

            // Implicit multiplication (`2x`) has no operator token to consume — taking one
            // here would eat the first token of the right operand.
            if (op !== undefined) this.next();
            const rightAssoc = RIGHT_ASSOCIATIVE.has(op ?? '');
            if (op === '|') this.unitDepth++;
            const right = this.parseBinary(rightAssoc ? effective : effective + 1);
            if (op === '|') this.unitDepth--;

            if (op === '|') {
                // `a|b` names the target units for the whole left-hand side.
                left = {
                    type: 'Operator',
                    op: '|',
                    args: [left, { type: 'Units', body: flattenUnits(right), source: right.source }],
                    form: 'infix',
                    source: this.span(from, this.pos),
                };
                continue;
            }

            left = {
                type: 'Operator',
                op: op ?? '*',
                // `2x` and `50m` are written without a sign in Calcpad; the flag lets the
                // printer put it back that way instead of inventing `2 * x`.
                implicit: op === undefined,
                args: [left, right],
                form: 'infix',
                source: this.span(from, this.pos),
            };
        }
        return left;
    }

    /**
     * True when the next token can begin a factor without an explicit operator, which is
     * how Calcpad writes `2x`, `3m` and `2 sin(x)`.
     */
    private atImplicitMultiplication(): boolean {
        return this.startsFactor(this.peek());
    }

    /** True for a token that can begin a factor, i.e. what `_` could subscript. */
    private startsFactor(t: Token): boolean {
        return t.type === 'number' || t.type === 'ident' || t.type === 'text'
            || t.type === 'lparen' || t.type === 'lbracket';
    }

    private parseUnary(): MathJSON {
        const from = this.pos;
        const t = this.peek();
        if (t.type === 'op' && (t.value === '-' || t.value === '+')) {
            this.next();
            const operand = this.parseUnary();
            // Fold `-` into a numeric literal so `-1` does not print as `-(1)`, carrying the
            // sign onto the literal so `-0.00000` does not come back as `0.00000`.
            if (t.value === '-' && operand.type === 'Number') {
                return {
                    ...operand,
                    n: -operand.n,
                    raw: operand.raw === undefined ? undefined : `-${operand.raw}`,
                    source: this.span(from, this.pos),
                };
            }
            return {
                type: 'Operator',
                op: t.value,
                args: [operand],
                form: 'prefix',
                source: this.span(from, this.pos),
            };
        }
        return this.parsePower();
    }

    private parsePower(): MathJSON {
        const from = this.pos;
        const base = this.parsePostfix();
        if (this.at('op', '^')) {
            this.next();
            const exp = this.parseUnary();
            return {
                type: 'Sup',
                base,
                sup: exp,
                source: this.span(from, this.pos),
            };
        }
        return base;
    }

    private parsePostfix(): MathJSON {
        const from = this.pos;
        let node = this.parsePrimary();
        for (;;) {
            if (this.at('op', '!')) {
                this.next();
                node = {
                    type: 'Operator',
                    op: '!',
                    args: [node],
                    form: 'postfix',
                    source: this.span(from, this.pos),
                };
                continue;
            }
            if (this.at('op', '.')) {
                // `x.1` — the index of a vector/matrix/array element.
                this.next();
                const index = this.parseSubscriptToken();
                node = { type: 'Index', base: node, index, source: this.span(from, this.pos) };
                continue;
            }
            if (this.at('op', '_')) {
                // A `_` with nothing subscriptable after it is part of the *name*, not an
                // operator: the engine defines `V_Rd_c_` by `V_Rd_c_ = …`, and
                // `max(a; V_Rd_c_)` names the same thing. Treating it as a subscript
                // invented the operand `0` and printed `V_Rd_c_0`; dropping it outright
                // renamed the variable to `V_Rd_c`. It is carried on the identifier so
                // both survive the round trip verbatim.
                //
                // Only a `_` at the very end of a line is the continuation marker, and
                // `splitWorksheet` has already joined those before parsing.
                if (!this.startsFactor(this.peek(1))) {
                    this.next();
                    node = appendUnderscore(node);
                    continue;
                }
                this.next();
                // A subscript binds to a single token, so `q_n(n)` is the function
                // q_n applied to n rather than the subscript `n(n)`.
                const sub = this.parseSubscriptToken();
                node = { type: 'Sub', base: node, sub, source: this.span(from, this.pos) };
                if (this.at('lparen') && node.base.type === 'Identifier') {
                    this.next();
                    const args = this.parseSequenceUntil('rparen');
                    this.expect('rparen');
                    node = {
                        type: 'Function',
                        fn: `${node.base.sym}_${astToCalcpad(sub)}`,
                        args,
                        subscript: sub,
                        source: this.span(from, this.pos),
                    };
                }
                continue;
            }
            break;
        }
        return node;
    }

    

    private parsePrimary(): MathJSON {
        const from = this.pos;
        const t = this.peek();

        if (t.type === 'number') {
            this.next();
            return {
                type: 'Number',
                n: t.n ?? Number(t.value),
                raw: t.value,
                source: this.span(from, this.pos),
            };
        }

        if (t.type === 'lparen') {
            this.next();
            const inner = this.parseAssignment();
            this.expect('rparen');
            return { type: 'Group', body: [inner], source: this.span(from, this.pos) };
        }

        if (t.type === 'lbracket') {
            this.next();
            // Inside `[...]` a `|` is a row divider, never a unit target — the same call
            // `MathParser.Input.cs` makes for `TokenTypes.RowDivisor`.
            this.bracketDepth++;
            const rows = this.parseMatrixRows();
            this.bracketDepth--;
            this.expect('rbracket');
            if (rows.length > 1) {
                return { type: 'Matrix', rows, left: '[', right: ']', source: this.span(from, this.pos) };
            }
            return { type: 'Delimited', body: rows[0] ?? [], left: '[', right: ']', source: this.span(from, this.pos) };
        }

        if (t.type === 'text') {
            // `'`- and `"`-delimited literal. The delimiters are part of the syntax, so
            // they are kept on the node and reprinted verbatim. An unterminated literal
            // runs to the end of the line and is legal — `A_s = 84'` — so whether it
            // closed decides whether a character has to be put back.
            this.next();
            const quote = t.value[0];
            const closed = t.value.length > 1 && t.value.endsWith(quote);
            return {
                type: 'QuotedText',
                text: closed ? t.value.slice(1, -1) : t.value.slice(1),
                quote,
                closed,
                source: this.span(from, this.pos),
            };
        }

        if (t.type === 'ident') {
            this.next();
            const name = t.value;

            // An identifier immediately followed by `(` is a call, whatever its case: Calcpad's
            // user functions are written `Y(n; y)` as readily as `sin(x)`. A number
            // followed by `(` stays multiplication, as in `2(x)`.
            if (this.at('lparen')) {
                this.next();
                if (name === 'text' && this.options.textUnitCalls) {
                    const raw = this.rawUntil('rparen');
                    this.expect('rparen');
                    return { type: 'Text', text: raw, unit: true, source: this.span(from, this.pos) };
                }

                const args = this.parseSequenceUntil('rparen');
                this.expect('rparen');
                const call: MathJSON = { type: 'Function', fn: name, args, source: this.span(from, this.pos) };
                return wrapRootCall(call);
            }

            if (this.options.unitNames !== false && this.readsAsUnit(name)) {
                return { type: 'Text', text: name, unit: true, source: this.span(from, this.pos) };
            }

            return { type: 'Identifier', sym: name, source: this.span(from, this.pos) };
        }

        // Nothing consumable: return an empty number so callers can keep going.
        return { type: 'Number', n: 0, source: this.span(from, from) };
    }

    /** Decides whether a bare identifier in primary position is a unit. See `isUnambiguousUnit`. */
    private readsAsUnit(name: string): boolean {
        if (this.unitDepth > 0) return true;
        if (isUnambiguousUnit(name)) return true;
        // Directly after a numeric literal means implicit multiplication (`50m`).
        const prev = this.tokens[this.pos - 2];
        return prev?.type === 'number' && isUnitName(name);
    }

    /**
 * A subscript is a single token, read without call or group handling so that `q_n(n)`
 * is the function q_n applied to n rather than the subscript `n(n)`.
 */
    private parseSubscriptToken(): MathJSON {
        const from = this.pos;
        const t = this.peek();
        if (t.type === 'ident') {
            this.next();
            if (this.options.unitNames !== false && this.readsAsUnit(t.value)) {
                return { type: 'Text', text: t.value, unit: true, source: this.span(from, this.pos) };
            }
            return { type: 'Identifier', sym: t.value, source: this.span(from, this.pos) };
        }
        if (t.type === 'number') {
            this.next();
            return { type: 'Number', n: t.n ?? 0, source: this.span(from, this.pos) };
        }
        return this.parsePrimary();
    }

    /** Source text of the tokens up to (not including) the closing token. */
    private rawUntil(close: TokenType): string {
        const start = this.peek().start;
        let end = start;
        while (!this.at(close) && !this.at('eof')) end = this.next().end;
        return this.source?.slice(start, end).trim() ?? '';
    }

    /** Arguments separated by `,` or `;`, terminated by the caller's closing token. */
    private parseSequenceUntil(close: TokenType): MathJSON[] {
        const items: MathJSON[] = [];
        if (this.at(close)) return items;
        for (;;) {
            items.push(this.parseAssignment());
            if (this.eat('comma') || this.eat('semi')) continue;
            break;
        }
        return items;
    }

    /**
     * The rows of a `[...]` literal: `,`/`;` divide cells, `|` divides rows. An empty
     * literal yields one empty row so `[]` round-trips rather than becoming a matrix.
     */
    private parseMatrixRows(): MathJSON[][] {
        const rows: MathJSON[][] = [];
        let row: MathJSON[] = [];
        if (this.at('rbracket') || this.at('eof')) return [row];
        for (;;) {
            row.push(this.parseAssignment());
            if (this.eat('comma') || this.eat('semi')) continue;
            if (this.eat('op', '|')) { rows.push(row); row = []; continue; }
            break;
        }
        rows.push(row);
        return rows;
    }

    private expect(type: TokenType): boolean {
        return this.eat(type);
    }
}

/** `root(x; n)` becomes a Root node and `sqrt(x)` a Sqrt node. */
function wrapRootCall(call: MathJSON): MathJSON {
    if (call.type !== 'Function') return call;
    const { fn, args, source } = call;

    if (fn === 'sqrt' || fn === 'sqr') {
        return { type: 'Sqrt', radicand: args[0] ?? emptyNumber(), source };
    }
    if (fn === 'root' || fn === 'cbrt') {
        if (fn === 'cbrt') {
            return { type: 'Root', radicand: args[0] ?? emptyNumber(), index: { type: 'Number', n: 3 }, source };
        }
        const [radicand, index] = args;
        if (index === undefined) return { type: 'Sqrt', radicand: radicand ?? emptyNumber(), source };
        return { type: 'Root', radicand: radicand ?? emptyNumber(), index, source };
    }
    return call;
}

function emptyNumber(): MathJSON {
    return { type: 'Number', n: 0 };
}

/** Pulls the runs of a unit expression out of an implicit product. */
function flattenUnits(node: MathJSON): MathJSON[] {
    if (node.type === 'Operator' && node.op === '*' && node.form === 'infix') {
        return [flattenUnits(node.args[0]), flattenUnits(node.args[1])].flat();
    }
    return [node];
}

export function calcpadToAst(script: string): MathJSON {
    return new Parser(tokenize(script)).parseExpression();
}

/** Parses with non-default dialect options; used by the ASCIIMath reader. */
export function parseDialect(script: string, options: ParseOptions): MathJSON {
    return new Parser(tokenize(script), options, script).parseExpression();
}

/**
 * Splits a script into the equation lines a canvas view would make editable. Comments,
 * directives, plotting blocks and SVG drawing calls go to `other` to pass through
 * byte-for-byte; drawing calls embed SVG markup, so they are directives, not maths.
 */
/** Whether a line is maths a canvas renders as an equation; the rest pass through as-is. */
export function isEquationLine(text: string): boolean {
    if (!text) return false;
    if (/^[A-Za-z_][A-Za-z0-9_]*[$@]/.test(text) || text.includes('<tspan')) return false;
    if (/\$[A-Z][A-Za-z]*\s*\{/.test(text)) return false;
    // HTML is only meaningful inside a `$Plot{…}` or `$Map{…}` body. On its own line the
    // engine rejects it -- `Invalid syntax: "< /"` -- so treating a bare `<b>bold</b>` as
    // an equation offered the canvas a field over text that does not even parse.
    if (/^\s*<\/?[A-Za-z!]/.test(text)) return false;
    return !text.startsWith('#') && !text.startsWith('$')
        && !text.startsWith("'") && !text.startsWith('"');
}

export function splitWorksheet(script: string): { equations: { text: string; line: number }[]; other: string[] } {
    const equations: { text: string; line: number }[] = [];
    const other: string[] = [];
    const raw = script.split(/\r?\n/);

    for (let i = 0; i < raw.length; i++) {
        const startLine = i + 1;
        // A trailing `_` continues the statement onto the next physical line, so the
        // joined text is what one equation region actually contains.
        let text = raw[i].trim();
        while (/_$/.test(text) && i + 1 < raw.length) {
            text = `${text.slice(0, -1).trimEnd()} ${raw[++i].trim()}`;
        }        if (!isEquationLine(text)) {
            for (let k = startLine - 1; k <= i; k++) other.push(raw[k]);
            continue;
        }
        equations.push({ text, line: startLine });
    }

    return { equations, other };
}

// ---------------------------------------------------------------------------
// MathJSON -> Calcpad source
// ---------------------------------------------------------------------------

/** Wraps an expression in parentheses when it could otherwise re-associate. */
function needsParens(node: MathJSON, parentPrec: number): boolean {
    if (node.type !== 'Operator' || node.form !== 'infix') return false;
    const prec = BINARY_PRECEDENCE[node.op];
    if (prec === undefined) return node.op === '^';
    return prec < parentPrec;
}

function formatNumber(node: MathNumber): string {
    return formatNumberAsCalcpad(node);
}

/**
 * The space an implicit product needs between its operands. `2x` is unambiguous but
 * `sin x` would fuse into the single name `sinx` if printed with no gap.
 */
function implicitGap(left: string, right: string): string {
    return /[\p{L}\p{Nl}\u2032\u2033]$/u.test(left) && /^[\p{L}\p{Nl}\u2032\u2033]/u.test(right) ? ' ' : '';
}

/** A single token needs no parentheses after `^` or `_`. */
function isSimpleScript(node: MathJSON): boolean {
    return node.type === 'Number' || node.type === 'Identifier' || node.type === 'Text';
}

/** The single expression inside a parenthesised group, used to reprint `x^(1/3)`. */
function unwrapGroup(node: MathJSON): MathJSON {
    return node.type === 'Group' && node.body.length === 1 ? node.body[0] : node;
}

export function astToCalcpad(node: MathJSON): string {
    switch (node.type) {
        case 'Number':
            return formatNumber(node);

        case 'Identifier':
            return node.sym;

        case 'Text':
            return node.text;

        case 'Statements': {
            let out = astToCalcpad(node.body[0] ?? emptyNumber());
            for (let i = 1; i < node.body.length; i++) {
                out += node.seps[i - 1] ?? ';';
                out += astToCalcpad(node.body[i]);
            }
            return out + node.trailing;
        }

        case 'QuotedText':
            return `${node.quote}${node.text}${node.closed === false ? '' : node.quote}`;

        case 'Index':
            return `${astToCalcpad(node.base)}.${astToCalcpad(node.index)}`;

        case 'Units': {
            const [first, ...rest] = node.body;
            const head = first ? astToCalcpad(first) : '';
            return rest.reduce((acc, part) => {
                if (part.type === 'Operator' && (part.op === '/' || part.op === '÷') && part.form === 'infix') {
                    return `${acc}/${astToCalcpad(part.args[1])}`;
                }
                return `${acc}·${astToCalcpad(part)}`;
            }, head);
        }

        case 'Operator': {
            if (node.form === 'postfix' || (node.op === '!' && node.args.length === 1)) {
                return `${astToCalcpad(node.args[0])}!`;
            }
            if (node.form === 'prefix' || (node.args.length === 1 && node.op !== '=')) {
                const op = node.op === '√' ? 'sqrt' : node.op;
                if (!node.args.length) return op;
                const inner = astToCalcpad(node.args[0]);
                // `-x`, `-sin(a)` and `-l_1` need no brackets; `-a + b` does. A subscript and an index
                // bind tighter than negation, so they are atoms here too.
                const atom = ['Number', 'Identifier', 'Text', 'Function', 'Sqrt', 'Group', 'Sub', 'Sup', 'Index'].includes(node.args[0].type);
                return `${op}${atom ? inner : `(${inner})`}`;
            }
            const prec = BINARY_PRECEDENCE[node.op] ?? 2.5;

            // LaTeX has no `|` operator, so a unit target arrives as a spaced upright run and an
            // attached unit as an adjacent one. A *compound* unit text — one containing
            // `/` or `^` — can only have come from a conversion target, so it is written
            // back with Calcpad's `|`. A single symbol stays attached (`50m`, not `50|m`).
            if (node.args.length === 2) {
                const rhs = node.args[1];
                const compound = rhs.type === 'Units'
                    || (rhs.type === 'Text' && rhs.unit === true && /[/^]/.test(rhs.text));
                if (compound) {
                    const lhs = node.args[0];
                    const left = needsParens(lhs, prec) ? `(${astToCalcpad(lhs)})` : astToCalcpad(lhs);
                    return `${left}|${astToCalcpad(rhs)}`;
                }
            }

            const sep = node.implicit ? '' : node.op === '=' ? '=' : node.op === '|' ? '|' : ` ${node.op} `;
            const parts = node.args.map((a) => {
                const text = astToCalcpad(a);
                return needsParens(a, prec) ? `(${text})` : text;
            });
            if (!node.implicit) return parts.join(sep);
            // `2x` needs no sign, but two names would fuse into one token: `sin x` must
            // not come back as `sinx`.
            return parts.reduce((acc, part) => acc + implicitGap(acc, part) + part);
        }

        case 'Group': {
            // An empty group is an unfilled `\placeholder{}` slot, so it prints as
            // parentheses with nothing in them rather than inventing the number `0`.
            if (node.body.length === 0) return '()';
            return `(${astToCalcpad(node.body[0])})`;
        }

        case 'Delimited': {
            const left = node.left ?? '[';
            const right = node.right ?? ']';
            return `${left}${node.body.map(astToCalcpad).join('; ')}${right}`;
        }

        case 'Matrix': {
            const left = node.left ?? '[';
            const right = node.right ?? ']';
            const rows = node.rows.map((row) => row.map(astToCalcpad).join('; ')).join('|');
            return `${left}${rows}${right}`;
        }

        case 'Frac':
            return `(${astToCalcpad(node.num)})/(${astToCalcpad(node.den)})`;

        case 'Sqrt':
            return `sqrt(${astToCalcpad(node.radicand)})`;

        case 'Root': {
            if (node.index === undefined) return `sqrt(${astToCalcpad(node.radicand)})`;
            return `root(${astToCalcpad(node.radicand)}; ${astToCalcpad(node.index)})`;
        }

        case 'Sup': {
            const base = astToCalcpad(node.base);
            // `x^(1/3)` is written with an explicit group; reprinting that group as
            // `x^((1/3))` would add a level of brackets on every pass.
            const sup = unwrapGroup(node.sup);
            return `${base}^${isSimpleScript(sup) ? astToCalcpad(sup) : `(${astToCalcpad(sup)})`}`;
        }

        case 'Sub': {
            const base = astToCalcpad(node.base);
            const sub = unwrapGroup(node.sub);
            return `${base}_${isSimpleScript(sub) ? astToCalcpad(sub) : `(${astToCalcpad(sub)})`}`;
        }

        case 'Function': {
            if (node.fn === 'root' || node.fn === 'sqrt' || node.fn === 'sqr' || node.fn === 'cbrt') {
                return astToCalcpad(wrapRootCall(node));
            }
            return `${node.fn}(${node.args.map(astToCalcpad).join('; ')})`;
        }
    }
}