/**
 * Constructs documented in `docs/quick-reference.md`, used by both
 * `scripts/doc-syntax-audit.mts` and `tests/docSyntax.test.ts`.
 */

export interface DocSyntaxCase { group: string; syntax: string }

const SUB: Record<string, string> = {
    '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4',
    '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
};

/** Same folds the corpus gate uses, so only real losses are reported. */
export function normalizeDocSyntax(s: string): string {
    return s
        .replace(/\s+/g, '')
        // The doc lists an ASCII spelling beside each operator glyph; the printer emits the
        // glyph, so the two are the same operator and must compare equal. Longest first:
        // `<*` must not be read as `<`, nor `//` as `/`.
        .replace(/==/g, '≡').replace(/!=/g, '≠')
        .replace(/<=/g, '≤').replace(/>=/g, '≥')
        .replace(/&&/g, '∧').replace(/\|\|/g, '∨').replace(/\^\^/g, '⊕')
        .replace(/%%/g, '⦼').replace(/\/\//g, '÷')
        .replace(/<</g, '∠').replace(/<\*/g, '←')
        .replace(/·/g, '*')
        .replace(/∕/g, '/')
        .replace(/\bsqr\(/g, 'sqrt(')
        .replace(/\bcbrt\((\s*[^;,]*?)\s*\)/g, 'root($1;3)')
        .replace(/([\p{L}\p{N}])[₀-₉₊₋₌₍₎]+/gu, (m, base: string) => `${base}_${[...m.slice(1)].map((c) => SUB[c] ?? c).join('')}`)
        .replace(/÷/g, '/')
        .replace(/\s*⦼\s*/g, '⦼')
        .replace(/\s*\\\s*/g, '\\')
        .replace(/\(([^()]*∠[^()]*)\)/g, '$1');
}

/**
 * Operators as MathLive rewrites them once the user has *typed* in the canvas: it
 * canonicalises every glyph to a macro, so a commit arrives here rather than through the
 * `\text{}` form the emitter writes. A macro missing from `MACRO_OPS` reads back as a
 * variable of that name -- `a ⊕ b` silently became `a oplus b`.
 */
const MATHLIVE_MACRO_CASES: DocSyntaxCase[] = [
    { group: 'mathlive-macros', syntax: 'a\\le b' },
    { group: 'mathlive-macros', syntax: 'a\\ge b' },
    { group: 'mathlive-macros', syntax: 'a\\ne b' },
    { group: 'mathlive-macros', syntax: 'a\\equiv b' },
    { group: 'mathlive-macros', syntax: 'a\\land b' },
    { group: 'mathlive-macros', syntax: 'a\\lor b' },
    { group: 'mathlive-macros', syntax: 'a\\oplus b' },
    { group: 'mathlive-macros', syntax: 'A\\angle 45' },
    { group: 'mathlive-macros', syntax: 'a\\times b' },
    { group: 'mathlive-macros', syntax: 'a\\div b' },
    { group: 'mathlive-macros', syntax: 'a\\land b\\lor c' },
    { group: 'mathlive-macros', syntax: 'a\\le b\\land c \\ne d' },
    { group: 'mathlive-macros', syntax: 'a\\oplus b\\land c' },
];

export const DOC_SYNTAX_CASES: DocSyntaxCase[] = [
    { group: 'numbers', syntax: '3.14159' },
    { group: 'numbers', syntax: '1.5e-3' },
    { group: 'complex', syntax: '3 - 2i' },

    // -- vectors and matrices -----------------------------------------------
    { group: 'vector', syntax: '[v_1; v_2; v_3]' },
    { group: 'matrix', syntax: '[M_11; M_12 | M_21; M_22]' },
    { group: 'matrix', syntax: '[1; 2 | 3; 4]' },

    // -- variable names (doc: primes, superscripts, subscripts) --------------
    { group: 'names', syntax: 'x′' },
    { group: 'names', syntax: 'x″' },
    { group: 'names', syntax: 'x‴' },
    { group: 'names', syntax: 'x⁗' },
    { group: 'names', syntax: 'x‾' },
    { group: 'names', syntax: 'xø' },
    { group: 'names', syntax: 'xØ' },
    { group: 'names', syntax: 'x∡' },
    { group: 'names', syntax: 'x₀' },
    { group: 'names', syntax: 'x₊' },
    { group: 'names', syntax: 'x₋' },
    { group: 'names', syntax: 'x₌' },
    { group: 'names', syntax: 'x₍' },
    { group: 'names', syntax: 'x₎' },
    { group: 'names', syntax: 'x_1' },

    // -- operators (doc: Operators block) -----------------------------------
    { group: 'operators', syntax: 'n!' },
    { group: 'operators', syntax: 'x^2' },
    { group: 'operators', syntax: 'a/b' },
    { group: 'operators', syntax: 'a ÷ b' },
    { group: 'operators', syntax: 'a \\ b' },
    { group: 'operators', syntax: 'a ⦼ b' },
    { group: 'operators', syntax: 'a*b' },
    { group: 'operators', syntax: 'a + b' },
    { group: 'operators', syntax: 'a ≡ b' },
    { group: 'operators', syntax: 'a ≠ b' },
    { group: 'operators', syntax: 'a < b' },
    { group: 'operators', syntax: 'a > b' },
    { group: 'operators', syntax: 'a ≤ b' },
    { group: 'operators', syntax: 'a ≥ b' },
    { group: 'operators', syntax: 'a ∧ b' },
    { group: 'operators', syntax: 'a ∨ b' },
    { group: 'operators', syntax: 'a ⊕ b' },
    { group: 'operators', syntax: 'a = 5' },{ group: 'operators', syntax: 'A← 5' },
    { group: 'operators', syntax: 'A∠45' },

    // -- ASCII spellings the doc lists beside each glyph ---------------------
    { group: 'operators-ascii', syntax: 'a == b' },
    { group: 'operators-ascii', syntax: 'a != b' },
    { group: 'operators-ascii', syntax: 'a <= b' },
    { group: 'operators-ascii', syntax: 'a >= b' },
    { group: 'operators-ascii', syntax: 'a && b' },
    { group: 'operators-ascii', syntax: 'a || b' },
    { group: 'operators-ascii', syntax: 'a ^^ b' },
    { group: 'operators-ascii', syntax: 'a %% b' },
    { group: 'operators-ascii', syntax: 'a // b' },
    { group: 'operators-ascii', syntax: 'A << φ' },
    { group: 'operators-ascii', syntax: 'A <* 5' },

    // -- chained operators: a looser operator may not swallow a tighter one ----
    { group: 'operators', syntax: 'a ≡ b ∧ a ≠ b' },
    { group: 'operators', syntax: 'a ∧ b ∨ c ⊕ d' },
    { group: 'operators', syntax: 'a + b ∧ c' },
    { group: 'operators', syntax: 'a ∧ b + c' },
    { group: 'operators', syntax: 'a + b ⦼ c' },
    { group: 'operators', syntax: 'a ≡ b ∧ c ∨ d' },

    // -- trigonometric ------------------------------------------------------
    { group: 'trig', syntax: 'sin(x)' },
    { group: 'trig', syntax: 'csc(x)' },
    { group: 'trig', syntax: 'sinh(x)' },
    { group: 'trig', syntax: 'csch(x)' },
    { group: 'trig', syntax: 'asinh(x)' },
    { group: 'trig', syntax: 'atan2(x; y)' },
    { group: 'trig', syntax: 'acoth(x)' },

    // -- logarithmic, exponential, roots ------------------------------------
    { group: 'roots', syntax: 'log_2(x)' },
    { group: 'roots', syntax: 'exp(x)' },
    { group: 'roots', syntax: 'sqr(x)' },
    { group: 'roots', syntax: 'sqrt(x)' },
    { group: 'roots', syntax: 'cbrt(x)' },
    { group: 'roots', syntax: 'root(x; 3)' },

    // -- rounding / integer / complex ---------------------------------------
    { group: 'functions', syntax: 'ceiling(x)' },
    { group: 'functions', syntax: 'trunc(x)' },
    { group: 'functions', syntax: 'mod(x; y)' },
    { group: 'functions', syntax: 'gcd(x; y; z)' },
    { group: 'functions', syntax: 'lcm(x; y; z)' },
    { group: 'functions', syntax: 're(z)' },
    { group: 'functions', syntax: 'im(z)' },
    { group: 'functions', syntax: 'phase(z)' },
    { group: 'functions', syntax: 'conj(z)' },

    // -- aggregate / interpolation ------------------------------------------
    { group: 'functions', syntax: 'sumsq(A; b; c)' },
    { group: 'functions', syntax: 'srss(A; b; c)' },
    { group: 'functions', syntax: 'average(A; b; c)' },
    { group: 'functions', syntax: 'product(A; b; c)' },
    { group: 'functions', syntax: 'mean(A; b; c)' },
    { group: 'functions', syntax: 'take(n; A; b; c)' },
    { group: 'functions', syntax: 'line(x; A; b; c)' },
    { group: 'functions', syntax: 'spline(x; A; b; c)' },

    // -- conditional / logical ----------------------------------------------
    { group: 'functions', syntax: 'if(cond; t; f)' },
    { group: 'functions', syntax: 'switch(c1; v1; c2; v2; d)' },
    { group: 'functions', syntax: 'not(x)' },
    { group: 'functions', syntax: 'and(A; b; c)' },
    { group: 'functions', syntax: 'or(A; b; c)' },
    { group: 'functions', syntax: 'xor(A; b; c)' },

    // -- other --------------------------------------------------------------
    { group: 'functions', syntax: 'sign(x)' },
    { group: 'functions', syntax: 'getunits(x)' },
    { group: 'functions', syntax: 'setunits(x; m)' },
    { group: 'functions', syntax: 'clrunits(x)' },
    { group: 'functions', syntax: 'hp(x)' },
    { group: 'functions', syntax: 'ishp(x)' },

    // -- vector functions ---------------------------------------------------
    { group: 'vector-fns', syntax: 'vector(n)' },
    { group: 'vector-fns', syntax: 'vector_hp(n)' },
    { group: 'vector-fns', syntax: 'range(x1; xn; s)' },
    { group: 'vector-fns', syntax: 'range_hp(x1; xn; s)' },
    { group: 'vector-fns', syntax: 'len(v)' },
    { group: 'vector-fns', syntax: 'size(v)' },
    { group: 'vector-fns', syntax: 'resize(v; n)' },
    { group: 'vector-fns', syntax: 'fill(v; x)' },
    { group: 'vector-fns', syntax: 'join(A; b; c)' },
    { group: 'vector-fns', syntax: 'slice(v; i1; i2)' },
    { group: 'vector-fns', syntax: 'first(v; n)' },
    { group: 'vector-fns', syntax: 'last(v; n)' },
    { group: 'vector-fns', syntax: 'extract(v; i)' },
    { group: 'vector-fns', syntax: 'rsort(v)' },
    { group: 'vector-fns', syntax: 'order(v)' },
    { group: 'vector-fns', syntax: 'revorder(v)' },
    { group: 'vector-fns', syntax: 'reverse(v)' },
    { group: 'vector-fns', syntax: 'count(v; x; i)' },
    { group: 'vector-fns', syntax: 'search(v; x; i)' },
    { group: 'vector-fns', syntax: 'find(v; x; i)' },
    { group: 'vector-fns', syntax: 'find_eq(v; x; i)' },
    { group: 'vector-fns', syntax: 'find_ne(v; x; i)' },
    { group: 'vector-fns', syntax: 'find_lt(v; x; i)' },
    { group: 'vector-fns', syntax: 'find_le(v; x; i)' },
    { group: 'vector-fns', syntax: 'find_gt(v; x; i)' },
    { group: 'vector-fns', syntax: 'find_ge(v; x; i)' },
    { group: 'vector-fns', syntax: 'lookup(a; b; x)' },
    { group: 'vector-fns', syntax: 'lookup_eq(a; b; x)' },
    { group: 'vector-fns', syntax: 'lookup_ge(a; b; x)' },
    { group: 'vector-fns', syntax: 'norm_1(v)' },
    { group: 'vector-fns', syntax: 'norm(v)' },
    { group: 'vector-fns', syntax: 'norm_2(v)' },
    { group: 'vector-fns', syntax: 'norm_e(v)' },
    { group: 'vector-fns', syntax: 'norm_p(v; p)' },
    { group: 'vector-fns', syntax: 'norm_i(v)' },
    { group: 'vector-fns', syntax: 'unit(v)' },
    { group: 'vector-fns', syntax: 'dot(a; b)' },
    { group: 'vector-fns', syntax: 'cross(a; b)' },

    // -- matrix functions ---------------------------------------------------
    { group: 'matrix-fns', syntax: 'matrix(m; n)' },
    { group: 'matrix-fns', syntax: 'identity(n)' },
    { group: 'matrix-fns', syntax: 'diagonal(n; d)' },
    { group: 'matrix-fns', syntax: 'column(m; c)' },
    { group: 'matrix-fns', syntax: 'utriang(n)' },
    { group: 'matrix-fns', syntax: 'ltriang(n)' },
    { group: 'matrix-fns', syntax: 'symmetric(n)' },
    { group: 'matrix-fns', syntax: 'matrix_hp(m; n)' },
    { group: 'matrix-fns', syntax: 'identity_hp(n)' },
    { group: 'matrix-fns', syntax: 'diagonal_hp(n; d)' },
    { group: 'matrix-fns', syntax: 'column_hp(m; c)' },
    { group: 'matrix-fns', syntax: 'utriang_hp(n)' },
    { group: 'matrix-fns', syntax: 'ltriang_hp(n)' },
    { group: 'matrix-fns', syntax: 'symmetric_hp(n)' },
    { group: 'matrix-fns', syntax: 'vec2diag(v)' },
    { group: 'matrix-fns', syntax: 'vec2row(v)' },
    { group: 'matrix-fns', syntax: 'vec2col(v)' },
    { group: 'matrix-fns', syntax: 'join_cols(c1; c2)' },
    { group: 'matrix-fns', syntax: 'join_rows(r1; r2)' },
    { group: 'matrix-fns', syntax: 'augment(A; B)' },
    { group: 'matrix-fns', syntax: 'stack(A; B)' },
    { group: 'matrix-fns', syntax: 'n_rows(M)' },
    { group: 'matrix-fns', syntax: 'n_cols(M)' },
    { group: 'matrix-fns', syntax: 'resize(M; m; n)' },
    { group: 'matrix-fns', syntax: 'fill_row(M; i; x)' },
    { group: 'matrix-fns', syntax: 'fill_col(M; j; x)' },
    { group: 'matrix-fns', syntax: 'copy(A; B; i; j)' },
    { group: 'matrix-fns', syntax: 'add(A; B; i; j)' },
    { group: 'matrix-fns', syntax: 'row(M; i)' },
    { group: 'matrix-fns', syntax: 'col(M; j)' },
    { group: 'matrix-fns', syntax: 'extract_rows(M; i)' },
    { group: 'matrix-fns', syntax: 'extract_cols(M; j)' },
    { group: 'matrix-fns', syntax: 'diag2vec(M)' },
    { group: 'matrix-fns', syntax: 'submatrix(M; i1; i2; j1; j2)' },
    { group: 'matrix-fns', syntax: 'sort_cols(M; i)' },
    { group: 'matrix-fns', syntax: 'rsort_cols(M; i)' },
    { group: 'matrix-fns', syntax: 'sort_rows(M; j)' },
    { group: 'matrix-fns', syntax: 'rsort_rows(M; j)' },
    { group: 'matrix-fns', syntax: 'order_cols(M; i)' },
    { group: 'matrix-fns', syntax: 'revorder_cols(M; i)' },
    { group: 'matrix-fns', syntax: 'order_rows(M; j)' },
    { group: 'matrix-fns', syntax: 'revorder_rows(M; j)' },
    { group: 'matrix-fns', syntax: 'mcount(M; x)' },
    { group: 'matrix-fns', syntax: 'msearch(M; x; i; j)' },
    { group: 'matrix-fns', syntax: 'mfind(M; x)' },
    { group: 'matrix-fns', syntax: 'mfind_ge(M; x)' },
    { group: 'matrix-fns', syntax: 'hlookup(M; x; i1; i2)' },
    { group: 'matrix-fns', syntax: 'hlookup_ge(M; x; i1; i2)' },
    { group: 'matrix-fns', syntax: 'vlookup(M; x; j1; j2)' },
    { group: 'matrix-fns', syntax: 'vlookup_ge(M; x; j1; j2)' },
    { group: 'matrix-fns', syntax: 'hprod(A; B)' },
    { group: 'matrix-fns', syntax: 'fprod(A; B)' },
    { group: 'matrix-fns', syntax: 'kprod(A; B)' },
    { group: 'matrix-fns', syntax: 'mnorm(M)' },
    { group: 'matrix-fns', syntax: 'mnorm_2(M)' },
    { group: 'matrix-fns', syntax: 'mnorm_1(M)' },
    { group: 'matrix-fns', syntax: 'mnorm_i(M)' },
    { group: 'matrix-fns', syntax: 'cond(M)' },
    { group: 'matrix-fns', syntax: 'cond_e(M)' },
    { group: 'matrix-fns', syntax: 'cond_1(M)' },
    { group: 'matrix-fns', syntax: 'cond_2(M)' },
    { group: 'matrix-fns', syntax: 'cond_i(M)' },
    { group: 'matrix-fns', syntax: 'det(M)' },
    { group: 'matrix-fns', syntax: 'rank(M)' },
    { group: 'matrix-fns', syntax: 'trace(M)' },
    { group: 'matrix-fns', syntax: 'transp(M)' },
    { group: 'matrix-fns', syntax: 'adj(M)' },
    { group: 'matrix-fns', syntax: 'cofactor(M)' },
    { group: 'matrix-fns', syntax: 'eigenvals(M; n)' },
    { group: 'matrix-fns', syntax: 'eigenvecs(M; n)' },
    { group: 'matrix-fns', syntax: 'eigen(M; n)' },
    { group: 'matrix-fns', syntax: 'cholesky(M)' },
    { group: 'matrix-fns', syntax: 'lu(M)' },
    { group: 'matrix-fns', syntax: 'qr(M)' },
    { group: 'matrix-fns', syntax: 'svd(M)' },
    { group: 'matrix-fns', syntax: 'inverse(M)' },
    { group: 'matrix-fns', syntax: 'lsolve(A; b)' },
    { group: 'matrix-fns', syntax: 'clsolve(A; b)' },
    { group: 'matrix-fns', syntax: 'slsolve(A; b)' },
    { group: 'matrix-fns', syntax: 'msolve(A; B)' },
    { group: 'matrix-fns', syntax: 'cmsolve(A; B)' },
    { group: 'matrix-fns', syntax: 'smsolve(A; B)' },
    { group: 'matrix-fns', syntax: 'matmul(A; B)' },
    { group: 'matrix-fns', syntax: 'fft(M)' },
    { group: 'matrix-fns', syntax: 'ift(M)' },
    { group: 'matrix-fns', syntax: 'take(x; y; M)' },
    { group: 'matrix-fns', syntax: 'line(x; y; M)' },
    { group: 'matrix-fns', syntax: 'spline(x; y; M)' },

    // -- custom functions and constants -------------------------------------
    { group: 'functions', syntax: 'f(x; y; z)' },
    { group: 'functions', syntax: 'π' },
    { group: 'functions', syntax: 'γ_c' },
    { group: 'functions', syntax: 'μ_0' },
    { group: 'functions', syntax: 'ε_0' },
    { group: 'functions', syntax: 'k_e' },
    { group: 'functions', syntax: 'N_A' },
    { group: 'functions', syntax: 'k_B' },

    // -- units --------------------------------------------------------------
    { group: 'units', syntax: 'L = 12.3cm | mm' },
    { group: 'units', syntax: '50 m' },
    { group: 'units', syntax: '9.81 m/s^2' },
    { group: 'units', syntax: '25 °C' },
    { group: 'units', syntax: '1.5 kN' },
    { group: 'units', syntax: '3 mg/μL' },
    { group: 'units', syntax: '5 N·m' },
    { group: 'units', syntax: '2 hp' },
    { group: 'units', syntax: '1 lbf' },
    { group: 'units', syntax: '4 fl_oz' },
    { group: 'units', syntax: '6 atm' },
    { group: 'units', syntax: '7 deg' },
    { group: 'units', syntax: '8 grad' },
    { group: 'units', syntax: '9 rev' },
    { group: 'units', syntax: '10 mmHg' },
    { group: 'units', syntax: '11 inHg' },
    { group: 'units', syntax: '12 ksi' },
    { group: 'units', syntax: '13 Bq' },
    { group: 'units', syntax: '14 Gy' },
    { group: 'units', syntax: '15 Sv' },
    { group: 'units', syntax: '16 kat' },
    { group: 'units', syntax: '17 BTU' },
    { group: 'units', syntax: '18 therm' },
    { group: 'units', syntax: '19 quad' },
    { group: 'units', syntax: '20 slug' },
    { group: 'units', syntax: '21 cwt' },
    { group: 'units', syntax: '22 ton' },
    { group: 'units', syntax: '23 knot' },
    { group: 'units', syntax: '24 mph' },
    { group: 'units', syntax: '25 mAh' },
    { group: 'units', syntax: '26 var' },
    { group: 'units', syntax: '27 lm' },
    { group: 'units', syntax: '28 lx' },
    { group: 'units', syntax: '29 rood' },
    { group: 'units', syntax: '30 ac' },
    { group: 'units', syntax: '31 Da' },
    { group: 'units', syntax: '32 Δ°C' },

    // -- punctuation / statements -------------------------------------------
    { group: 'statements', syntax: 'x = 1; y = 2' },
    { group: 'statements', syntax: 'A = 0.01m^2' },

    ...MATHLIVE_MACRO_CASES,
];