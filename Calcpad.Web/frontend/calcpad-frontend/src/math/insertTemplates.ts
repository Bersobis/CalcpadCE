/**
 * Templates the live editor's buttons insert, expressed as MathLive LaTeX.
 *
 * Every entry was verified two ways rather than assumed:
 *
 *  - MathLive was asked whether it accepts the template and produces the intended shape.
 *  - The engine (`POST /convert`) was asked whether the Calcpad it reads back is valid.
 *
 * The second check is why there is no absolute-value button. `|x|` is not distinguishable
 * from Calcpad's unit target in `x|MPa`, so an inserted `|…|` reads back as a units
 * expression and comes out as `0(x|0)`. A button that silently changed the meaning of the
 * line was not worth having.
 *
 * `#0` marks where the cursor lands, which is what makes the inserted slot editable at
 * once. `\placeholder{}` is MathLive's empty slot; the reader maps it to an empty group.
 */

export interface InsertTemplate {
    /** Button label. Kept short: the palette has to fit beside the field. */
    label: string;
    /** Tooltip explaining what lands in the line. */
    title: string;
    /** MathLive LaTeX inserted at the cursor. */
    latex: string;
    /** Group heading in the palette. */
    group: 'Roots and powers' | 'Fractions' | 'Grouping' | 'Common functions';
}

export const INSERT_TEMPLATES: InsertTemplate[] = [
    // Roots and powers
    { label: '√', title: 'Square root — sqrt(#0)', latex: '\\sqrt{#0}', group: 'Roots and powers' },
    { label: '∛', title: 'Cube root — cbrt(#0)', latex: '\\sqrt[3]{#0}', group: 'Roots and powers' },
    { label: 'ⁿ√', title: 'nth root — root(#0; #1)', latex: '\\sqrt[#0]{#1}', group: 'Roots and powers' },
    { label: 'xⁿ', title: 'Exponent — #0^#1', latex: '{#0}^{#1}', group: 'Roots and powers' },
    { label: 'x²', title: 'Square — #0^2', latex: '{#0}^{2}', group: 'Roots and powers' },
    { label: 'x⁻¹', title: 'Reciprocal — 1/#0', latex: '\\frac{1}{#0}', group: 'Roots and powers' },

    // Fractions
    { label: 'a⁄b', title: 'Fraction — #0/#1', latex: '\\frac{#0}{#1}', group: 'Fractions' },

    // Grouping
    { label: '( )', title: 'Parentheses — (#0)', latex: '(#0)', group: 'Grouping' },

    // Common functions, spelled the way Calcpad's reference lists them.
    { label: 'sin', title: 'Sine — sin(#0)', latex: '\\sin(#0)', group: 'Common functions' },
    { label: 'cos', title: 'Cosine — cos(#0)', latex: '\\cos(#0)', group: 'Common functions' },
    { label: 'tan', title: 'Tangent — tan(#0)', latex: '\\tan(#0)', group: 'Common functions' },
    { label: 'ln', title: 'Natural logarithm — ln(#0)', latex: '\\ln(#0)', group: 'Common functions' },
    { label: 'log', title: 'Decimal logarithm — log(#0)', latex: '\\log(#0)', group: 'Common functions' },
    { label: 'exp', title: 'Exponential — exp(#0)', latex: '\\exp(#0)', group: 'Common functions' },
    { label: 'abs', title: 'Absolute value — abs(#0)', latex: '\\operatorname{abs}(#0)', group: 'Common functions' },
    { label: 'sign', title: 'Sign — sign(#0)', latex: '\\operatorname{sign}(#0)', group: 'Common functions' },
    { label: 'min', title: 'Minimum — min(#0)', latex: '\\operatorname{min}(#0)', group: 'Common functions' },
    { label: 'max', title: 'Maximum — max(#0)', latex: '\\operatorname{max}(#0)', group: 'Common functions' },
    { label: 'if', title: 'Conditional — if(#0; #1; #2)', latex: '\\operatorname{if}(#0;#1;#2)', group: 'Common functions' },
];

/** Unique group names, in the order the templates declare them. */
export function insertGroups(): string[] {
    return [...new Set(INSERT_TEMPLATES.map((t) => t.group))];
}

/**
 * True when the field still holds an empty MathLive slot.
 *
 * A half-filled template must not be committed: the Calcpad for `sqrt(\placeholder{})` is
 * `sqrt(())`, and the engine answers `Invalid syntax: "( )"` for that. The field therefore
 * stays in edit mode until the user types something, rather than writing a broken line.
 */
export function hasEmptyPlaceholder(latex: string): boolean {
    return /\\placeholder\{\s*\}/.test(latex);
}