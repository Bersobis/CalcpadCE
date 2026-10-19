// The Calcpad syntax catalog.
//
// One typed list of everything the editor can put into an expression: structures, operators,
// functions, Greek letters and symbols, grouped into sections. Operators and functions are
// *generated* from `grammar.ts`, so a glyph the parser accepts cannot miss a button — the
// hand-written row this replaces offered 14 of 21 operators and none of the 69 functions.

import { Anchor } from './caret';
import { BUILTIN_FUNCTIONS, OPERATORS } from './grammar';
import { applyCharacter, insertCall, insertStructure, InsertResult, STRUCTURES, StructureId } from './insert';
import { MathNode } from './model';

export type PaletteSectionId =
    | 'structures' | 'operators'
    | 'trigonometric' | 'hyperbolic' | 'inverse' | 'logarithmic'
    | 'rounding' | 'complex' | 'aggregate' | 'logic'
    | 'greek' | 'symbols';

export interface PaletteEntry {
    readonly id: string;
    /** What the button shows. */
    readonly label: string;
    readonly section: PaletteSectionId;
    readonly kind: 'structure' | 'call' | 'char' | 'dialog';
    /** Calcpad source the button writes; `§` is where the caret goes (tooltip and search). */
    readonly insert: string;
    readonly title: string;
    readonly keywords: readonly string[];
    readonly structure?: StructureId;
    /** Callee of a `call` entry. */
    readonly name?: string;
    /** Shape of a `matrix` entry the dialog asks for. */
    readonly rows?: number;
    readonly cols?: number;
}

export interface PaletteSection {
    readonly id: PaletteSectionId;
    readonly label: string;
    readonly entries: readonly PaletteEntry[];
}

/** The Calcpad spelling each structure button is a shortcut for. */
const STRUCTURE_SOURCE: Record<StructureId, string> = {
    frac: 'a/b',
    power: 'x^2',
    subscript: 'x_1',
    sqrt: 'sqrt(x)',
    cbrt: 'cbrt(x)',
    nroot: 'root(x; n)',
    abs: 'abs(x)',
    paren: '(x)',
    bracket: '[x]',
    vector: '[a; b]',
    matrix: 'matrix',
    call: 'f(x)',
};

const OPERATOR_TITLES: Readonly<Record<string, string>> = Object.freeze({
    '^': 'Power',
    '*': 'Multiplication',
    '/': 'Division',
    '\u00F7': 'Division',
    '\\': 'Integer division',
    '\u29BC': 'Remainder',
    '+': 'Addition',
    '-': 'Subtraction',
    '<': 'Less than',
    '>': 'Greater than',
    '\u2264': 'Less than or equal',
    '\u2265': 'Greater than or equal',
    '\u2261': 'Equal to',
    '\u2260': 'Not equal',
    '\u2227': 'Logical and',
    '\u2228': 'Logical or',
    '\u2295': 'Exclusive or',
    '\u2220': 'Phasor angle',
    '=': 'Assignment',
    '\u2190': 'Assignment arrow',
    '!': 'Factorial',
});

/**
 * `|` is the absolute-value delimiter and typing it is declined by the editor (only the `abs`
 * structure writes it), so it is the one operator with no button of its own.
 */
const OPERATOR_WITHOUT_BUTTON = '|';

/** Functions by section, in the order the sections appear. Titles are the searchable names. */
const FUNCTION_GROUPS: readonly { id: PaletteSectionId; label: string; names: readonly [string, string][] }[] = [
    {
        id: 'trigonometric',
        label: 'Trigonometric',
        names: [
            ['sin', 'Sine'], ['cos', 'Cosine'], ['tan', 'Tangent'],
            ['csc', 'Cosecant'], ['sec', 'Secant'], ['cot', 'Cotangent'],
        ],
    },
    {
        id: 'hyperbolic',
        label: 'Hyperbolic',
        names: [
            ['sinh', 'Hyperbolic sine'], ['cosh', 'Hyperbolic cosine'], ['tanh', 'Hyperbolic tangent'],
            ['csch', 'Hyperbolic cosecant'], ['sech', 'Hyperbolic secant'], ['coth', 'Hyperbolic cotangent'],
        ],
    },
    {
        id: 'inverse',
        label: 'Inverse',
        names: [
            ['asin', 'Arcsine'], ['acos', 'Arccosine'], ['atan', 'Arctangent'],
            ['atan2', 'Two-argument arctangent'], ['acsc', 'Arccosecant'], ['asec', 'Arcsecant'],
            ['acot', 'Arccotangent'], ['asinh', 'Inverse hyperbolic sine'], ['acosh', 'Inverse hyperbolic cosine'],
            ['atanh', 'Inverse hyperbolic tangent'], ['acsch', 'Inverse hyperbolic cosecant'],
            ['asech', 'Inverse hyperbolic secant'], ['acoth', 'Inverse hyperbolic cotangent'],
        ],
    },
    {
        id: 'logarithmic',
        label: 'Logarithmic & power',
        names: [
            ['log', 'Base-10 logarithm'], ['ln', 'Natural logarithm'], ['log_2', 'Binary logarithm'],
            ['exp', 'Exponential'], ['sqrt', 'Square root'],
            ['cbrt', 'Cube root'], ['root', 'n-th root'],
        ],
    },
    {
        id: 'rounding',
        label: 'Rounding',
        names: [
            ['round', 'Round'], ['floor', 'Floor'], ['ceiling', 'Ceiling'], ['trunc', 'Truncate'],
            ['mod', 'Remainder'], ['gcd', 'Greatest common divisor'], ['lcm', 'Least common multiple'],
        ],
    },
    {
        id: 'complex',
        label: 'Complex',
        names: [
            ['re', 'Real part'], ['im', 'Imaginary part'], ['abs', 'Absolute value'],
            ['phase', 'Phase angle'], ['conj', 'Complex conjugate'],
        ],
    },
    {
        id: 'aggregate',
        label: 'Aggregate',
        names: [
            ['min', 'Minimum'], ['max', 'Maximum'], ['sum', 'Sum'], ['sumsq', 'Sum of squares'],
            ['srss', 'Square root of sum of squares'], ['average', 'Average'], ['product', 'Product'],
            ['mean', 'Mean'], ['take', 'Take'], ['line', 'Linear interpolation'], ['spline', 'Spline interpolation'],
        ],
    },
    {
        id: 'logic',
        label: 'Logic & control',
        names: [
            ['if', 'Conditional'], ['switch', 'Switch'], ['not', 'Logical not'], ['and', 'Logical and'],
            ['or', 'Logical or'], ['xor', 'Exclusive or'], ['sign', 'Sign'], ['random', 'Random number'],
            ['getunits', 'Get units'], ['setunits', 'Set units'], ['clrunits', 'Clear units'],
            ['hp', 'High precision'], ['ishp', 'Is high precision'],
        ],
    },
];

const GREEK = 'αβγδεζηθικλμνξοπρστυφχψω';
const GREEK_NAMES = [
    'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta', 'iota', 'kappa', 'lambda',
    'mu', 'nu', 'xi', 'omicron', 'pi', 'rho', 'sigma', 'tau', 'upsilon', 'phi', 'chi', 'psi', 'omega',
];

/** Greek that has a capital of its own; the capital is a different name in Calcpad. */
const GREEK_CAPITALS: readonly [string, string][] = [
    ['\u0393', 'Gamma'], ['\u0394', 'Delta'], ['\u0398', 'Theta'], ['\u039B', 'Lambda'],
    ['\u039E', 'Xi'], ['\u03A0', 'Pi'], ['\u03A3', 'Sigma'], ['\u03A6', 'Phi'],
    ['\u03A8', 'Psi'], ['\u03A9', 'Omega'],
];

/** Constants and unit marks that are a single character of Calcpad source. */
const SYMBOLS: readonly [string, string][] = [
    ['e', "Euler's number"], ['i', 'Imaginary unit'],
    ['\u00B0', 'Degree'], ['\u2032', 'Minute'], ['\u2033', 'Second'],
];

const CAPITAL = (name: string): string => `Capital ${name}`;

const charEntry = (insert: string, title: string, section: PaletteSectionId): PaletteEntry => ({
    id: `char:${insert}`,
    label: insert,
    section,
    kind: 'char',
    insert,
    title,
    keywords: [title.toLowerCase()],
});

function structureEntryFor(id: StructureId): PaletteEntry {
    const spec = STRUCTURES.find((structure) => structure.id === id);
    const insert = STRUCTURE_SOURCE[id];
    const base = {
        id: `structure:${id}`,
        label: spec?.label ?? id,
        section: 'structures' as const,
        insert,
        title: spec?.title ?? id,
        keywords: [id, ...insert.split(/[^A-Za-z0-9]+/u).filter(Boolean)],
    };
    // The generic call button writes a real call, so it gets the same product rule as `sin`.
    if (id === 'call') return { ...base, kind: 'call', name: 'f' };
    // The matrix button opens the size dialog instead of writing a fixed shape; it keeps
    // `structure` so the field's own palette can still find it by StructureId.
    if (id === 'matrix') return { ...base, kind: 'dialog', structure: id };
    return { ...base, kind: 'structure', structure: id };
}

function operatorEntries(): PaletteEntry[] {
    const entries: PaletteEntry[] = Object.keys(OPERATORS)
        .filter((glyph) => glyph !== OPERATOR_WITHOUT_BUTTON)
        .map((glyph) => {
            const title = OPERATOR_TITLES[glyph] ?? glyph;
            return {
                ...charEntry(glyph, title, 'operators'),
                id: `operator:${glyph}`,
                keywords: [title.toLowerCase(), OPERATORS[glyph].shortcuts.join(' ')],
            };
        });
    const factorial = OPERATOR_TITLES['!'];
    entries.push({ ...charEntry('!', factorial, 'operators'), id: 'operator:!' });
    return entries;
}

/** Functions the engine has a structure for — the button builds the structure, not a call. */
const STRUCTURED_FUNCTIONS: Readonly<Record<string, StructureId>> = Object.freeze({
    sqrt: 'sqrt', cbrt: 'cbrt', root: 'nroot', abs: 'abs',
});

function functionEntry(name: string, title: string, section: PaletteSectionId): PaletteEntry {
    const structure = STRUCTURED_FUNCTIONS[name];
    return {
        id: `function:${name}`,
        label: name,
        section,
        kind: structure ? 'structure' : 'call',
        insert: `${name}(§)`,
        title,
        keywords: [name, title.toLowerCase()],
        structure,
        name,
    };
}

function functionEntries(): PaletteEntry[] {
    return FUNCTION_GROUPS.flatMap((group) =>
        group.names.map(([name, title]) => functionEntry(name, title, group.id)),
    );
}

function greekEntries(): PaletteEntry[] {
    const lower = Array.from(GREEK).map((glyph, index) =>
        charEntry(glyph, GREEK_NAMES[index] ?? glyph, 'greek'));
    const upper = GREEK_CAPITALS.map(([glyph, name]) => charEntry(glyph, CAPITAL(name), 'greek'));
    return [...lower, ...upper];
}

function symbolEntries(): PaletteEntry[] {
    return SYMBOLS.map(([glyph, title]) => charEntry(glyph, title, 'symbols'));
}

function section(id: PaletteSectionId, label: string, entries: readonly PaletteEntry[]): PaletteSection {
    return { id, label, entries };
}

export const PALETTE_SECTIONS: readonly PaletteSection[] = Object.freeze([
    section('structures', 'Structures', STRUCTURES.map((structure) => structureEntryFor(structure.id))),
    section('operators', 'Operators', operatorEntries()),
    ...FUNCTION_GROUPS.map((group) => section(group.id, group.label,
        group.names.map(([name, title]) => functionEntry(name, title, group.id)))),
    section('greek', 'Greek', greekEntries()),
    section('symbols', 'Symbols', symbolEntries()),
]);

/** Every entry, in reading order. */
export const PALETTE_ENTRIES: readonly PaletteEntry[] = Object.freeze(
    PALETTE_SECTIONS.flatMap((section) => section.entries),
);

/** The section a structure button belongs to, for the field's own compact palette. */
export function structureEntry(id: StructureId): PaletteEntry | undefined {
    return PALETTE_ENTRIES.find((entry) => entry.structure === id);
}

/**
 * The entry the matrix dialog emits when the user hits Insert: a plain structure entry carrying
 * the chosen shape, so it flows through the same `applyEntry` funnel as every other button.
 */
export function matrixEntry(rows: number, cols: number): PaletteEntry {
    const base = structureEntry('matrix');
    if (!base) return { id: 'structure:matrix', label: 'Matrix', section: 'structures',
        kind: 'structure', structure: 'matrix', rows, cols, insert: 'matrix', title: 'Matrix', keywords: [] };
    return { ...base, kind: 'structure', rows, cols, insert: `${rows}\u00D7${cols} matrix` };
}

/** A one-character entry made on demand — the field's own symbol row uses this. */
export function charEntryFor(insert: string): PaletteEntry {
    return charEntry(insert, insert, 'symbols');
}

/**
 * The sections whose entries match `query`, in the catalog's order. A section title counts as a
 * match, so typing "greek" or "trig" shows the whole group rather than nothing.
 */
export function filterPalette(
    sections: readonly PaletteSection[],
    query: string,
): PaletteSection[] {
    const needle = query.trim().toLowerCase();
    if (needle === '') return [...sections];
    const matches = (entry: PaletteEntry): boolean => {
        const haystack = [entry.label, entry.title, entry.insert, ...entry.keywords].join(' ').toLowerCase();
        return haystack.includes(needle);
    };
    return sections
        .filter((section) => section.label.toLowerCase().includes(needle)
            || section.entries.some(matches))
        .map((section) => (section.label.toLowerCase().includes(needle)
            ? section
            : { ...section, entries: section.entries.filter(matches) }));
}

/** Apply an entry to a tree — the one place a button becomes an edit. */
export function applyPaletteEntry(root: MathNode, anchor: Anchor, entry: PaletteEntry): InsertResult {
    if (entry.kind === 'structure' && entry.structure) {
        return insertStructure(root, anchor, entry.structure,
            { name: entry.name, rows: entry.rows, cols: entry.cols });
    }
    if (entry.kind === 'call' && entry.name) return insertCall(root, anchor, entry.name);
    // The dialog entry's own click is intercepted by the field (it opens the dialog), so reaching
    // here means someone applied it headless — insert the default 3×3 rather than the word.
    if (entry.kind === 'dialog') return insertStructure(root, anchor, 'matrix', {});
    return applyCharacter(root, anchor, entry.insert);
}

/**
 * Functions with no button of their own: `sqr` is an input alias the parser reads as a square
 * root, so a `sqr(§)` template would insert text that reads back as `sqrt(§)`.
 */
const ALIASES = new Set(['sqr']);

/** Every function the grammar knows has an entry; used by the palette test as a guard. */
export function functionEntriesMissing(): string[] {
    const offered = new Set(PALETTE_ENTRIES.flatMap((entry) => (entry.name ? [entry.name] : [])));
    return [...BUILTIN_FUNCTIONS].filter((name) => !offered.has(name) && !ALIASES.has(name));
}
