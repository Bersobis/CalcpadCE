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
    group:
        | 'Roots and powers'
        | 'Fractions'
        | 'Grouping'
        | 'Common functions'
        | 'Rounding and integers'
        | 'Complex'
        | 'Logic'
        | 'Vectors and matrices';
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

    // Rounding and integers. The doc lists these next to the trig block, and they are the
    // functions most often reached for after typing a quotient -- which is why there was no
    // button for any of them.
    { label: 'round', title: 'Round to nearest — round(#0)', latex: '\\operatorname{round}(#0)', group: 'Rounding and integers' },
    { label: '⌊⌋', title: 'Round down — floor(#0)', latex: '\\operatorname{floor}(#0)', group: 'Rounding and integers' },
    { label: '⌈⌉', title: 'Round up — ceiling(#0)', latex: '\\operatorname{ceiling}(#0)', group: 'Rounding and integers' },
    { label: 'trunc', title: 'Round toward zero — trunc(#0)', latex: '\\operatorname{trunc}(#0)', group: 'Rounding and integers' },
    { label: 'mod', title: 'Remainder — mod(#0; #1)', latex: '\\operatorname{mod}(#0;#1)', group: 'Rounding and integers' },
    { label: 'gcd', title: 'Greatest common divisor — gcd(#0; #1)', latex: '\\operatorname{gcd}(#0;#1)', group: 'Rounding and integers' },
    { label: 'lcm', title: 'Least common multiple — lcm(#0; #1)', latex: '\\operatorname{lcm}(#0;#1)', group: 'Rounding and integers' },

    // Complex.
    { label: 're', title: 'Real part — re(#0)', latex: '\\operatorname{re}(#0)', group: 'Complex' },
    { label: 'im', title: 'Imaginary part — im(#0)', latex: '\\operatorname{im}(#0)', group: 'Complex' },
    { label: 'conj', title: 'Conjugate — conj(#0)', latex: '\\operatorname{conj}(#0)', group: 'Complex' },
    { label: 'phase', title: 'Phase — phase(#0)', latex: '\\operatorname{phase}(#0)', group: 'Complex' },

    // Logic. `if` and `min`/`max` are already above; these are the rest of the doc's
    // "Conditional and Logical" block.
    { label: 'switch', title: 'Selective evaluation — switch(#0; #1; #2)', latex: '\\operatorname{switch}(#0;#1;#2)', group: 'Logic' },
    { label: 'not', title: 'Logical NOT — not(#0)', latex: '\\operatorname{not}(#0)', group: 'Logic' },
    { label: 'and', title: 'Logical AND — and(#0; #1)', latex: '\\operatorname{and}(#0;#1)', group: 'Logic' },
    { label: 'or', title: 'Logical OR — or(#0; #1)', latex: '\\operatorname{or}(#0;#1)', group: 'Logic' },
    { label: 'xor', title: 'Logical XOR — xor(#0; #1)', latex: '\\operatorname{xor}(#0;#1)', group: 'Logic' },

    // Vectors and matrices. The bracketed literals go through `;`, the separator the
    // printer emits and the one Calcpad documents for them.
    { label: '[ ]', title: 'Vector — [#0; #1]', latex: '[#0;#1]', group: 'Vectors and matrices' },
    { label: 'M[ ]', title: 'Matrix row — [#0, #1]', latex: '[#0,#1]', group: 'Vectors and matrices' },
    { label: 'len', title: 'Vector length — len(#0)', latex: '\\operatorname{len}(#0)', group: 'Vectors and matrices' },
    { label: 'norm', title: 'Vector norm — norm(#0)', latex: '\\operatorname{norm}(#0)', group: 'Vectors and matrices' },
    { label: 'unit', title: 'Normalized vector — unit(#0)', latex: '\\operatorname{unit}(#0)', group: 'Vectors and matrices' },
    { label: 'dot', title: 'Scalar product — dot(#0; #1)', latex: '\\operatorname{dot}(#0;#1)', group: 'Vectors and matrices' },
    { label: 'cross', title: 'Cross product — cross(#0; #1)', latex: '\\operatorname{cross}(#0;#1)', group: 'Vectors and matrices' },
    { label: 'det', title: 'Determinant — det(#0)', latex: '\\det(#0)', group: 'Vectors and matrices' },
    { label: 'trace', title: 'Trace — trace(#0)', latex: '\\operatorname{trace}(#0)', group: 'Vectors and matrices' },
    { label: 'rank', title: 'Rank — rank(#0)', latex: '\\operatorname{rank}(#0)', group: 'Vectors and matrices' },
    { label: 'transp', title: 'Transpose — transp(#0)', latex: '\\operatorname{transp}(#0)', group: 'Vectors and matrices' },
    { label: 'inverse', title: 'Inverse — inverse(#0)', latex: '\\operatorname{inverse}(#0)', group: 'Vectors and matrices' },
    { label: 'lsolve', title: 'Solve system — lsolve(#0; #1)', latex: '\\operatorname{lsolve}(#0;#1)', group: 'Vectors and matrices' },
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