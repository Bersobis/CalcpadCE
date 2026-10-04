import { describe, expect, it } from 'vitest';
import { convertLatexToMathMl, validateLatex } from 'mathlive/ssr';
import { astToLatex, latexToAst, latexToCalcpad } from '../src/math/latex';
import { astToCalcpad, calcpadToAst, splitWorksheet } from '../src/math/calcpad';
import { classifyLineEdit } from '../src/math/roundTrip';
import { applyMatrixOp, hasMatrix, matrixSize } from '../src/math/matrixOps';
import type { MatrixOp } from '../src/math/matrixOps';
import type { MathJSON } from '../src/math/mathjson';

const tight = (s: string): string => s.replace(/\s+/g, '');

function calcpadToLatex(source: string): string {
    return astToLatex(calcpadToAst(source));
}

/** Strips bracing and sizing macros so LaTeX can be compared by content. */
const norm = (s: string): string =>
    s.replace(/\\left|\\right/g, '').replace(/[{}]/g, '').replace(/\s+/g, '');

describe('calcpad -> AST', () => {
    it('parses a number', () => {
        expect(calcpadToAst('42')).toMatchObject({ type: 'Number', n: 42 });
    });

    it('parses a variable', () => {
        expect(calcpadToAst('x')).toMatchObject({ type: 'Identifier', sym: 'x' });
    });

    it('respects precedence', () => {
        expect(calcpadToAst('1+2*3')).toMatchObject({
            type: 'Operator', op: '+', args: [{ n: 1 }, { type: 'Operator', op: '*' }],
        });
    });

    it('parses a power as a superscript node', () => {
        expect(calcpadToAst('x^2')).toMatchObject({ type: 'Sup', base: { sym: 'x' }, sup: { n: 2 } });
    });

    it('parses a subscript', () => {
        expect(calcpadToAst('s_1')).toMatchObject({ type: 'Sub', base: { sym: 's' }, sub: { n: 1 } });
    });

    it('parses root(x; n) as a Root node', () => {
        expect(calcpadToAst('root(x; 3)')).toMatchObject({ type: 'Root', index: { n: 3 } });
    });

    it('parses sqrt(x) as a Sqrt node', () => {
        expect(calcpadToAst('sqrt(x)')).toMatchObject({ type: 'Sqrt', radicand: { sym: 'x' } });
    });

    it('marks the target of | as Units', () => {
        expect(calcpadToAst('10|kN/m^2')).toMatchObject({
            type: 'Operator', op: '|', args: [{ n: 10 }, { type: 'Units' }],
        });
    });

    describe('single-letter units versus variables', () => {
        // `a` is the SI are and `A` the ampere, but both are ordinary variable names.
        // Misclassifying a variable as a unit changes the meaning, so the parser only
        // infers a one-letter unit where nothing else is possible.
        it('keeps a bare one-letter name as a variable', () => {
            expect(calcpadToAst('a+b')).toMatchObject({
                type: 'Operator', args: [{ type: 'Identifier' }, { type: 'Identifier' }],
            });
        });

        it('treats an assignment target as a definition, not a unit', () => {
            const ast = calcpadToAst('A = 1');
            expect(ast).toMatchObject({ type: 'Operator', op: '=' });
            expect((ast as { args: MathJSON[] }).args[0]).toMatchObject({ type: 'Identifier', sym: 'A' });
        });

        it('infers a unit after a numeric literal', () => {
            expect(calcpadToAst('50m')).toMatchObject({
                type: 'Operator', args: [{ n: 50 }, { type: 'Text', unit: true }],
            });
        });

        it('always treats a multi-letter unit name as a unit', () => {
            expect(calcpadToAst('35cm')).toMatchObject({
                type: 'Operator', args: [{ n: 35 }, { type: 'Text', text: 'cm', unit: true }],
            });
        });
    });
});

describe('explicit fractions', () => {
    it('prints a Frac node as the parenthesised (a)/(b) form', () => {
        // The documented contract for a fraction that arrives from OMML `<m:f>`.
        const ast: MathJSON = { type: 'Frac', num: { type: 'Number', n: 1 }, den: { type: 'Number', n: 2 } };
        expect(astToCalcpad(ast)).toBe('(1)/(2)');
        expect(astToLatex(ast)).toBe('\\frac{1}{2}');
    });
});

describe('AST -> LaTeX', () => {
    it('emits \\frac for division', () => {
        expect(calcpadToLatex('a/b')).toBe('\\frac{a}{b}');
    });

    it('emits \\sqrt for the square root', () => {
        expect(calcpadToLatex('sqrt(x)')).toBe('\\sqrt{x}');
    });

    it('emits a bracketed \\sqrt for an n-th root', () => {
        expect(calcpadToLatex('root(x; 3)')).toBe('\\sqrt[3]{x}');
    });

    it('emits braced scripts', () => {
        expect(calcpadToLatex('x^2')).toBe('x^{2}');
        expect(calcpadToLatex('x_1')).toBe('x_{1}');
    });

    it('emits \\cdot for an explicit multiplication', () => {
        // A trailing space is required: `\cdotx` would be an undefined control sequence.
        expect(calcpadToLatex('2*x')).toBe('2\\cdot x');
    });

    it('keeps a whole unit expression literal inside \\text', () => {
        // The `/` and `^` must not become a fraction and an exponent.
        expect(calcpadToLatex('10|kN/m^2')).toBe('10\\quad\\text{kN/m^2}');
    });

    it('parenthesises a low-precedence left operand', () => {
        expect(calcpadToLatex('(1+2)*3')).toBe('(1+2)\\cdot 3');
    });

    it('sets a multi-letter function name upright', () => {
        expect(calcpadToLatex('sin(x)')).toContain('\\mathrm{sin}');
    });
});

describe('LaTeX -> calcpad', () => {
    it('reads \\frac back as a division, preserving the slash', () => {
        expect(tight(latexToCalcpad('\\frac{a}{b}'))).toBe(tight('a/b'));
    });

    it('reads \\sqrt[n]{} back as root(x; n)', () => {
        expect(tight(latexToCalcpad('\\sqrt[3]{x}'))).toBe(tight('root(x; 3)'));
    });

    it('reads \\sqrt{} back as sqrt(x)', () => {
        expect(tight(latexToCalcpad('\\sqrt{x}'))).toBe(tight('sqrt(x)'));
    });

    it('reads a compound \\text run back with the conversion target', () => {
        expect(tight(latexToCalcpad('10\\,\\text{kN/m^2}'))).toBe(tight('10|kN/m^2'));
    });
});

describe('MathLive-shaped LaTeX reads back', () => {
    // Every string below is the real output of `mathlive@0.111` for the corresponding
    // input, measured rather than guessed. A macro missing from `MACRO_OPS` does not
    // fail — it becomes a variable named after itself, so these are the cases that
    // silently corrupt an expression.
    it.each([
        ['a\\le b', 'a <= b'],
        ['a\\ge b', 'a >= b'],
        ['a\\ne b', 'a != b'],
        ['a\\land b', 'a && b'],
        ['a\\lor b', 'a || b'],
        ['a\\times b', 'a * b'],
        ['a\\cdot b', 'a * b'],
        ['a<b', 'a < b'],
        ['a>b', 'a > b'],
    ])('reads %s as %s', (latex, expected) => {
        expect(tight(latexToCalcpad(latex))).toBe(tight(expected));
    });

    it('does not swallow the operand of a macro written without a following space', () => {
        // `command()` has already consumed the macro, so the reader must not step over
        // the first character of the right operand as well.
        expect(latexToCalcpad('a\\cdot2')).toBe('a * 2');
    });

    it('reads \\sin \\left(x\\right) as a call rather than a product of names', () => {
        expect(latexToCalcpad('\\sin \\left(x\\right)')).toBe('sin(x)');
        expect(latexToAst('\\sin \\left(x\\right)')).toMatchObject({ type: 'Function', fn: 'sin' });
    });

    it('does not turn \\left into a variable named left', () => {
        expect(latexToCalcpad('\\left(x\\right)')).toBe('(x)');
    });

    it('keeps two adjacent names apart in an implicit product', () => {
        // `sin x` printed with no gap would re-parse as the single name `sinx`.
        expect(astToCalcpad(calcpadToAst('sin x'))).toBe('sin x');
        expect(latexToCalcpad('\\sin x')).toBe('sin x');
    });

    it('maps a non-finite number onto TeX rather than spelling it out', () => {
        expect(astToLatex({ type: 'Number', n: Infinity })).toBe('\\infty');
        expect(astToLatex({ type: 'Number', n: -Infinity })).toBe('-\\infty');
        expect(astToLatex({ type: 'Number', n: NaN })).toBe('\\text{Undefined}');
        // Both printers agree on what these are called.
        expect(astToCalcpad({ type: 'Number', n: Infinity })).toBe('∞');
    });
});

describe('MathLive accepts the emitted LaTeX', () => {
    // Expected results are asserted on the MathML MathLive produces, not on its LaTeX
    // rendering, so the checks describe what will actually appear on the canvas.
    const cases: [string, string][] = [
        ['x^2', '<msup><mi>x</mi><mn>2</mn></msup>'],
        ['a+b', '<mi>a</mi><mo>+</mo><mi>b</mi>'],
        ['(1+2)*3', '<mo>⋅</mo><mn>3</mn>'],
        ['sqrt(x)', '<msqrt><mi>x</mi></msqrt>'],
        ['root(x; 3)', '<mroot><mi>x</mi><mn>3</mn></mroot>'],
        ['x_1', '<msub><mi>x</mi><mn>1</mn></msub>'],
        ['a/b', '<mfrac><mi>a</mi><mi>b</mi></mfrac>'],
    ];

    for (const [calcpad, expectedMathml] of cases) {
        it(`parses and renders ${calcpad}`, () => {
            const latex = calcpadToLatex(calcpad);
            expect(validateLatex(latex), `MathLive rejected ${latex}`).toHaveLength(0);
            expect(convertLatexToMathMl(latex)).toContain(expectedMathml);
        });
    }

    it('renders a unit target as upright text, not as a fraction', () => {
        const mathml = convertLatexToMathMl(calcpadToLatex('10|kN/m^2'));
        // <mtext> is the upright run; a fraction would produce <mfrac>.
        expect(mathml).toContain('<mtext');
        expect(mathml).toContain('kN/m^2');
        expect(mathml).not.toMatch(/<mfrac>[\s\S]*kN/);
    });

    it('renders a division as a real fraction element', () => {
        expect(convertLatexToMathMl(calcpadToLatex('a/b'))).toContain('<mfrac>');
    });
});

describe('quoted literals', () => {
    // Calcpad's `'` and `"` delimit a *text literal*, not a comment:
    // `ExpressionParser.GetTokens` emits `TokenTypes.Text` for the span. `1' - for |Mx|`
    // is the user-entered value `1` carrying a description.
    it('keeps a closed literal verbatim, delimiters included', () => {
        expect(astToCalcpad(calcpadToAst("1' - horizontal radius")))
            .toBe("1' - horizontal radius");
    });

    it('keeps an unterminated literal unterminated', () => {
        // `A_s = 84'` runs to the end of the line, which is legal. Spacing around `=`
        // is normalised by the printer; the literal itself must survive byte for byte.
        expect(astToCalcpad(calcpadToAst("A_s = 84'"))).toBe("A_s=84'");
    });

    it('does not swallow the rest of the line after a label', () => {
        // The regression this replaced: the line parsed as `A_s=84` and dropped the rest.
        expect(astToCalcpad(calcpadToAst("A_s = 84'  'd_0 = 13' 'd_m = 20.5")))
            .toBe("A_s=84'  'd_0=13' 'd_m=20.5");
    });

    it('treats a doubled quote as an escaped one', () => {
        expect(astToCalcpad(calcpadToAst("'it''s'"))).toBe("'it''s'");
    });

    it('renders a literal as upright text rather than maths', () => {
        const latex = astToLatex(calcpadToAst("1' - for |Mx|"));
        expect(latex).toContain('\\text{');
        expect(validateLatex(latex)).toEqual([]);
    });

    it('leaves the labelled expression itself intact', () => {
        // The `=>` here is English prose inside the label, not an operator.
        expect(astToCalcpad(calcpadToAst("A(m; n) = k_2(n)' => 'A_1(m; n) = 1/A(m; n)^2")))
            .toBe("A(m; n)=k_2(n)' => 'A_1(m; n)=1 / A(m; n)^2");
    });

    // The regression this replaced: a commit writes calcpad -> LaTeX -> calcpad, and the
    // bridge emitted a bare `\text{}`. That is indistinguishable from a unit run, so on
    // read-back `'kN·m` became the *units* `kN·m` and the number lost its label.
    it('keeps a label distinguishable from units through the LaTeX bridge', () => {
        const src = "M_a = M/l*a'kN·m";
        expect(latexToCalcpad(astToLatex(calcpadToAst(src)))).toContain("'kN·m");
    });

    // A second regression: the reader assumed every literal was closed, so the unterminated
    // `A_s = 84'` came back as `84''` -- an *escaped quote* to Calcpad, a different literal.
    it('does not invent a closing quote on an unterminated literal', () => {
        for (const src of ["A_s = 84'", "M_a = M/l*a'kN·m", "a' - r'"]) {
            const back = latexToCalcpad(astToLatex(calcpadToAst(src)));
            expect(tight(back)).toBe(tight(src));
        }
    });

    it('keeps a closed literal closed', () => {
        const src = "1' - for |Mx|'";
        expect(latexToCalcpad(astToLatex(calcpadToAst(src)))).toBe(src);
    });

    it('round-trips a label containing an escaped quote', () => {
        const src = "'it''s'";
        expect(latexToCalcpad(astToLatex(calcpadToAst(src)))).toBe(src);
    });

    it('emits LaTeX MathLive accepts for a label', () => {
        for (const src of ["A_s = 84'", "1' - for |Mx|'", "M_a = M/l*a'kN·m"]) {
            expect(validateLatex(astToLatex(calcpadToAst(src)))).toEqual([]);
        }
    });

    it('still round-trips a plain unit run', () => {
        const src = 'c = b - a|μm:N1';
        expect(tight(latexToCalcpad(astToLatex(calcpadToAst(src))))).toBe(tight(src));
    });
});

describe('calcpad-only operators', () => {
    // These have no TeX spelling at all. Each travels inside a `\text{}` group so MathLive
    // renders the glyph upright and the reader can recover it. Before this they were
    // dropped on commit, which silently deleted the operator from the document.
    const cases: [string, string][] = [
        ['factorial', 'n = 5!'],
        ['integer division', 'q = 7\\2'],
        ['modulo', 'r = 7⦼2'],
        ['inline division', 'q = 7÷2'],
        ['outer assignment', 'a ← 5'],
        ['phasor', 'z = 3∠45°'],
    ];

    it.each(cases)('survives the commit path: %s', (_name, src) => {
        const back = latexToCalcpad(astToLatex(calcpadToAst(src)));
        expect(back.length).toBeGreaterThan(0);
        // The printer pads some operators for legibility (`7 \ 2`, `(3∠45)°`), which
        // `normalize` folds. The gate's verdict is what decides whether a line may be
        // edited, so that is the thing to assert.
        expect(classifyLineEdit(src)).toBe('equation');
    });

    it.each(cases)('emits LaTeX MathLive accepts: %s', (_name, src) => {
        expect(validateLatex(astToLatex(calcpadToAst(src)))).toEqual([]);
    });

    it('keeps integer division as a backslash, since the engine rejects ∖', () => {
        // The engine answers REJECT to `q = 7∖2`, so this glyph must survive verbatim
        // rather than being normalised to a "prettier" equivalent.
        const back = latexToCalcpad(astToLatex(calcpadToAst('q = 7\\2')));
        expect(back.replace(/\s+/g, '')).toBe('q=7\\2');
        expect(back).not.toContain('∖');
    });

    it('does not drop the factorial when a line is committed', () => {
        expect(latexToCalcpad(astToLatex(calcpadToAst('n = 5!')))).toBe('n=5!');
    });

    it('treats ÷ and / as the same division', () => {
        expect(classifyLineEdit('q = 7÷2')).toBe('equation');
    });

    it('treats a unicode subscript and _n as the same name', () => {
        expect(classifyLineEdit('x₁ = 5')).toBe('equation');
    });
});

describe('unicode letters', () => {
    // The regression this replaced: the LaTeX reader's identifier rule was `[A-Za-z]`,
    // so a Greek letter was skipped and the symbol collapsed to the number `0` -- silently
    // corrupting any equation that used one, e.g. `δ = 0.5` became `0 = 0.5`.
    const greeks = ['δ', 'α', 'β', 'σ', 'μ', 'θ', 'λ', 'π', 'ε', 'φ'];
    it.each(greeks)('survives the LaTeX bridge as a name, not a number: %s', (g) => {
        const src = `${g} = 2.5`;
        const back = latexToCalcpad(astToLatex(calcpadToAst(src)));
        expect(back).toContain(g);
        expect(back).not.toBe('0 = 2.5');
    });

    it('keeps a greek letter in a subscript', () => {
        const src = 'σ_max = σ_N';
        expect(latexToCalcpad(astToLatex(calcpadToAst(src)))).toContain('σ');
    });

    it('does not let the letter rule swallow a subscript underscore', () => {
        // `NAME_CHAR` covers letters, so `_` must still terminate the name.
        expect(latexToCalcpad(astToLatex(calcpadToAst('n_T = 3')))).toBe('n_T=3');
    });

    it('round-trips a mixed greek and latin name through LaTeX', () => {
        const src = 'σ_max,Ed = σ_N,Ed + σ_M,Ed';
        const back = latexToCalcpad(astToLatex(calcpadToAst(src)));
        // The comma-subscript form is the one construct still known to drift (the gate
        // marks such lines `lossy`), so assert only that the Greek letters themselves
        // survive -- the bug this replaced collapsed every one of them to `0`.
        expect(back).toContain('σ');
        expect(back).not.toMatch(/\b0\b/);
    });

    it('round-trips a greek name with a subscript and no comma', () => {
        const src = 'σ_max = σ_N + σ_M';
        expect(tight(latexToCalcpad(astToLatex(calcpadToAst(src))))).toBe(tight(src));
    });

    // The regression the browser found: MathLive emits `\sigma` once the user *types* a
    // Greek letter, and the reader turned that into a variable named `sigma`. Editing any
    // Greek equation therefore silently renamed every symbol in it.
    const macroCases: [string, string][] = [
        ['\\sigma_{max}=\\sigma_{N}+\\sigma_{M}\\cdot 2', 'σ_max=σ_N+σ_M*2'],
        ['\\alpha+\\beta=\\gamma', 'α+β=γ'],
        ['\\delta=0.5', 'δ=0.5'],
        ['\\mu\\mathrm{m}', 'μm'],
        ['\\omega^2', 'ω^2'],
        ['\\Gamma_\\Delta', 'Γ_Δ'],
        ['\\epsilon+\\varepsilon', 'ε+ε'],
    ];
    it.each(macroCases)('reads the MathLive macro %s as a Greek letter', (latex, want) => {
        expect(tight(latexToCalcpad(latex))).toBe(tight(want));
    });

    it('never turns a greek macro into a variable of that name', () => {
        for (const [latex] of macroCases) {
            expect(latexToCalcpad(latex)).not.toMatch(/sigma|alpha|beta|gamma|delta|omega/i);
        }
    });
});

describe('element access', () => {
    it('parses x.1 as an index rather than a decimal point', () => {
        expect(calcpadToAst('x.1')).toMatchObject({ type: 'Index', base: { sym: 'x' }, index: { n: 1 } });
        expect(astToCalcpad(calcpadToAst('x.1'))).toBe('x.1');
    });

    it('still reads a decimal point after a number', () => {
        expect(astToCalcpad(calcpadToAst('1.5'))).toBe('1.5');
    });

    it('round-trips an index on a subscripted name', () => {
        expect(astToCalcpad(calcpadToAst('j_e.1'))).toBe('j_e.1');
    });
});

describe('numbers keep the literal the author wrote', () => {
    it('preserves trailing zeros', () => {
        expect(astToCalcpad(calcpadToAst('0.00000'))).toBe('0.00000');
    });

    it('preserves the exponent form', () => {
        expect(astToCalcpad(calcpadToAst('0.0000E0'))).toBe('0.0000E0');
    });

    it('drops the literal once negation changes the value', () => {
        // `-0.00000` must not come back as `0.00000`, nor as a bare `0`.
        expect(astToCalcpad(calcpadToAst('-0.00000'))).toBe('-0.00000');
        expect(astToCalcpad(calcpadToAst('-1.5'))).toBe('-1.5');
    });
});

describe('the line-continuation marker', () => {
    it('keeps a trailing underscore instead of inventing a subscript operand', () => {
        // The engine *defines* the name `V_Rd_c_` by `V_Rd_c_ = 5`, so the `_` is part of
        // the name. The old behaviour invented the operand `0` and printed `V_Rd_c_0`;
        // dropping the `_` instead renamed the variable to `V_Rd_c`. Preserving it is the
        // only spelling that round-trips, and the engine accepts it.
        expect(astToCalcpad(calcpadToAst('V_Rd_c_ = 5'))).toBe('V_Rd_c_=5');
        expect(astToCalcpad(calcpadToAst('max(a; V_Rd_c_)'))).toBe('max(a; V_Rd_c_)');
        expect(astToCalcpad(calcpadToAst('V_Rd_c_ = 5'))).not.toContain('_0');
    });

    it('keeps a trailing underscore on a plain name', () => {
        expect(astToCalcpad(calcpadToAst('h_ = 1'))).toBe('h_=1');
    });

    it('still subscripts when an operand follows', () => {
        expect(astToCalcpad(calcpadToAst('s_1'))).toBe('s_1');
    });
});

describe('grouped exponents', () => {
    it('reprints x^(1/3) without adding a bracket level', () => {
        expect(astToCalcpad(calcpadToAst('x^(1/3)'))).toBe('x^(1 / 3)');
        // One pair of brackets, not two: the old output was `x^((1 / 3))`.
        expect(astToCalcpad(calcpadToAst('x^(1/3)')).match(/\(/g)).toHaveLength(1);
    });
});

describe('worksheet splitting', () => {
    it('separates equations from comments, directives and plots', () => {
        const script = ["'A comment", 'x = 5', '#deg', '$Plot{x^2 @ x = 0:5}', '', 'y = x^2'].join('\n');
        const { equations, other } = splitWorksheet(script);
        expect(equations.map((e) => e.text)).toEqual(['x = 5', 'y = x^2']);
        expect(equations[0].line).toBe(2);
        expect(other).toHaveLength(4);
    });
});

describe('round-trip stability', () => {
    const sources = [
        'x = 5',
        'y = x^2 + 2*x - 1',
        'A = 0.01m^2',
        's_1 = 50m',
        'V = s_1/t_1|km/h',
        'stress = stress(P; A)|MPa',
        'M = w*L^2/8',
        'z = root(x; 3)',
        'q = sqrt(x^2 + y^2)',
    ];

    for (const source of sources) {
        it(`${source}: calcpad -> AST -> calcpad`, () => {
            const ast: MathJSON = calcpadToAst(source);
            expect(tight(astToCalcpad(ast))).toBe(tight(source));
        });

        it(`${source}: calcpad -> AST -> LaTeX -> AST -> calcpad`, () => {
            const first = astToCalcpad(calcpadToAst(source));
            const latex = astToLatex(calcpadToAst(first));
            expect(tight(latexToCalcpad(latex))).toBe(tight(source));
        });

        it(`${source}: emits LaTeX MathLive accepts`, () => {
            expect(validateLatex(calcpadToLatex(source))).toHaveLength(0);
        });
    }
});

describe('matrix literals', () => {
    const rhs = (source: string): MathJSON =>
        (calcpadToAst(source) as { args: [MathJSON, MathJSON] }).args[1];

    it('reads `|` inside brackets as a row divider, not a unit target', () => {
        const node = rhs('M=[3;4;5|5;6;7]');
        expect(node.type).toBe('Matrix');
        expect((node as { rows: MathJSON[][] }).rows.map((r) => r.length)).toEqual([3, 3]);
    });

    it('keeps a single-row literal a vector', () => {
        expect(rhs('V=[1;2;3]').type).toBe('Delimited');
    });

    it('leaves the unit target alone outside brackets', () => {
        const node = calcpadToAst('x = 5|MPa');
        expect(astToCalcpad(node)).toBe('x=5|MPa');
    });

    it('emits a real bmatrix, which MathLive renders as a grid', () => {
        const latex = calcpadToLatex('M=[3;4;5|5;6;7]');
        expect(latex).toBe('M=\\begin{bmatrix}3 & 4 & 5\\\\5 & 6 & 7\\end{bmatrix}');
        expect(validateLatex(latex)).toHaveLength(0);
        // A grid, not a bracketed run of numbers — the rendered shape MathLive produces.
        expect(convertLatexToMathMl(latex)).toContain('<mtable');
    });it('leaves a parenthesised list alone: only brackets make a matrix', () => {
 expect(calcpadToLatex('M=(1;2;3;4)')).not.toContain('\\begin{bmatrix}');
});

    it('round-trips through LaTeX, which is what MathLive hands back on commit', () => {
        const latex = calcpadToLatex('M_TEST=[3;4;5|5;6;7]');
        expect(tight(latexToCalcpad(latex))).toBe(tight('M_TEST=[3;4;5|5;6;7]'));
    });

    it('reads back the \left[\begin{array} form MathLive also emits', () => {
        const latex = String.raw`\left[\begin{array}{cc}1 & 2\\3 & 4\end{array}\right]`;
        expect(tight(latexToCalcpad(latex))).toBe(tight('[1; 2|3; 4]'));
    });

    it('prints rows and cells back in Calcpad spelling', () => {
        expect(astToCalcpad(calcpadToAst('M=[3;4;5|5;6;7]'))).toBe('M=[3; 4; 5|5; 6; 7]');
    });
});


describe('matrix row and column operations', () => {
    const M = 'M=[3;4;5|5;6;7]';

    it('reports the size of the first literal', () => {
        expect(matrixSize(M)).toEqual({ rows: 2, cols: 3 });
        expect(hasMatrix(M)).toBe(true);
        expect(matrixSize('x = 5')).toBeNull();
        expect(hasMatrix('x = 5')).toBe(false);
    });

    it('treats a vector as a one-row matrix, because Calcpad has no separate type', () => {
        expect(matrixSize('V=[1;2;3]')).toEqual({ rows: 1, cols: 3 });
        expect(applyMatrixOp('V=[1;2;3]', 'addRow')).toBe('V=[1; 2; 3|0; 0; 0]');
    });

    it('adds a row of zeros at the bottom', () => {
        expect(applyMatrixOp(M, 'addRow')).toBe('M=[3; 4; 5|5; 6; 7|0; 0; 0]');
    });

    it('removes the last row, printing a one-row result as the vector it is', () => {
        expect(applyMatrixOp(M, 'removeRow')).toBe('M=[3; 4; 5]');
    });

    it('adds and removes a column', () => {
        expect(applyMatrixOp(M, 'addCol')).toBe('M=[3; 4; 5; 0|5; 6; 7; 0]');
        expect(applyMatrixOp(M, 'removeCol')).toBe('M=[3; 4|5; 6]');
    });

    it('refuses to remove the last row or column', () => {
        expect(applyMatrixOp('A=[1]', 'removeRow')).toBe('A=[1]');
        expect(applyMatrixOp('A=[1]', 'removeCol')).toBe('A=[1]');
        expect(applyMatrixOp('A=[1;2]', 'removeRow')).toBe('A=[1;2]');
    });

    it('leaves an expression with no literal untouched', () => {
        expect(applyMatrixOp('x = 5', 'addRow')).toBe('x = 5');
        expect(applyMatrixOp('x = 5', 'addCol')).toBe('x = 5');
    });

    it('resizes the literal inside a larger expression, keeping the rest intact', () => {
        expect(applyMatrixOp('A = B + [1;2|3;4]', 'addRow')).toBe('A=B + [1; 2|3; 4|0; 0]');
    });

    it('pads a ragged literal to the rectangle the engine expects', () => {
        expect(applyMatrixOp('A=[1;2;3|4]', 'addRow')).toBe('A=[1; 2; 3|4|0; 0; 0]');
    });

    it('every result round-trips and is accepted by MathLive', () => {
        for (const op of ['addRow', 'removeRow', 'addCol', 'removeCol'] as MatrixOp[]) {
            const next = applyMatrixOp(M, op);
            expect(tight(astToCalcpad(calcpadToAst(next))), op).toBe(tight(next));
            expect(validateLatex(calcpadToLatex(next)), op).toHaveLength(0);
        }
    });

    it('the engine agrees the resized matrix has the size we claim', () => {
        // Guards the padding rule against the engine's own reading of a literal.
        expect(matrixSize(applyMatrixOp(M, 'addRow'))).toEqual({ rows: 3, cols: 3 });
        expect(matrixSize(applyMatrixOp(M, 'addCol'))).toEqual({ rows: 2, cols: 4 });
        expect(matrixSize(applyMatrixOp(M, 'removeCol'))).toEqual({ rows: 2, cols: 2 });
    });
});
