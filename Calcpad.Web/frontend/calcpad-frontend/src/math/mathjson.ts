/**
 * The MathJSON dialect exchanged by this module. Node names follow the
 * Shorthand/MathLive conventions; `normalize` also accepts the generic Shorthand
 * spellings below, so the OMML writer has one shape per construct to handle.
 *
 * | Structure | Canonical node | Also accepted | OMML |
 * | --- | --- | --- | --- |
 * | fraction | `Frac` | `Operator` `/`, `÷` | `<m:f>` |
 * | square rt | `Sqrt` | `Root` without `index`, `Operator` `√` | `<m:rad>` degHide |
 * | n-th root | `Root` | `Operator` `root` | `<m:rad><m:deg>` |
 * | power | `Sup` | `Operator` `^` | `<m:sSup>` |
 * | subscript | `Sub` | `Operator` `_` | `<m:sSub>` |
 * | group | `Group` | `Operator` `(` | `<m:d>` |
 */

export interface MathJSONBase {
    /** Optional MathLive latex hint; ignored when absent. */
    latex?: string;
    /** Source span in the originating Calcpad script, when known. */
    source?: [number, number];
}

export interface MathNumber extends MathJSONBase {
    type: 'Number';
    n: number;
    /**
     * The literal as written, e.g. `0.00000` or `1.5E-3`. Printed in preference to `n`
     * whenever it still denotes the same value, so a user's chosen precision and the
     * exponent form survive a round-trip. Ignored once the value is changed, as it is by
     * negation.
     */
    raw?: string;
}

export interface MathIdentifier extends MathJSONBase {
    type: 'Identifier';
    sym: string;
}

/** Verbatim text. Rendered upright; unit runs carry `m:sty m:val="p"`. */
export interface MathText extends MathJSONBase {
    type: 'Text';
    text: string;
    /** Render upright with unit styling (`<m:sty m:val="p"/>`). */
    unit?: boolean;
}

export interface MathOperator extends MathJSONBase {
    type: 'Operator';
    op: string;
    args: MathJSON[];
    form?: 'prefix' | 'infix' | 'postfix';
    /** True for Calcpad's signless multiplication, `2x`. The printer omits the sign. */
    implicit?: boolean;
}

export interface MathGroup extends MathJSONBase {
    type: 'Group';
    body: MathJSON[];
}

export interface MathFrac extends MathJSONBase {
    type: 'Frac';
    num: MathJSON;
    den: MathJSON;
}

export interface MathSqrt extends MathJSONBase {
    type: 'Sqrt';
    radicand: MathJSON;
}

export interface MathRoot extends MathJSONBase {
    type: 'Root';
    radicand: MathJSON;
    /** Omitted means the square root. */
    index?: MathJSON;
}

export interface MathSup extends MathJSONBase {
    type: 'Sup';
    base: MathJSON;
    sup: MathJSON;
}

export interface MathSub extends MathJSONBase {
    type: 'Sub';
    base: MathJSON;
    sub: MathJSON;
}

/** Explicit delimiters, e.g. `[a; b]` or `|x|`. Defaults to parentheses. */
export interface MathDelimited extends MathJSONBase {
    type: 'Delimited';
    body: MathJSON[];
    left?: string;
    right?: string;
}

/**
 * A matrix literal, `[a; b | c; d]`. Calcpad's own lexer treats `|` inside `[...]` as a
 * row divider and never as a unit target (`MathParser.Input.cs`, `TokenTypes.RowDivisor`),
 * so the two uses of `|` cannot collide: the unit target only occurs outside brackets.
 * A single-row `[a; b]` stays a `Delimited` vector.
 */
export interface MathMatrix extends MathJSONBase {
    type: 'Matrix';
    rows: MathJSON[][];
    left?: string;
    right?: string;
}

/** A unit expression; every text run inside is emitted as an upright styled run. */
export interface MathUnits extends MathJSONBase {
    type: 'Units';
    body: MathJSON[];
}

export interface MathFunction extends MathJSONBase {
    type: 'Function';
    fn: string;
    args: MathJSON[];
    /** Present when the function name carries a subscript, as in `q_n(n)`. */
    subscript?: MathJSON;
}

/**
 * Several Calcpad statements on one physical line, e.g. `x = 1; y = 2`. The separators
 * are kept verbatim so the line re-serializes byte-for-byte; the canvas renders each
 * statement as its own equation region.
 */
export interface MathStatements extends MathJSONBase {
    type: 'Statements';
    body: MathJSON[];
    /** The literal `;` / `,` between consecutive statements. */
    seps: string[];
    /** A separator left dangling at the end of the line. */
    trailing?: string;
}

/**
 * A `'`- or `"`-delimited literal, which is what Calcpad's tokenizer produces for a
 * quoted run (`ExpressionParser.GetTokens` emits `TokenTypes.Text`). It is not a
 * comment: `1' - for |Mx|` is a user-entered value carrying a label, and
 * `k_2(n)' => 'A_1(m; n)` is the label ` => `. The delimiters are part of the syntax,
 * so they are stored separately and reprinted verbatim.
 */
export interface MathQuotedText extends MathJSONBase {
    type: 'QuotedText';
    /** The text between the delimiters. */
    text: string;
    /** The opening delimiter, which also closes the literal. */
    quote: string;
    /**
     * False when the literal ran to the end of the line without a closing delimiter,
     * which Calcpad allows (`A_s = 84'`). The node reprints it unclosed.
     */
    closed?: boolean;
}

/** Calcpad's `x.1`: the index of a vector, matrix or array element. */
export interface MathIndex extends MathJSONBase {
    type: 'Index';
    base: MathJSON;
    index: MathJSON;
}

export type MathJSON =
    | MathNumber
    | MathIdentifier
    | MathText
    | MathOperator
    | MathGroup
    | MathFrac
    | MathSqrt
    | MathRoot
    | MathSup
    | MathSub
    | MathDelimited
    | MathMatrix
    | MathUnits
    | MathStatements
    | MathFunction
    | MathQuotedText
    | MathIndex;

/** Narrowing helper; `node.type` alone is enough but this reads better at call sites. */
export function isOperator(n: MathJSON, ...ops: string[]): n is MathOperator {
    return n.type === 'Operator' && (ops.length === 0 || ops.includes(n.op));
}

/** Flattens a node to the MathJSON[] it contributes as a sequence. */
export function childrenOf(node: MathJSON): MathJSON[] {
    switch (node.type) {
        case 'Operator':
        case 'Function':
            return node.args;
        case 'Group':
        case 'Delimited':
        case 'Units':
        case 'Statements':
            return node.body;
        case 'Matrix':
            return node.rows.flat();
        default:
            return [];
    }
}

/**
 * Resolves the Shorthand spellings listed in the table above into the canonical node
 * set, so the OMML writer only has to handle one shape per construct.
 */
export function normalize(node: MathJSON): MathJSON {
    if (node.type !== 'Operator') return node;

    const { op, args } = node;
    if (args.length === 2) {
        if (op === '/' || op === '÷') {
            return { type: 'Frac', num: normalize(args[0]), den: normalize(args[1]) };
        }
        if (op === '^') return { type: 'Sup', base: normalize(args[0]), sup: normalize(args[1]) };
        if (op === '_') return { type: 'Sub', base: normalize(args[0]), sub: normalize(args[1]) };
        if (op === '√' || op === 'root') {
            if (op === '√') return { type: 'Sqrt', radicand: normalize(args[0]) };
            const [radicand, index] = args;
            return { type: 'Root', radicand: normalize(radicand), index: normalize(index) };
        }
    }
    if (args.length === 1) {
        if (op === '(') return { type: 'Group', body: args.map(normalize) };
        if (op === '√') return { type: 'Sqrt', radicand: normalize(args[0]) };
    }
    return { ...node, args: args.map(normalize) };
}

/**
 * How a number is spelled in Calcpad source, shared by the Calcpad and LaTeX printers so
 * the two can never disagree about what `Infinity` is. Takes the node, not the value, so
 * the author's literal form is available to both.
 */
export function formatNumberAsCalcpad(node: MathNumber): string {
    const { n } = node;
    if (!Number.isFinite(n)) return Number.isNaN(n) ? 'Undefined' : n > 0 ? '∞' : '-∞';
    if (node.raw !== undefined) {
        const parsed = Number(node.raw);
        // `===` cannot tell 0 from -0, so it is Object.is that decides. Without this a
        // negated `-0.00000` would be accepted as `0.00000` and lose its sign.
        if (Object.is(parsed, n) || parsed === n) return node.raw;
    }
    return Object.is(n, -0) ? '0' : String(n);
}