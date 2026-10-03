/**
 * Calcpad AST ⇄ LaTeX — the bridge to MathLive, whose primary format is LaTeX.
 *
 * ASCIIMath looks closer to Calcpad but MathLive 0.111 renders `text(kN/m^2)` and
 * `root(x,3)` as variables named `text` and `root` — a silent, plausible-looking
 * failure. `tests/calcpadMath.test.ts` covers the macro set MathLive really emits.
 */

import { astToCalcpad } from './calcpad';
import { formatNumberAsCalcpad } from './mathjson';
import type { MathJSON } from './mathjson';

const PREC: Record<string, number> = {
    '=': 1, '|': 2,
    '+': 3, '-': 3,
    '*': 4, '/': 4, '÷': 4, '\\': 4, '⦼': 4, 'mod': 4,
};

function needsParens(node: MathJSON, parentPrec: number): boolean {
    if (node.type !== 'Operator' || node.form !== 'infix') return false;
    const p = PREC[node.op];
    return p === undefined ? node.op === '^' : p < parentPrec;
}

function tex(s: string): string {
    return s.replace(/([\\{}%$#&_])/g, '\\$1');
}

// ---------------------------------------------------------------------------
// AST -> LaTeX
// ---------------------------------------------------------------------------

export function astToLatex(node: MathJSON): string {
    switch (node.type) {
        case 'Number': {
            // `Infinity` spelled out would typeset as a product of letters, so the shared
            // Calcpad spelling is mapped onto TeX rather than re-derived here.
            const text = formatNumberAsCalcpad(node);
            if (text === '∞') return '\\infty';
            if (text === '-∞') return '-\\infty';
            if (text === 'Undefined') return '\\text{Undefined}';
            return text;
        }

        case 'Identifier':
            // Two or more letters would typeset as a product, so they are set upright.
            return node.sym.length > 1 ? `\\mathrm{${tex(node.sym)}}` : tex(node.sym);

        case 'Text':
            // Upright and literal: `/` and `^` inside are not a fraction or exponent.
            return `\\text{${node.text}}`;

        case 'Group':
            return `(${astToLatex(node.body[0] ?? { type: 'Number', n: 0 })})`;

        case 'Delimited': {
            const body = node.body.map(astToLatex).join(', ');
            return `${node.left ?? '['}${body}${node.right ?? ']'}`;
        }

        case 'Units':
            return `\\text{${unitPlainText(node)}}`;

        case 'Frac':
            return `\\frac{${astToLatex(node.num)}}{${astToLatex(node.den)}}`;

        case 'Sqrt':
            return `\\sqrt{${astToLatex(node.radicand)}}`;

        case 'Root':
            return node.index === undefined
                ? `\\sqrt{${astToLatex(node.radicand)}}`
                : `\\sqrt[${astToLatex(node.index)}]{${astToLatex(node.radicand)}}`;

        case 'Sup':
            return `${astToLatex(node.base)}^{${astToLatex(node.sup)}}`;

        case 'Sub':
            return `${astToLatex(node.base)}_{${astToLatex(node.sub)}}`;

        case 'Statements':
            // A canvas renders each statement as its own field; side by side here they
            // stay visually separated rather than collapsing into one product.
            return node.body.map(astToLatex).join('\\qquad ');

        case 'Function': {
            const name = node.subscript
                ? `\\mathrm{${tex(node.fn.split('_')[0])}}_{${astToLatex(node.subscript)}}`
                : `\\mathrm{${tex(node.fn)}}`;
            return `${name}(${node.args.map(astToLatex).join(', ')})`;
        }

        case 'Operator':
            return operatorToLatex(node);

        // A quoted literal is not part of the equation; it labels one. `1' - for |Mx|`
        // is the number `1` described by the text after it.
        case 'QuotedText':
            return `\\text{${tex(node.text)}}`;

        // Calcpad's own output (`XmlWriter.AppendSubscript`) puts the dot inside the
        // subscript, so `x.1` reads as an indexed element rather than a decimal.
        case 'Index':
            return `${astToLatex(node.base)}_{\\text{.}${astToLatex(node.index)}}`;
    }
}

function operatorToLatex(n: Extract<MathJSON, { type: 'Operator' }>): string {
    if (n.form === 'postfix' || n.op === '!') {
        return `${astToLatex(n.args[0] ?? { type: 'Number', n: 0 })}!`;
    }
    if (n.form === 'prefix' && n.op === '-') return `-${astToLatex(n.args[0])}`;
    if (n.op === '√') return `\\sqrt{${astToLatex(n.args[0])}}`;
    // Calcpad's `|` has no TeX analogue. `\quad` is ordinary spacing in TeX, so it renders
    // exactly like the juxtaposition it replaces, while marking the factor that follows
    // as a unit target rather than an attached unit.
    if (n.op === '|') return `${astToLatex(n.args[0])}\\quad${astToLatex(n.args[1])}`;

    const [a, b] = n.args;
    if (b === undefined) return `${tex(n.op)}${a ? astToLatex(a) : ''}`;

    // Division becomes a real stacked fraction, which is what the canvas wants to show;
    // a bare `/` would typeset as a slash.
    if (n.op === '/' || n.op === '÷') {
        return `\\frac{${astToLatex(a)}}{${astToLatex(b)}}`;
    }

    const prec = PREC[n.op] ?? 2;
    const sign = n.op === '*' ? (n.implicit ? ' ' : '\\cdot ') : tex(n.op);
    const left = needsParens(a, prec) ? `(${astToLatex(a)})` : astToLatex(a);
    const right = needsParens(b, prec + 1) ? `(${astToLatex(b)})` : astToLatex(b);
    return `${left}${sign}${right}`;
}

/** A unit expression as plain text: no `\text` wrappers, `/` `*` `^` literal. */
function unitPlainText(node: MathJSON): string {
    switch (node.type) {
        case 'QuotedText':
            return node.text;
        case 'Index':
            return `${unitPlainText(node.base)}.${unitPlainText(node.index)}`;
        case 'Units':
            return node.body.map(unitPlainText).join('');
        case 'Text':
            return node.text;
        case 'Identifier':
            return node.sym;
        case 'Number':
            return formatNumberAsCalcpad(node);
        case 'Sup':
            return `${unitPlainText(node.base)}^${unitPlainText(node.sup)}`;
        case 'Sub':
            return `${unitPlainText(node.base)}_${unitPlainText(node.sub)}`;
        case 'Operator': {
            if (node.form === 'postfix') return `${unitPlainText(node.args[0])}!`;
            const [a, b] = node.args;
            const left = a ? unitPlainText(a) : '';
            if (b === undefined) return `${left}${node.op}`;
            const sign = node.op === '*' && node.implicit ? '' : node.op;
            return `${left}${sign}${unitPlainText(b)}`;
        }
        default:
            return astToLatex(node);
    }
}

// ---------------------------------------------------------------------------
// LaTeX -> AST
//
// A recursive-descent reader straight over the characters. Reading the source in place
// keeps `\frac`/`\sqrt`/`\text` arguments trivial: each is a balanced brace group that
// can be handed back to `parseLatex` as its own source string.
// ---------------------------------------------------------------------------

/**
 * Macros MathLive actually emits, measured against `mathlive@0.111`:
 * `a<=b` → `a\le b`, `a>=b` → `a\ge b`, `a!=b` → `a\ne b`, `a and b` → `a\land b`,
 * `a times b` → `a\times b`. Anything absent here becomes a *variable of that name*,
 * which is the silent failure mode documented at the top of this file.
 */
const MACRO_OPS: Record<string, string> = {
    '\\times': '*', '\\cdot': '*', '\\ast': '*', '\\div': '/', '\\over': '/',
    '\\le': '<=', '\\leq': '<=', '\\lt': '<',
    '\\ge': '>=', '\\geq': '>=', '\\gt': '>',
    '\\ne': '!=', '\\neq': '!=',
    '\\equiv': '=', '\\land': '&&', '\\wedge': '&&', '\\lor': '||', '\\vee': '||',
};

const COMPARISON = new Set(['<', '>', '<=', '>=', '!=', '==']);
const LOGICAL = new Set(['&&', '||']);

/** Characters `binary()` reads as an operator, as opposed to one spelled as a macro. */
const OP_CHARS = '+-*/=<>|^_';

/** Macros that only affect spacing or sizing, carrying no structure. */
const SPACING_MACROS = new Set([
    '\\qquad', '\\displaystyle', '\\textstyle',
    '\\limits', '\\nolimits', '\\big', '\\Big', '\\bigg', '\\Bigg',
]);

function parseLatex(src: string): MathJSON {
    return new LatexReader(src).parse();
}

/** `sqrt`/`root` become their own node types; every other name is a function call. */
function functionOrSpecial(name: string, args: MathJSON[]): MathJSON {
    const first = args[0] ?? { type: 'Number' as const, n: 0 };
    if (name === 'sqrt' || name === 'sqr') return { type: 'Sqrt', radicand: first };
    if (name === 'root') return { type: 'Root', radicand: first, index: args[1] };
    if (name === 'cbrt') return { type: 'Root', radicand: first, index: { type: 'Number', n: 3 } };
    return { type: 'Function', fn: name, args };
}

class LatexReader {
    private i = 0;

    constructor(private readonly s: string) {}

    private skip(): void {
        while (this.i < this.s.length && /\s/.test(this.s[this.i])) this.i++;
    }

    private peek(): string {
        this.skip();
        return this.s[this.i] ?? '';
    }

    private startsWith(t: string): boolean {
        this.skip();
        return this.s.startsWith(t, this.i);
    }

    /** Consumes and returns the next `{...}` group, or '' when there is none. */
    private group(): string {
        this.skip();
        if (this.s[this.i] !== '{') return '';
        let depth = 0;
        const start = this.i + 1;
        while (this.i < this.s.length) {
            const c = this.s[this.i];
            if (c === '\\') { this.i += 2; continue; }
            if (c === '{') depth++;
            else if (c === '}') { depth--; if (depth === 0) break; }
            this.i++;
        }
        const body = this.s.slice(start, this.i);
        this.i++;
        return body;
    }

    /** Consumes one command name, including its backslash. */
    private command(): string {
        if (this.s[this.i] !== '\\') return '';
        let j = this.i + 1;
        while (j < this.s.length && /[A-Za-z]/.test(this.s[j])) j++;
        const cmd = this.s.slice(this.i, j);
        this.i = j;
        return cmd;
    }

    parse(): MathJSON {
        return this.juxtaposed();
    }

    /**
     * An expression plus any factors juxtaposed after it: `10\,\text{kN}` is a product
     * written without an operator.
     */
    private juxtaposed(): MathJSON {
        let node = this.expression();
        for (;;) {
            this.skip();
            if (this.i >= this.s.length) break;
            // `\quad` marks a Calcpad unit target (see `astToLatex`).
            if (this.s.startsWith('\\quad', this.i)) {
                this.i += '\\quad'.length;
                const right = this.expression();
                node = {
                    type: 'Operator',
                    op: '|',
                    args: [node, { type: 'Units', body: [right] }],
                    form: 'infix',
                };
                continue;
            }
            if (!this.startsTerm()) break;
            const right = this.expression();
            node = { type: 'Operator', op: '*', implicit: true, args: [node, right], form: 'infix' };
        }
        return node;
    }

    /** True when the cursor is at the start of a new factor rather than at an operator. */
    private startsTerm(): boolean {
        const c = this.s[this.i];
        if (c === undefined) return false;
        if ('+-*/=<>|^_)],'.includes(c)) return false;
        return /[0-9A-Za-z([{\\]/.test(c);
    }

    /**
     * Parses a `( … )` argument list when one is next, else returns null. Arguments are
     * separated by `,` or `;`; Calcpad accepts both and MathLive normalises to `,`.
     */
    private callArgs(): MathJSON[] | null {
        this.skip();
        // MathLive wraps call arguments in `\left( … \right)`.
        if (this.s.startsWith('\\left', this.i)) this.i += '\\left'.length;
        this.skip();
        if (this.s[this.i] !== '(') return null;
        this.i++;
        const args: MathJSON[] = [];
        this.skip();
        if (this.s[this.i] === ')') { this.i++; return args; }
        for (;;) {
            args.push(this.expression());
            this.skip();
            if (this.s[this.i] === ',' || this.s[this.i] === ';') { this.i++; continue; }
            break;
        }
        this.skip();
        if (this.s.startsWith('\\right', this.i)) this.i += '\\right'.length;
        this.skip();
        if (this.s[this.i] === ')') this.i++;
        return args;
    }

    private expression(): MathJSON {
        return this.binary(1);
    }

    private binary(minPrec: number): MathJSON {
        let left = this.unary();
        for (;;) {
            this.skip();
            let op: string | undefined;
            // A macro has already consumed its own characters; a bare operator character
            // still has to be stepped over.
            let width = 0;
            if (this.s[this.i] === '\\') {
                const at = this.i;
                const cmd = this.command();
                // A punctuation macro (`\,` `\;` `\!` `\:`) has no letters, so `command()`
                // returns a lone backslash. Skip two characters and carry on.
                if (cmd === '\\') { this.i = at + 2; continue; }
                // `\left` / `\right` only size a delimiter; the delimiter itself carries the
                // structure, so skip the sizing command and let `primary()` see the char.
                if (cmd === '\\left' || cmd === '\\right') { this.i = at + cmd.length; continue; }
                if (SPACING_MACROS.has(cmd)) continue;
                const mapped = MACRO_OPS[cmd];
                if (mapped === undefined) {
                    // Not an operator — rewind and let `primary()` handle the macro
                    // (`\frac`, `\sqrt`, `\text`, …).
                    this.i = at;
                    break;
                }
                op = mapped;
            } else if (OP_CHARS.includes(this.s[this.i] ?? '')) {
                op = this.s[this.i];
                width = 1;
            }

            if (op === undefined) break;
            if (op === '^' || op === '_') break;

            let prec = PREC[op];
            if (prec === undefined) {
                if (COMPARISON.has(op)) prec = 2.5;
                else if (LOGICAL.has(op)) prec = 2.25;
            }
            if (prec === undefined || prec < minPrec) break;
            this.i += width;

            if (op === '|') {
                const right = this.binary(prec + 1);
                left = { type: 'Operator', op: '|', args: [left, { type: 'Units', body: [right] }], form: 'infix' };
                continue;
            }

            const right = op === '=' ? this.juxtaposed() : this.binary(prec + 1);
            left = { type: 'Operator', op, args: [left, right], form: 'infix' };
        }
        return left;
    }

    private unary(): MathJSON {
        this.skip();
        if (this.s[this.i] === '-' && this.s[this.i + 1] !== '-') {
            this.i++;
            const operand = this.unary();
            if (operand.type === 'Number') return { ...operand, n: -operand.n };
            return { type: 'Operator', op: '-', args: [operand], form: 'prefix' };
        }
        if (this.s[this.i] === '+') { this.i++; return this.unary(); }
        return this.scripts();
    }

    private scripts(): MathJSON {
        let node = this.primary();
        for (;;) {
            this.skip();
            if (this.s[this.i] === '^') {
                this.i++;
                node = { type: 'Sup', base: node, sup: this.primary() };
                continue;
            }
            if (this.s[this.i] === '_') {
                this.i++;
                node = { type: 'Sub', base: node, sub: this.primary() };
                continue;
            }
            break;
        }
        return node;
    }

    private primary(): MathJSON {
        this.skip();
        const c = this.s[this.i] ?? '';

        if (c === '\\') {
            const at = this.i;
            const cmd = this.command();
            // A punctuation macro carries no structure; skip it and re-read the factor.
            if (cmd === '\\') { this.i = at + 2; return this.primary(); }
            // `\left` / `\right` size the delimiter that follows; the delimiter carries
            // the structure, so drop the sizing command and re-read.
            if (cmd === '\\left' || cmd === '\\right') { this.i = at + cmd.length; return this.primary(); }
            switch (cmd) {
                case '\\frac': {
                    // Kept as `/` rather than a `Frac` node: MathLive renders `\frac` as a
                    // stacked fraction regardless, and preserving the slash keeps the
                    // author's `w*L^2/8` intact. The `Frac` form is reserved for an
                    // explicit fraction such as one parsed from OMML `<m:f>`.
                    const num = parseLatex(this.group());
                    const den = parseLatex(this.group());
                    return { type: 'Operator', op: '/', args: [num, den], form: 'infix' };
                }
                case '\\sqrt': {
                    this.skip();
                    if (this.s[this.i] === '[') {
                        const end = this.s.indexOf(']', this.i);
                        const index = end < 0 ? '' : this.s.slice(this.i + 1, end);
                        this.i = end < 0 ? this.s.length : end + 1;
                        return { type: 'Root', index: parseLatex(index), radicand: parseLatex(this.group()) };
                    }
                    return { type: 'Sqrt', radicand: parseLatex(this.group()) };
                }
                case '\\text':
                    return { type: 'Text', text: this.group(), unit: true };
                case '\\mathrm': {
                    const sym = this.group();
                    const args = this.callArgs();
                    if (args === null) return { type: 'Identifier', sym };
                    return functionOrSpecial(sym, args);
                }
                case ',': case ';': case ':': case '!':
                    return { type: 'Number', n: 0 };
                default: {
                    // `\sin`, `\cos`, … arrive without parentheses, so they only become a
                    // call when arguments actually follow; otherwise they are a name.
                    const sym = cmd.replace(/^\\/, '');
                    const args = this.callArgs();
                    if (args === null) return { type: 'Identifier', sym };
                    return functionOrSpecial(sym, args);
                }
            }
        }

        if (c === '{') {
            // A bare brace group, as used by `x^{2}` and `x_{1}`.
            const body = this.group();
            return parseLatex(body);
        }

        if (/[0-9.]/.test(c)) {
            let j = this.i;
            while (j < this.s.length && /[0-9.]/.test(this.s[j])) j++;
            const n = Number(this.s.slice(this.i, j));
            this.i = j;
            return { type: 'Number', n: Number.isFinite(n) ? n : 0 };
        }

        if (/[A-Za-z]/.test(c)) {
            let j = this.i;
            while (j < this.s.length && /[A-Za-z]/.test(this.s[j])) j++;
            const name = this.s.slice(this.i, j);
            this.i = j;
            const args = this.callArgs();
            if (args === null) return { type: 'Identifier', sym: name };
            return functionOrSpecial(name, args);
        }

        if (c === '(') {
            this.i++;
            const inner = this.expression();
            this.skip();
            if (this.s[this.i] === ')') this.i++;
            return { type: 'Group', body: [inner] };
        }

        if (c === '[') {
            this.i++;
            const body: MathJSON[] = [];
            this.skip();
            if (this.s[this.i] !== ']') {
                for (;;) {
                    body.push(this.expression());
                    this.skip();
                    if (this.s[this.i] === ',') { this.i++; continue; }
                    break;
                }
            }
            if (this.s[this.i] === ']') this.i++;
            return { type: 'Delimited', body, left: '[', right: ']' };
        }

        this.i++;
        return { type: 'Number', n: 0 };
    }
}

export function latexToAst(latex: string): MathJSON {
    return parseLatex(latex);
}

/** LaTeX straight back to Calcpad source. */
export function latexToCalcpad(latex: string): string {
    return astToCalcpad(latexToAst(latex));
}