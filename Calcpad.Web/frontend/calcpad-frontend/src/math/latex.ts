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
    '=': 1, '←': 1, '|': 2, '∠': 2,
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

        case 'Matrix':
            return matrixToLatex(node);

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
        // is the number `1` described by the text after it. The quote character goes
        // *inside* the group so the reader can tell a label from a unit run: both are
        // `\text{…}`, and without the quote `'kN·m` came back as attached units, which
        // silently changed what the line means.
        //
        // A closed literal gets its closing quote inside the group too, doubled so it
        // cannot be confused with a quote that is part of the text. `A_s = 84'` has no
        // closer, and re-adding one gave `84''`, which Calcpad reads as an escaped quote.
        case 'QuotedText': {
            const body = tex(node.text);
            return node.closed === false
                ? `\\text{${node.quote}${body}}`
                : `\\text{${node.quote}${body}${node.quote}${node.quote}}`;
        }

        // Calcpad's own output (`XmlWriter.AppendSubscript`) puts the dot inside the
        // subscript, so `x.1` reads as an indexed element rather than a decimal.
        case 'Index':
            return `${astToLatex(node.base)}_{\\text{.}${astToLatex(node.index)}}`;
    }
}

/**
 * Calcpad has exactly one matrix syntax — `[a; b|c; d]` — so every matrix is emitted as
 * `bmatrix`. It is also the environment MathLive treats as an editable grid: `&` and `\\`
 * move between cells and rows, which is what makes a matrix editable in place.
 */
function matrixToLatex(n: Extract<MathJSON, { type: 'Matrix' }>): string {
    const rows = n.rows.map((row) => row.map(astToLatex).join(' & ')).join('\\\\');
    return `\\begin{bmatrix}${rows}\\end{bmatrix}`;
}

function operatorToLatex(n: Extract<MathJSON, { type: 'Operator' }>): string {
    if (n.form === 'postfix' || n.op === '!') {
        // MathLive reads a bare `!` as factorial and renders it, so nothing to encode.
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
        // `÷` is Calcpad's *inline* division: the same value as `/`, typeset as a slash
        // rather than a bar. `\frac` would also change the meaning in pro mode (`//`).
        return n.op === '÷'
            ? `${astToLatex(a)}\\text{÷}${astToLatex(b)}`
            : `\\frac{${astToLatex(a)}}{${astToLatex(b)}}`;
    }

    // `⦼` modulo, `\` integer division, `←` outer assignment and `∠` phasor have no TeX
    // spelling at all, so they travel as upright text the reader can identify.
    if (n.op === '⦼') return `${astToLatex(a)}\\text{⦼}${astToLatex(b)}`;
    if (n.op === '\\') return `${astToLatex(a)}\\text{\\textbackslash}${astToLatex(b)}`;
    if (n.op === '←') return `${astToLatex(a)}\\text{←}${astToLatex(b)}`;
    if (n.op === '∠') return `${astToLatex(a)}\\text{∠}${astToLatex(b)}`;

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

/**
 * Calcpad operators with no TeX equivalent. Each is carried inside a `\text{}` group:
 * MathLive renders the character upright and the reader recovers it, so the glyph survives
 * the round trip instead of being dropped as an unknown symbol.
 *
 * Measured against the engine, which decides what may be folded rather than preserved:
 * it *rejects* `∖` for integer division (so `\` has to survive verbatim), and *accepts*
 * both `x₁` and `x_1` (so those two are interchangeable -- see `normalize`).
 */
const TEXT_OPERATORS: Record<string, string> = {
    '÷': '÷', '⦼': '⦼', '←': '←', '∠': '∠',
};

const COMPARISON = new Set(['<', '>', '<=', '>=', '!=', '==']);

/**
 * Strips an inner `{\mathrm{…}}` or `{…}` wrapper from a macro body. MathLive writes a
 * named function as `\operatorname{\mathrm{if}}`, and reading the braces literally gave a
 * variable named `\mathrm{if}`.
 */
function unbracedName(body: string): string {
    const wrapped = body.match(/^\s*\\mathrm\s*\{([^{}]*)\}\s*$/);
    if (wrapped !== null) return wrapped[1];
    const braces = body.match(/^\s*\{([^{}]*)\}\s*$/);
    return braces ? braces[1] : body;
}

/**
 * Greek macros MathLive emits once the user *types* a Greek letter, against the Unicode
 * Calcpad writes. Without this, `\sigma` fell through to a variable literally named
 * `sigma` -- so editing any Greek equation silently renamed every symbol in it.
 */
const GREEK_MACROS: Record<string, string> = {
    '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ', '\\delta': 'δ',
    '\\epsilon': 'ε', '\\varepsilon': 'ε', '\\zeta': 'ζ', '\\eta': 'η',
    '\\theta': 'θ', '\\vartheta': 'ϑ', '\\iota': 'ι', '\\kappa': 'κ',
    '\\lambda': 'λ', '\\mu': 'μ', '\\nu': 'ν', '\\xi': 'ξ',
    '\\omicron': 'ο', '\\pi': 'π', '\\varpi': 'ϖ', '\\rho': 'ρ',
    '\\varrho': 'ϱ', '\\sigma': 'σ', '\\varsigma': 'ς', '\\tau': 'τ',
    '\\upsilon': 'υ', '\\phi': 'φ', '\\varphi': 'ϕ', '\\chi': 'χ',
    '\\psi': 'ψ', '\\omega': 'ω',
    '\\Gamma': 'Γ', '\\Delta': 'Δ', '\\Theta': 'Θ', '\\Lambda': 'Λ',
    '\\Xi': 'Ξ', '\\Pi': 'Π', '\\Sigma': 'Σ', '\\Upsilon': 'Υ',
    '\\Phi': 'Φ', '\\Psi': 'Ψ', '\\Omega': 'Ω',
};

/** True for a Greek macro MathLive emits and Calcpad spells as a Unicode letter. */
function greekFromMacro(cmd: string): string | null {
    return GREEK_MACROS[cmd] ?? null;
}
const LOGICAL = new Set(['&&', '||']);

/** Characters `binary()` reads as an operator, as opposed to one spelled as a macro. */
const OP_CHARS = '+-*/=<>|^_';

/**
 * A letter that can be part of a symbol name: ASCII plus the Greek and other Unicode
 * letters Calcpad writes bare (`δ`, `σ_cp`, `ρ_L`). MathLive accepts and emits these
 * unescaped, so restricting the reader to `[A-Za-z]` silently turned every Greek symbol
 * into the number `0` on the way back — the worst failure mode, since the equation still
 * looked plausible.
 */
const LETTER = /[\p{L}]/u;
/** `_` ends a name: it is Calcpad's subscript operator, not part of the symbol. */
const NAME_CHAR = /[\p{L}\p{N}]/u;

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

    /** The next `{...}` body without consuming it, or null when there is no group here. */
    private peekGroup(): string | null {
        const save = this.i;
        const body = this.group();
        this.i = save;
        return body === '' ? null : body;
    }

    /**
     * Arguments written without parentheses, separated by `;` or `,` as MathLive emits
     * them once a bracketed call is flattened. Returns nothing when the cursor is at an
     * operator or the end, so a bare function name is not mistaken for a call.
     */
    private bareArgs(): MathJSON[] {
        const save = this.i;
        const args: MathJSON[] = [];
        this.skip();
        if (!LETTER.test(this.s[this.i] ?? '') && !/[0-9(.-]/.test(this.s[this.i] ?? '')) {
            this.i = save;
            return args;
        }
        for (;;) {
            args.push(this.expression());
            this.skip();
            if (this.s[this.i] === ';' || this.s[this.i] === ',') { this.i++; continue; }
            break;
        }
        return args;
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
        return /[0-9([{\\]/.test(c) || LETTER.test(c);
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

    /**
     * Reads `\begin{env} … \end{env}` for the matrix environments. `&` divides cells and
     * `\\` divides rows. A column-specification argument (`array`'s `{cc}`) is skipped.
     *
     * Calcpad has one matrix syntax — `[a; b|c; d]` — so every environment reads back as
     * a bracketed matrix regardless of which delimiter the LaTeX used.
     */
    private matrixEnvironment(): MathJSON {
        const start = this.i;
        const env = this.group();
        this.skip();
        if (this.s[this.i] === '{') this.group();
        const end = this.s.indexOf(`\\end{${env}}`, this.i);
        if (end < 0) {
            this.i = start;
            return { type: 'Number', n: 0 };
        }
        const body = this.s.slice(this.i, end);
        this.i = end + `\\end{${env}}`.length;

        const rows = body.split(/\\\\/).map((row) =>
            row.split('&').map((cell) => parseLatex(cell)));
        if (rows.length > 1) return { type: 'Matrix', rows, left: '[', right: ']' };
        return { type: 'Delimited', body: rows[0] ?? [], left: '[', right: ']' };
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
                // A Calcpad-only operator travelling as `\text{⦼}`. It is an infix operator
                // here, not a factor, so it has to be taken in the operator loop rather
                // than falling through to `primary()`.
                if (cmd === '\\text') {
                    const body = this.peekGroup();
                    if (body !== null && (TEXT_OPERATORS[body] !== undefined || body === '\\textbackslash')) {
                        this.group();
                        op = body === '\\textbackslash' ? '\\' : body;
                    } else {
                        this.i = at;
                        break;
                    }
                } else {
                    const mapped = MACRO_OPS[cmd];
                    if (mapped === undefined) {
                    // Not an operator — rewind and let `primary()` handle the macro
                        // (`\frac`, `\sqrt`, `\text`, …).
                        this.i = at;
                        break;
                    }
                    op = mapped;
                }
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

            // `=` and `←` are assignments, so their right side takes everything to its right --
            // `a ← 5` is one assignment, not a product. Matches `parseAssignment` in the
            // Calcpad parser, which is where the emitter's tree comes from.
            const right = op === '=' || op === '←' ? this.juxtaposed() : this.binary(prec + 1);
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
            // `5!` is factorial. MathLive both accepts and emits the bare `!`, but the
            // reader used to drop it, so committing an edited `n = 5!` silently lost it.
            if (this.s[this.i] === '!' && this.s[this.i + 1] !== '=') {
                this.i++;
                node = { type: 'Operator', op: '!', args: [node], form: 'postfix' };
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
            if (cmd === '\\begin') return this.matrixEnvironment();
            // Greek first: `\sigma` must become `σ`, not a variable named `sigma`.
            const greek = greekFromMacro(cmd);
            if (greek !== null) return { type: 'Identifier', sym: greek };
            switch (cmd) {
                case '\\frac': {
                    // Kept as `/` rather than a `Frac` node: MathLive renders `\frac` as a
                    // stacked fraction regardless, and preserving the slash keeps the
                    // author's `w*L^2/8` intact. The `Frac` form is reserved for an
                    // explicit fraction such as one parsed from OMML `<m:f>`.
                    //
                    // Both arguments may arrive without braces once a single digit is typed
                    // (`\frac{1}2` comes back as `\frac12`), so each falls back to one atom.
                    const arg = (): MathJSON => {
                        if (this.s[this.i] === '{') return parseLatex(this.group());
                        // Measured against MathLive: a multi-digit value keeps its braces
                        // (`\frac{12}{3}`, `\frac{1}{2.5}`), so a brace-less argument is
                        // always a *single* digit. `\frac12` is therefore one over the other,
                        // and taking the whole run gave `12 / 0`.
                        if (/[0-9]/.test(this.s[this.i] ?? '')) {
                            const digit = this.s[this.i];
                            this.i++;
                            return { type: 'Number', n: Number(digit), raw: digit };
                        }
                        if (this.s[this.i] === '.') return this.primary();
                        return this.primary();
                    };
                    const num = arg();
                    const den = arg();
                    return { type: 'Operator', op: '/', args: [num, den], form: 'infix' };
                }
                case '\\sqrt': {
                    this.skip();
                    if (this.s[this.i] === '[') {
                        const end = this.s.indexOf(']', this.i);
                        const index = end < 0 ? '' : this.s.slice(this.i + 1, end);
                        this.i = end < 0 ? this.s.length : end + 1;
                        const radicand = this.s[this.i] === '{'
                            ? parseLatex(this.group())
                            : this.primary();
                        return { type: 'Root', index: parseLatex(index), radicand };
                    }
                    // MathLive drops the braces once a single atom is typed into the slot --
                    // `\sqrt{9}` becomes `\sqrt9`. With no group there is still a radicand, so
                    // one factor is read; otherwise the empty group parsed as the number `0`
                    // and the radical came back as `sqrt(0)9`.
                    if (this.s[this.i] === '{') return { type: 'Sqrt', radicand: parseLatex(this.group()) };
                    return { type: 'Sqrt', radicand: this.primary() };
                }
                case '\\text': {
                    const body = this.group();
                    // A Calcpad-only operator carried as upright text (`\text{⦼}`). It binds
                    // to what came before it, so it is read as an infix operator and the
                    // operand is taken by the caller's precedence loop.
                    if (body === '\\textbackslash') return { type: 'Operator', op: '\\', args: [], form: 'infix' };
                    if (TEXT_OPERATORS[body] !== undefined) {
                        return { type: 'Operator', op: body, args: [], form: 'infix' };
                    }
                    // A leading quote marks a label (`QuotedText`), not a unit run.
                    const q = body[0];
                    if (q === "'" || q === '"') {
                        const doubled = q + q;
                        const closed = body.length >= 2 + 1 && body.endsWith(doubled);
                        return {
                            type: 'QuotedText',
                            text: closed ? body.slice(1, -2) : body.slice(1),
                            quote: q,
                            closed,
                        };
                    }
                    return { type: 'Text', text: body, unit: true };
                }
                case '\\mathrm': {
                    // `\_` is TeX's escape for a literal underscore, and a Calcpad name may
                    // end in one (`h_`, `V_Rd_c_`). Reading it back as the escape would
                    // leave a stray backslash in the document, so it is unescaped here.
                    const sym = this.group().replace(/\\_/g, '_');
                    const args = this.callArgs();
                    if (args === null) return { type: 'Identifier', sym };
                    return functionOrSpecial(sym, args);
                }
                case ',': case ';': case ':': case '!':
                    return { type: 'Number', n: 0 };
                // `\placeholder{…}` is MathLive's empty slot, left behind by the insert
                // buttons and by any template the user has not filled in yet. Reading it as
                // an ordinary name wrote a variable literally called `placeholder` into the
                // document -- so it reads as an empty group instead.
                case '\\placeholder': {
                    this.group();
                    return { type: 'Group', body: [] };
                }
                // `\operatorname{abs}(x)` is how MathLive renders any *named* function --
                // `abs`, `min`, `if` and the rest are not built-in LaTeX. Without this the
                // macro name survived as a variable, giving `operatorname abs(x)`.
                case '\\operatorname': {
                    // MathLive nests the name: `\operatorname{\mathrm{if}}`. Either shape
                    // means "a function Calcpad names", not a product of variables.
                    const name = unbracedName(this.group());
                    const args = this.callArgs();
                    if (args !== null) return functionOrSpecial(name, args);
                    // MathLive also drops the parentheses once the arguments are typed out
                    // (`\operatorname{if}1;2;3`). Without this the name became a bare
                    // variable and every argument was left behind in the line.
                    const bare = this.bareArgs();
                    if (bare.length) return functionOrSpecial(name, bare);
                    return { type: 'Identifier', sym: name };
                }
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

        if (LETTER.test(c)) {
            let j = this.i;
            while (j < this.s.length && NAME_CHAR.test(this.s[j])) j++;
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
            // MathLive also writes a grid as `\left[\begin{array}…\end{array}\right]`,
            // which reaches here as a bracketed list holding one matrix. The outer
            // brackets are the matrix's own, so they are not a second pair.
            if (body.length === 1 && body[0].type === 'Matrix') return body[0];
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