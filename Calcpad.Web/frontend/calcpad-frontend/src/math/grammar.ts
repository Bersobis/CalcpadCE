// Calcpad grammar — the single source of truth for operators, precedence and name rules.
//
// Precedence values mirror Calcpad.Core's `Calculator.OperatorOrder` (lower binds tighter),
// with `+`/`-` sharing a level because they are numerically interchangeable either way.
// The tokenizer, parser, printer, caret and palette all read their operator knowledge from
// here, so the "typeable set" and the "parseable set" cannot drift apart again.

export const LEVEL = {
    POWER: 0,
    NEG: 1,
    IMPLICIT: 2,
    MULT: 3,
    ADD: 4,
    REL: 5,
    AND: 6,
    OR: 7,
    PHASOR: 8,
    ASSIGN: 9,
} as const;

export type Assoc = 'left' | 'right';

export interface OpSpec {
    /** Canonical Calcpad spelling. */
    readonly glyph: string;
    /** Lower binds tighter. */
    readonly level: number;
    readonly assoc: Assoc;
    readonly kind: 'binary' | 'prefix' | 'postfix';
    /** Content of the `<mo>` that renders this operator. */
    readonly mo: string;
    /** Whether the rendered operator is surrounded by spacing. */
    readonly spaced: boolean;
    /** Typed sequences that produce this glyph (C-style shortcuts). */
    readonly shortcuts: readonly string[];
}

function op(spec: Partial<OpSpec> & { glyph: string; level: number }): OpSpec {
    return {
        assoc: 'left',
        kind: 'binary',
        mo: spec.glyph,
        spaced: true,
        shortcuts: [],
        ...spec,
    } as OpSpec;
}

/** Every binary/prefix/postfix operator, keyed by its canonical glyph. */
export const OPERATORS: Readonly<Record<string, OpSpec>> = Object.freeze({
    '^': op({ glyph: '^', level: LEVEL.POWER, assoc: 'right', mo: '^', spaced: false }),
    '*': op({ glyph: '*', level: LEVEL.MULT, mo: '*' }),
    '/': op({ glyph: '/', level: LEVEL.MULT, mo: '/', spaced: false }),
    '\u00F7': op({ glyph: '\u00F7', level: LEVEL.MULT, mo: '\u00F7', spaced: false, shortcuts: ['//'] }),
    '\\': op({ glyph: '\\', level: LEVEL.MULT, mo: '\\' }),
    '\u29BC': op({ glyph: '\u29BC', level: LEVEL.MULT, mo: '\u29BC', shortcuts: ['%%'] }),
    '+': op({ glyph: '+', level: LEVEL.ADD, mo: '+' }),
    '-': op({ glyph: '-', level: LEVEL.ADD, mo: '-' }),
    '<': op({ glyph: '<', level: LEVEL.REL, mo: '<' }),
    '>': op({ glyph: '>', level: LEVEL.REL, mo: '>' }),
    '\u2264': op({ glyph: '\u2264', level: LEVEL.REL, mo: '\u2264', shortcuts: ['<='] }),
    '\u2265': op({ glyph: '\u2265', level: LEVEL.REL, mo: '\u2265', shortcuts: ['>='] }),
    '\u2261': op({ glyph: '\u2261', level: LEVEL.REL, mo: '\u2261', shortcuts: ['=='] }),
    '\u2260': op({ glyph: '\u2260', level: LEVEL.REL, mo: '\u2260', shortcuts: ['!='] }),
    '\u2227': op({ glyph: '\u2227', level: LEVEL.AND, mo: '\u2227', shortcuts: ['&&'] }),
    '\u2228': op({ glyph: '\u2228', level: LEVEL.OR, mo: '\u2228', shortcuts: ['||'] }),
    '\u2295': op({ glyph: '\u2295', level: LEVEL.OR, mo: '\u2295', shortcuts: ['^^'] }),
    '\u2220': op({ glyph: '\u2220', level: LEVEL.PHASOR, mo: '\u2220', spaced: false, shortcuts: ['<<'] }),
    '|': op({ glyph: '|', level: LEVEL.ADD, mo: '|', spaced: false }),
    '=': op({ glyph: '=', level: LEVEL.ASSIGN, mo: '=' }),
    '\u2190': op({ glyph: '\u2190', level: LEVEL.ASSIGN, mo: '\u2190', shortcuts: ['<*'] }),
});

/** `!` is a postfix operator, handled by the parser outside the precedence table. */
export const FACTORIAL = '!';

/** Multi-character shortcut sequences, longest first, for the tokenizer. */
export const SHORTCUTS: readonly (readonly [string, string])[] = Object.freeze(
    Object.values(OPERATORS)
        .flatMap((spec) => spec.shortcuts.map((s) => [s, spec.glyph] as const))
        .sort((a, b) => b[0].length - a[0].length)
);

/** True when the glyph is a binary/postfix operator Calcpad can parse. */
export function isOperator(glyph: string): boolean {
    return Object.prototype.hasOwnProperty.call(OPERATORS, glyph);
}

export function opSpec(glyph: string): OpSpec | undefined {
    return OPERATORS[glyph];
}

// ---------------------------------------------------------------------------------------
// Name characters — mirror Calcpad.Core's `Validator`.
// ---------------------------------------------------------------------------------------

const UNIT_SYMBOL_CHARS = '\u00B0\u2032\u2033%\u2030\u2031';
const CURRENCY_CHARS = '\u20AC\u00A3\u20A4\u00A5\u00A2\u20BD\u20B9\u20A9\u20AA';
const VAR_NON_LETTER_CHARS = '\u2127\u2221';
const VAR_SYMBOL_CHARS = ',_\u203E\u2034\u2057\u0301\u0304\u0307\u0308';
const SUPERSCRIPT_CHARS = '\u2070\u00B9\u00B2\u00B3\u2074\u2075\u2076\u2077\u2078\u2079\u207A\u207B\u207C\u207D\u207E';
const SUBSCRIPT_CHARS = '\u2080\u2081\u2082\u2083\u2084\u2085\u2086\u2087\u2088\u2089\u208A\u208B\u208C\u208D\u208E';
const VAR_LETTER_CHARS = '\u03D1\u03D5\u00F8\u00D8';

/** Characters that may start a name but are not Unicode letters. */
const NAME_START_EXTRA = new Set(
    [...UNIT_SYMBOL_CHARS, ...CURRENCY_CHARS, ...VAR_NON_LETTER_CHARS]
);

/** Characters that may appear inside a name but are not Unicode letters. */
const NAME_EXTRA = new Set([
    ...UNIT_SYMBOL_CHARS, ...CURRENCY_CHARS, ...VAR_NON_LETTER_CHARS,
    ...VAR_SYMBOL_CHARS, ...SUPERSCRIPT_CHARS, ...SUBSCRIPT_CHARS, ...VAR_LETTER_CHARS,
]);

const SUPERSCRIPT_MAP: Readonly<Record<string, string>> = Object.freeze({
    '\u2070': '0', '\u00B9': '1', '\u00B2': '2', '\u00B3': '3', '\u2074': '4',
    '\u2075': '5', '\u2076': '6', '\u2077': '7', '\u2078': '8', '\u2079': '9',
    '\u207A': '+', '\u207B': '-', '\u207C': '=', '\u207D': '(', '\u207E': ')',
});

const SUBSCRIPT_MAP: Readonly<Record<string, string>> = Object.freeze({
    '\u2080': '0', '\u2081': '1', '\u2082': '2', '\u2083': '3', '\u2084': '4',
    '\u2085': '5', '\u2086': '6', '\u2087': '7', '\u2088': '8', '\u2089': '9',
    '\u208A': '+', '\u208B': '-', '\u208C': '=', '\u208D': '(', '\u208E': ')',
});

export function isNameStart(ch: string): boolean {
    return /[\p{L}]/u.test(ch) || NAME_START_EXTRA.has(ch);
}

export function isNameChar(ch: string): boolean {
    return /[\p{L}\p{Nd}]/u.test(ch) || NAME_EXTRA.has(ch);
}

export function isDigitChar(ch: string): boolean {
    return ch >= '0' && ch <= '9';
}

export function isSuperscript(ch: string): boolean {
    return ch in SUPERSCRIPT_MAP;
}

export function isSubscript(ch: string): boolean {
    return ch in SUBSCRIPT_MAP;
}

/** Fold Unicode super/subscript digits onto their ASCII form. */
export function normalizeScript(ch: string): string {
    return SUPERSCRIPT_MAP[ch] ?? SUBSCRIPT_MAP[ch] ?? ch;
}

/** Fold the whole string; used to compare `x_1` with `x\u2081`. */
export function normalizeName(name: string): string {
    let out = '';
    for (const ch of name) out += normalizeScript(ch);
    return out;
}

// ---------------------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------------------

export type SpecialFunction = 'sqrt' | 'cbrt' | 'root' | 'abs';

/** Functions that render as a structure rather than an upright name with parentheses. */
export const SPECIAL_FUNCTIONS: Readonly<Record<string, SpecialFunction>> = Object.freeze({
    sqrt: 'sqrt',
    sqr: 'sqrt',
    cbrt: 'cbrt',
    root: 'root',
    abs: 'abs',
});

/**
 * Built-in function names. The set exists so a name that is *called* can be rendered upright
 * like Calcpad does; it is not required for parsing, because a call is just a name plus `(`.
 */
export const BUILTIN_FUNCTIONS: ReadonlySet<string> = new Set([
    'sin', 'cos', 'tan', 'csc', 'sec', 'cot',
    'sinh', 'cosh', 'tanh', 'csch', 'sech', 'coth',
    'asin', 'acos', 'atan', 'atan2', 'acsc', 'asec', 'acot',
    'asinh', 'acosh', 'atanh', 'acsch', 'asech', 'acoth',
    'log', 'ln', 'log_2', 'exp', 'sqr', 'sqrt', 'cbrt', 'root',
    'round', 'floor', 'ceiling', 'trunc', 'mod', 'gcd', 'lcm',
    're', 'im', 'abs', 'phase', 'conj',
    'min', 'max', 'sum', 'sumsq', 'srss', 'average', 'product', 'mean', 'take', 'line', 'spline',
    'if', 'switch', 'not', 'and', 'or', 'xor', 'sign', 'random',
    'getunits', 'setunits', 'clrunits', 'hp', 'ishp',
]);

// ---------------------------------------------------------------------------------------
// Units — used only for upright rendering, never for parsing decisions.
// ---------------------------------------------------------------------------------------

export const UNIT_SYMBOLS: ReadonlySet<string> = new Set([
    'g', 'hg', 'kg', 't', 'kt', 'Mt', 'Gt', 'dg', 'cg', 'mg', '\u03BCg', 'Da', 'u',
    'm', 'km', 'dm', 'cm', 'mm', '\u03BCm', 'nm', 'pm', 'AU', 'ly',
    's', 'ms', '\u03BCs', 'ns', 'ps', 'min', 'h', 'd', 'w', 'y',
    'Hz', 'kHz', 'MHz', 'GHz', 'THz', 'mHz', '\u03BCHz', 'nHz', 'pHz', 'rpm', 'kmh',
    'A', 'kA', 'MA', 'GA', 'TA', 'mA', '\u03BCA', 'nA', 'pA',
    '\u00B0C', '\u0394\u00B0C', 'K', 'mol', 'cd', 'a', 'daa', 'ha',
    'L', 'daL', 'hL', 'dL', 'cL', 'mL', '\u03BCL', 'nL', 'pL',
    'N', 'daN', 'hN', 'kN', 'MN', 'GN', 'TN', 'gf', 'kgf', 'tf', 'dyn',
    'Nm', 'kNm',
    'Pa', 'daPa', 'hPa', 'kPa', 'MPa', 'GPa', 'TPa', 'dPa', 'cPa', 'mPa', '\u03BCPa',
    'nPa', 'pPa', 'bar', 'mbar', '\u03BCbar', 'atm', 'at', 'Torr', 'mmHg',
    'P', 'cP', 'St', 'cSt',
    'J', 'kJ', 'MJ', 'GJ', 'TJ', 'mJ', '\u03BCJ', 'nJ', 'pJ',
    'Wh', 'kWh', 'MWh', 'GWh', 'TWh', 'mWh', '\u03BCWh', 'nWh', 'pWh',
    'eV', 'keV', 'MeV', 'GeV', 'TeV', 'PeV', 'EeV', 'cal', 'kcal', 'erg',
    'W', 'kW', 'MW', 'GW', 'TW', 'mW', '\u03BCW', 'nW', 'pW', 'hpM', 'ks',
    'VA', 'kVA', 'MVA', 'GVA', 'TVA', 'mVA', '\u03BCVA', 'nVA', 'pVA',
    'VAR', 'kVAR', 'MVAR', 'GVAR', 'TVAR', 'mVAR', '\u03BCVAR', 'nVAR', 'pVAR',
    'C', 'kC', 'MC', 'GC', 'TC', 'mC', '\u03BCC', 'nC', 'pC', 'Ah', 'mAh',
    'V', 'kV', 'MV', 'GV', 'TV', 'mV', '\u03BCV', 'nV', 'pV',
    'F', 'kF', 'MF', 'GF', 'TF', 'mF', '\u03BCF', 'nF', 'pF',
    '\u03A9', 'k\u03A9', 'M\u03A9', 'G\u03A9', 'T\u03A9', 'm\u03A9', '\u03BC\u03A9', 'n\u03A9', 'p\u03A9',
    'S', 'kS', 'MS', 'GS', 'TS', 'mS', '\u03BCS', 'nS', 'pS', '\u2127', 'k\u2127', 'M\u2127', 'G\u2127', 'T\u2127', 'm\u2127', '\u03BC\u2127', 'n\u2127', 'p\u2127',
    'Wb', 'kWb', 'MWb', 'GWb', 'TWb', 'mWb', '\u03BCWb', 'nWb', 'pWb',
    'T', 'kT', 'MT', 'GT', 'TT', 'mT', '\u03BCT', 'nT', 'pT',
    'H', 'kH', 'MH', 'GH', 'TH', 'mH', '\u03BCH', 'nH', 'pH',
    'lm', 'lx', 'Bq', 'kBq', 'MBq', 'GBq', 'TBq', 'mBq', '\u03BCBq', 'nBq', 'pBq', 'Ci', 'Rd',
    'Gy', 'kGy', 'MGy', 'GGy', 'TGy', 'mGy', '\u03BCGy', 'nGy', 'pGy',
    'Sv', 'kSv', 'MSv', 'GSv', 'TSv', 'mSv', '\u03BCSv', 'nSv', 'pSv', 'kat',
    'gr', 'dr', 'oz', 'lb', 'lbm', 'kipm', 'st', 'qr', 'cwt', 'ton', 'slug',
    'th', 'in', 'ft', 'yd', 'ch', 'fur', 'mi', 'ftm', 'cable', 'nmi', 'li', 'rod', 'pole', 'perch', 'lea',
    'mph', 'knot', '\u00B0F', '\u0394\u00B0F', '\u00B0R', 'rood', 'ac',
    'fl_oz', 'gi', 'pt', 'qt', 'gal', 'bbl', 'pt_dry', 'qt_dry', 'gal_dry', 'bbl_dry', 'pk', 'bu',
    'ozf', 'lbf', 'kip', 'tonf', 'pdl', 'osi', 'osf', 'psi', 'psf', 'ksi', 'ksf', 'tsi', 'tsf', 'inHg',
    'BTU', 'therm', 'quad', 'hp', 'hpE', 'hpS',
    '%', '\u2030', '\u2031', 'pcm', 'ppm', 'ppb', 'ppt', 'ppq',
    '\u00B0', '\u2032', '\u2033', 'deg', 'rad', 'grad', 'rev',
    '\u20AC', '\u00A3', '\u20A4', '\u00A5', '\u00A2', '\u20BD', '\u20B9', '\u20A9', '\u20AA',
]);

export function isUnitName(name: string): boolean {
    return UNIT_SYMBOLS.has(name);
}
