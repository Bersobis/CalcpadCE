/**
 * The live editor's math palette: the symbols, operators and structures a user
 * clicks to build an expression without typing its syntax.
 *
 * Everything here is pure text surgery on one Calcpad source line — no DOM, no
 * Vue — so the buttons are unit-testable and can be shared. A button is a
 * `PaletteAction`; `apply` turns `(line, selection)` into the new line plus the
 * selection to leave behind. That lets one action wrap a selection
 * (`a+b` → `sqrt(a+b)`) or drop a glyph at the caret, and lets a button
 * *extend* what is already there (`x` + caret → `x^()`), which is what makes the
 * palette feel like editing rather than pasting.
 */

/** A half-open `[start, end)` range in a line. */
export interface TextSelection {
    start: number
    end: number
}

/** The line and selection a palette action leaves behind. */
export interface PaletteResult {
    text: string
    selection: TextSelection
}

/** One button in the palette. */
export interface PaletteAction {
    /** Stable id — the Vue key, and what the tests name. */
    id: string
    /** The button face. */
    label: string
    /** Tooltip and accessible name. */
    title: string
    /** Group the button is filed under. */
    group: string
    /** The Calcpad source this button writes, shown in the tooltip. */
    syntax: string
    /**
     * Apply the action to `line` with `selection` selected. Callers pass the
     * caret as an empty selection (`start === end`).
     */
    apply(line: string, selection: TextSelection): PaletteResult
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value))
}

/** Order the two ends and clip them to the line, so a caller can pass either order. */
function normalizeSelection(line: string, selection: TextSelection): TextSelection {
    return {
        start: clamp(Math.min(selection.start, selection.end), 0, line.length),
        end: clamp(Math.max(selection.start, selection.end), 0, line.length),
    }
}

function at(line: string, index: number): PaletteResult {
    return { text: line, selection: { start: index, end: index } }
}

/** A button that replaces the selection with fixed text and parks the caret inside it. */
function insert(spec: {
    id: string
    label: string
    title: string
    group: string
    syntax: string
    /** Text written in place of the selection. */
    text: string
    /** Caret offset from the start of `text`. Defaults to the end. */
    caret?: number
}): PaletteAction {
    return {
        id: spec.id,
        label: spec.label,
        title: spec.title,
        group: spec.group,
        syntax: spec.syntax,
        apply(line, selection) {
            const { start, end } = normalizeSelection(line, selection)
            const text = line.slice(0, start) + spec.text + line.slice(end)
            const caret = start + (spec.caret ?? spec.text.length)
            return { text, selection: { start: caret, end: caret } }
        },
    }
}

/**
 * A button that wraps the selection in `before`/`after`.
 *
 * With nothing selected it writes `before + placeholder + after` and puts the
 * caret at `caret` (an offset from the insertion point). With something
 * selected it keeps the wrapped text selected, so a second button wraps the
 * same expression again — unless `filledCaret` says where the caret should go
 * instead (an offset from the *end* of the selection), which the two-slot
 * structures use to move on to their next field.
 */
function wrap(spec: {
    id: string
    label: string
    title: string
    group: string
    syntax: string
    before: string
    after: string
    /** Written between the wrappers when nothing is selected. */
    placeholder?: string
    /** Caret offset from the insertion point when nothing is selected. */
    caret?: number
    /** Caret offset from the end of the selection when something *is* selected. */
    filledCaret?: number
}): PaletteAction {
    return {
        id: spec.id,
        label: spec.label,
        title: spec.title,
        group: spec.group,
        syntax: spec.syntax,
        apply(line, selection) {
            const { start, end } = normalizeSelection(line, selection)
            const selected = line.slice(start, end)
            const inner = selected || spec.placeholder || ''
            const text = line.slice(0, start) + spec.before + inner + spec.after + line.slice(end)
            const base = start + spec.before.length
            if (selected && spec.filledCaret === undefined) {
                return { text, selection: { start: base, end: base + selected.length } }
            }
            const caret = selected
                ? base + selected.length + (spec.filledCaret ?? 0)
                : start + (spec.caret ?? spec.before.length)
            return at(text, caret)
        },
    }
}

/** A button that appends a fixed suffix, wrapping the selection first when there is one. */
function suffix(spec: {
    id: string
    label: string
    title: string
    group: string
    syntax: string
    /** Appended verbatim after the (optionally wrapped) selection. */
    append: string
    /** Wrap the selection in round brackets first. */
    bracketSelection?: boolean
    /** Caret offset from the start of `append`. Defaults to inside a trailing `()`. */
    caretInAppend?: number
}): PaletteAction {
    const caretInAppend = spec.caretInAppend ?? (spec.append.endsWith('()') ? spec.append.length - 1 : spec.append.length)
    return {
        id: spec.id,
        label: spec.label,
        title: spec.title,
        group: spec.group,
        syntax: spec.syntax,
        apply(line, selection) {
            const { start, end } = normalizeSelection(line, selection)
            const selected = line.slice(start, end)
            const base = selected && spec.bracketSelection ? `(${selected})` : selected
            const text = line.slice(0, start) + base + spec.append + line.slice(end)
            return at(text, start + base.length + caretInAppend)
        },
    }
}

// ---- Groups -----------------------------------------------------------------

export const PALETTE_GROUPS = ['Structures', 'Functions', 'Operators', 'Relations', 'Greek'] as const

export type PaletteGroup = (typeof PALETTE_GROUPS)[number]

// ---- Structures -------------------------------------------------------------

const STRUCTURES: PaletteAction[] = [
    wrap({
        id: 'sqrt', label: '√', title: 'Square root', group: 'Structures', syntax: 'sqrt(x)',
        before: 'sqrt(', after: ')',
    }),
    wrap({
        id: 'cbrt', label: '∛', title: 'Cube root', group: 'Structures', syntax: 'root(x; 3)',
        before: 'root(', after: '; 3)',
    }),
    wrap({
        id: 'nroot', label: 'ⁿ√', title: 'n-th root', group: 'Structures', syntax: 'root(x; n)',
        before: 'root(', after: '; )', filledCaret: 2,
    }),
    suffix({
        id: 'power', label: 'xⁿ', title: 'Raise to a power', group: 'Structures', syntax: 'x^n',
        append: '^()', bracketSelection: true,
    }),
    suffix({
        id: 'subscript', label: 'xₙ', title: 'Subscript', group: 'Structures', syntax: 'x_n',
        append: '_()', bracketSelection: true,
    }),
    wrap({
        id: 'fraction', label: 'a⁄b', title: 'Fraction', group: 'Structures', syntax: 'a/b',
        before: '(', after: ')/()', caret: 1, filledCaret: 3,
    }),
    wrap({
        id: 'brackets', label: '( )', title: 'Parentheses', group: 'Structures', syntax: '(x)',
        before: '(', after: ')',
    }),
    wrap({
        id: 'abs', label: '|x|', title: 'Absolute value', group: 'Structures', syntax: 'abs(x)',
        before: 'abs(', after: ')',
    }),
    wrap({
        id: 'floor', label: '⌊x⌋', title: 'Floor', group: 'Structures', syntax: 'floor(x)',
        before: 'floor(', after: ')',
    }),
    wrap({
        id: 'ceil', label: '⌈x⌉', title: 'Ceiling', group: 'Structures', syntax: 'ceil(x)',
        before: 'ceil(', after: ')',
    }),
    wrap({
        id: 'vector', label: '[ ]', title: 'Vector or matrix literal', group: 'Structures', syntax: '[a; b|c; d]',
        before: '[', after: ']',
    }),
    insert({
        id: 'matrix2x2', label: '2×2', title: '2×2 matrix literal', group: 'Structures', syntax: '[a; b|c; d]',
        text: '[; |; ]', caret: 1,
    }),
    insert({
        id: 'sum', label: 'Σ', title: 'Sum of a vector', group: 'Structures', syntax: 'sum(x)',
        text: 'sum()', caret: 4,
    }),
    insert({
        id: 'product', label: '∏', title: 'Product of a vector', group: 'Structures', syntax: 'product(x)',
        text: 'product()', caret: 8,
    }),
]

// ---- Functions --------------------------------------------------------------

const FUNCTION_NAMES = [
    'sin', 'cos', 'tan', 'asin', 'acos', 'atan',
    'sinh', 'cosh', 'tanh', 'ln', 'log', 'exp', 'sign',
    'min', 'max', 'if',
]

const FUNCTIONS: PaletteAction[] = FUNCTION_NAMES.map(name =>
    wrap({
        id: 'fn-' + name,
        label: name,
        title: `${name} function`,
        group: 'Functions',
        syntax: `${name}(x)`,
        before: `${name}(`,
        after: ')',
    }),
)

// ---- Operators --------------------------------------------------------------

/**
 * The glyph, the title, and the syntax it produces. Only operators the engine
 * actually parses appear here — `docs/quick-reference.md` is the list, and a
 * glyph the parser rejects would break the line the button was meant to build.
 * So multiplication is `*` (not `·` or `×`), subtraction is `-` (not `−`), and
 * there is no `±` or bare `%`.
 */
const OPERATOR_GLYPHS: [string, string, string][] = [
    ['+', 'Addition', 'a + b'],
    ['-', 'Subtraction', 'a - b'],
    ['*', 'Multiplication', 'a*b'],
    ['/', 'Division', 'a/b'],
    ['÷', 'Force a division bar', 'a÷b'],
    ['^', 'Power', 'a^b'],
    ['_', 'Subscript', 'a_b'],
    ['!', 'Factorial', 'n!'],
    ['\\', 'Integer division', 'a\\b'],
    ['⦼', 'Modulo', 'a⦼b'],
    ['°', 'Degrees', 'a°'],
]

const OPERATORS: PaletteAction[] = OPERATOR_GLYPHS.map(([glyph, title, syntax], i) =>
    insert({
        id: 'op-' + i,
        label: glyph,
        title,
        group: 'Operators',
        syntax,
        text: glyph,
    }),
)

// ---- Relations --------------------------------------------------------------

const RELATION_GLYPHS: [string, string, string][] = [
    ['=', 'Equal to', 'a = b'],
    ['≠', 'Not equal to', 'a ≠ b'],
    ['≤', 'Less than or equal', 'a ≤ b'],
    ['≥', 'Greater than or equal', 'a ≥ b'],
    ['≡', 'Identical to', 'a ≡ b'],
    ['<', 'Less than', 'a < b'],
    ['>', 'Greater than', 'a > b'],
    ['←', 'Assign (outer)', 'a ← b'],
    ['∠', 'Phasor angle', 'a∠b'],
    ['⊕', 'Logical XOR', 'a ⊕ b'],
]

const RELATIONS: PaletteAction[] = RELATION_GLYPHS.map(([glyph, title, syntax], i) =>
    insert({
        id: 'rel-' + i,
        label: glyph,
        title,
        group: 'Relations',
        syntax,
        text: glyph,
    }),
)

// ---- Greek ------------------------------------------------------------------

const GREEK = 'α β γ δ ε ζ η θ ι κ λ μ ν ξ π ρ σ τ υ φ χ ψ ω Γ Δ Θ Λ Ξ Π Σ Φ Ψ Ω'.split(' ')

const GREEK_NAMES: Record<string, string> = {
    α: 'alpha', β: 'beta', γ: 'gamma', δ: 'delta', ε: 'epsilon', ζ: 'zeta', η: 'eta',
    θ: 'theta', ι: 'iota', κ: 'kappa', λ: 'lambda', μ: 'mu', ν: 'nu', ξ: 'xi', π: 'pi',
    ρ: 'rho', σ: 'sigma', τ: 'tau', υ: 'upsilon', φ: 'phi', χ: 'chi', ψ: 'psi', ω: 'omega',
    Γ: 'Gamma', Δ: 'Delta', Θ: 'Theta', Λ: 'Lambda', Ξ: 'Xi', Π: 'Pi', Σ: 'Sigma',
    Φ: 'Phi', Ψ: 'Psi', Ω: 'Omega',
}

const GREEK_ACTIONS: PaletteAction[] = GREEK.map(letter =>
    insert({
        id: 'greek-' + (GREEK_NAMES[letter] ?? letter),
        label: letter,
        title: GREEK_NAMES[letter] ?? letter,
        group: 'Greek',
        syntax: letter,
        text: letter,
    }),
)

/** Every button, in palette order. */
export const MATH_PALETTE: PaletteAction[] = [
    ...STRUCTURES,
    ...FUNCTIONS,
    ...OPERATORS,
    ...RELATIONS,
    ...GREEK_ACTIONS,
]

/** Look a button up by id — used by the tests and by keyboard shortcuts. */
export function paletteAction(id: string): PaletteAction | undefined {
    return MATH_PALETTE.find(action => action.id === id)
}

/** The buttons of one group, in declaration order. */
export function paletteGroup(group: string): PaletteAction[] {
    return MATH_PALETTE.filter(action => action.group === group)
}

/**
 * The palette narrowed to the groups that match `query` (case-insensitive, over
 * the label, title and syntax). An empty query returns the whole palette.
 */
export function searchPalette(query: string): PaletteAction[] {
    const term = query.trim().toLowerCase()
    if (!term) return MATH_PALETTE
    return MATH_PALETTE.filter(action =>
        action.label.toLowerCase().includes(term)
        || action.title.toLowerCase().includes(term)
        || action.syntax.toLowerCase().includes(term),
    )
}
