// Calcpad parser — tokens to a MathML AST.
//
// The AST stores *canonical Calcpad glyphs*, never a presentation form, so the printer is an
// exact inverse and the renderer/OMML layers are the only places that translate for display.
// Two operators are structural: `/` builds `mfrac`, `^` builds `msup`. Everything else keeps
// its glyph in an `<mo>`.

import {
    MathElement, MathNode, el, elAttr, mi, mn, mo, txt,
} from './model';
import { LEVEL, SPECIAL_FUNCTIONS, BUILTIN_FUNCTIONS, opSpec } from './grammar';
import { Token, tokenize } from './tokenizer';

export interface ParseError {
    readonly message: string;
    readonly pos: number;
}

export interface ParseResult {
    readonly node: MathNode | null;
    readonly ok: boolean;
    readonly error?: ParseError;
    /** A solver/drawing call was present, so the line is not an editable expression. */
    readonly opaque: boolean;
}

class ParseFailure extends Error {
    constructor(message: string, readonly pos: number) {
        super(message);
    }
}

export function parseCalcpad(source: string): ParseResult {
    const trimmed = source.trim();
    if (trimmed === '') return { node: null, ok: false, error: { message: 'empty', pos: 0 }, opaque: false };

    const lexed = tokenize(trimmed);
    if (!lexed.ok) {
        return { node: null, ok: false, error: lexed.error, opaque: false };
    }

    const opaque = lexed.tokens.some((t) => t.type === 'solver');

    const parser = new Parser(lexed.tokens);
    try {
        const node = parser.parseExpression();
        if (!parser.atEnd()) {
            const t = parser.peek();
            throw new ParseFailure(`Unexpected "${t.text}"`, t.pos);
        }
        return { node, ok: true, opaque };
    } catch (e) {
        if (e instanceof ParseFailure) {
            return { node: null, ok: false, error: { message: e.message, pos: e.pos }, opaque };
        }
        throw e;
    }
}

class Parser {
    private index = 0;

    constructor(private readonly tokens: readonly Token[]) {}

    atEnd(): boolean {
        return this.index >= this.tokens.length;
    }

    peek(offset = 0): Token {
        return this.tokens[this.index + offset] ?? { type: 'error', text: '', pos: -1 };
    }

    next(): Token {
        return this.tokens[this.index++];
    }

    private expect(type: Token['type']): Token {
        const t = this.peek();
        if (t.type !== type) throw new ParseFailure(`Expected ${type}`, t.pos);
        return this.next();
    }

    // --- precedence ladder, loosest first -------------------------------------------------

    parseExpression(): MathNode {
        return this.parseAssign();
    }

    private parseAssign(): MathNode {
        let left = this.parsePhasor();
        while (this.peek().type === 'operator' && opSpec(this.peek().text)?.level === LEVEL.ASSIGN) {
            const spec = opSpec(this.next().text)!;
            left = this.combine(left, spec.glyph, spec.mo, this.parsePhasor());
        }
        return left;
    }

    private parsePhasor(): MathNode {
        let left = this.parseOr();
        while (this.peek().type === 'operator' && opSpec(this.peek().text)?.level === LEVEL.PHASOR) {
            const spec = opSpec(this.next().text)!;
            left = this.combine(left, spec.glyph, spec.mo, this.parseOr());
        }
        return left;
    }

    private parseOr(): MathNode {
        let left = this.parseAnd();
        while (this.peek().type === 'operator' && opSpec(this.peek().text)?.level === LEVEL.OR) {
            const spec = opSpec(this.next().text)!;
            left = this.combine(left, spec.glyph, spec.mo, this.parseAnd());
        }
        return left;
    }

    private parseAnd(): MathNode {
        let left = this.parseRel();
        while (this.peek().type === 'operator' && opSpec(this.peek().text)?.level === LEVEL.AND) {
            const spec = opSpec(this.next().text)!;
            left = this.combine(left, spec.glyph, spec.mo, this.parseRel());
        }
        return left;
    }

    private parseRel(): MathNode {
        let left = this.parseAdd();
        while (this.peek().type === 'operator' && opSpec(this.peek().text)?.level === LEVEL.REL) {
            const spec = opSpec(this.next().text)!;
            left = this.combine(left, spec.glyph, spec.mo, this.parseAdd());
        }
        return left;
    }

    private parseAdd(): MathNode {
        let left = this.parseMul();
        for (;;) {
            const t = this.peek();
            const level = t.type === 'unit' ? LEVEL.ADD
                : t.type === 'operator' ? opSpec(t.text)?.level
                    : undefined;
            if (level !== LEVEL.ADD) break;
            const glyph = t.type === 'unit' ? '|' : t.text;
            this.next();
            left = this.combine(left, glyph, opSpec(glyph)!.mo, this.parseMul());
        }
        return left;
    }

    private parseMul(): MathNode {
        let left = this.parseImplicit();
        for (;;) {
            const t = this.peek();
            const level = t.type === 'operator' ? opSpec(t.text)?.level : undefined;
            if (level !== LEVEL.MULT) break;
            const glyph = this.next().text;
            left = this.combine(left, glyph, opSpec(glyph)!.mo, this.parseImplicit());
        }
        return left;
    }

    /**
     * Juxtaposition: `2x`, `2(x)`, `(a)(b)`, `2sin(x)` — binds tighter than `*`.
     *
     * The factors stay in one flat row instead of nesting left, so the tree an editor builds by
     * typing matches the tree the parser builds from the same text — the editor/parser invariant.
     */
    private parseImplicit(): MathNode {
        const factors: MathNode[] = [this.parseUnary()];
        while (this.startsOperand(this.peek())) factors.push(this.parseUnary());
        return factors.length === 1 ? factors[0] : el('mrow', factors);
    }

    private startsOperand(t: Token): boolean {
        return t.type === 'number' || t.type === 'name' || t.type === 'lparen'
            || t.type === 'lbracket' || t.type === 'string';
    }

    private parseUnary(): MathNode {
        const t = this.peek();
        if (t.type === 'operator' && (t.text === '-' || t.text === '+')) {
            this.next();
            const operand = this.parseUnary();
            return t.text === '-' ? el('mrow', [mo('-'), operand]) : operand;
        }
        return this.parsePower();
    }

    private parsePower(): MathNode {
        const base = this.parsePostfix();
        if (this.peek().type === 'operator' && this.peek().text === '^') {
            this.next();
            const exponent = this.parseUnary();
            return el('msup', [base, exponent]);
        }
        return base;
    }

    private parsePostfix(): MathNode {
        let node = this.parsePrimary();
        while (this.peek().type === 'postfix') {
            this.next();
            node = el('mrow', [node, mo('!')]);
        }
        return node;
    }

    // --- primaries ------------------------------------------------------------------------

    private parsePrimary(): MathNode {
        const t = this.peek();

        if (t.type === 'number') { this.next(); return mn(t.text); }

        if (t.type === 'string') {
            this.next();
            return elAttr('mtext', { 'data-cp': 'label' }, [txt(t.text)]);
        }

        if (t.type === 'lparen') {
            this.next();
            const inner = this.parseExpression();
            this.expect('rparen');
            return el('mrow', [mo('('), inner, mo(')')]);
        }

        if (t.type === 'lbracket') return this.parseBracketLiteral();

        if (t.type === 'name') {
            this.next();
            if (this.peek().type === 'lparen') return this.parseCall(t.text);
            return nameToNode(t.text);
        }

        if (t.type === 'solver') {
            // A drawing call or solver block: preserved verbatim, never offered as a field.
            this.next();
            return elAttr('mtext', { 'data-cp': 'opaque' }, [txt(t.text)]);
        }

        throw new ParseFailure(t.text === '' ? 'Unexpected end of expression' : `Unexpected "${t.text}"`, t.pos);
    }

    private parseCall(name: string): MathNode {
        const args: MathNode[] = [];
        this.expect('lparen');
        if (this.peek().type !== 'rparen') {
            args.push(this.parseExpression());
            while (this.peek().type === 'semicolon') {
                this.next();
                args.push(this.parseExpression());
            }
        }
        this.expect('rparen');

        const special = SPECIAL_FUNCTIONS[name];
        if (special === 'sqrt' && args.length === 1) return el('msqrt', [args[0]]);
        if (special === 'cbrt' && args.length === 1) {
            return elAttr('mroot', { 'data-cp': 'cbrt' }, [args[0], mn('3')]);
        }
        if (special === 'root' && args.length === 2) {
            return elAttr('mroot', { 'data-cp': 'root' }, [args[0], args[1]]);
        }
        if (special === 'abs' && args.length === 1) {
            return elAttr('mrow', { 'data-cp': 'abs' }, [mo('|'), args[0], mo('|')]);
        }

        const children: MathNode[] = [nameToNode(name, true), mo('(')];
        args.forEach((arg, i) => {
            if (i > 0) children.push(mo(';'));
            children.push(arg);
        });
        children.push(mo(')'));
        return el('mrow', children);
    }

    private parseBracketLiteral(): MathNode {
        this.expect('lbracket');
        const rows: MathNode[][] = [[]];
        if (this.peek().type !== 'rbracket') {
            rows[0].push(this.parseExpression());
            for (;;) {
                const t = this.peek();
                if (t.type === 'semicolon') { this.next(); rows[rows.length - 1].push(this.parseExpression()); }
                else if (t.type === 'rowdivisor') { this.next(); rows.push([this.parseExpression()]); }
                else break;
            }
        }
        this.expect('rbracket');

        if (rows.length === 1) {
            const children: MathNode[] = [mo('[')];
            rows[0].forEach((cell, i) => {
                if (i > 0) children.push(mo(';'));
                children.push(cell);
            });
            children.push(mo(']'));
            return el('mrow', children);
        }

        const table = el('mtable', rows.map((cells) => el('mtr', cells.map((cell) => el('mtd', [cell])))));
        return el('mrow', [mo('['), table, mo(']')]);
    }

    // --- helpers --------------------------------------------------------------------------

    private combine(left: MathNode, glyph: string, moContent: string, right: MathNode): MathNode {
        if (glyph === '^') return el('msup', [left, right]);
        if (glyph === '/' || glyph === '\u00F7') return el('mfrac', [left, right]);
        return el('mrow', [left, mo(moContent), right]);
    }
}

/**
 * A name, split at the first `_` into a subscript — exactly how Calcpad renders variables.
 *
 * Exported because the editor must build the *same* node when it extends a name by typing:
 * `a_b` is not a plain identifier, it is `msub(mi(a), mi(b))`, and a client that produced
 * `mi('a_b')` would hold a tree its own parser never builds from the same text.
 */
export function nameToNode(name: string, isFunction = false): MathElement {
    const attrs: Record<string, string> = {};
    if (isFunction && BUILTIN_FUNCTIONS.has(name)) attrs['data-cp'] = 'func';
    const underscore = name.indexOf('_');
    if (underscore > 0 && underscore < name.length - 1) {
        const script = name.slice(underscore + 1);
        // A numeric subscript is a number, so an edited `q_1` and a parsed `q_1` are the same tree.
        const subscript = /^[0-9]+$/.test(script) ? mn(script) : mi(script);
        return el('msub', [mi(name.slice(0, underscore), attrs), subscript]);
    }
    return mi(name, attrs);
}
