using Calcpad.Highlighter.Linter.Models;
using Calcpad.Highlighter.Snippets.Models;

namespace Calcpad.Highlighter.Snippets.Data
{
    /// <summary>
    /// Snippet definitions for built-in functions.
    /// </summary>
    public static class FunctionSnippets
    {
        public static readonly SnippetItem[] Items =
        [
            // ============================================
            // TRIGONOMETRIC FUNCTIONS
            // ============================================
            new SnippetItem
            {
                Insert = "sin(§)",
                Description = "Sine",
                Category = "Functions/Trigonometric",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Angle" }]
            },
            new SnippetItem
            {
                Insert = "cos(§)",
                Description = "Cosine",
                Category = "Functions/Trigonometric",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Angle" }]
            },
            new SnippetItem
            {
                Insert = "tan(§)",
                Description = "Tangent",
                Category = "Functions/Trigonometric",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Angle" }]
            },
            new SnippetItem
            {
                Insert = "csc(§)",
                Description = "Cosecant",
                Category = "Functions/Trigonometric",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Angle" }]
            },
            new SnippetItem
            {
                Insert = "sec(§)",
                Description = "Secant",
                Category = "Functions/Trigonometric",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Angle" }]
            },
            new SnippetItem
            {
                Insert = "cot(§)",
                Description = "Cotangent",
                Category = "Functions/Trigonometric",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Angle" }]
            },

            // ============================================
            // INVERSE TRIGONOMETRIC FUNCTIONS
            // ============================================
            new SnippetItem
            {
                Insert = "asin(§)",
                Description = "Inverse sine (arc sine)",
                Category = "Functions/Inverse Trigonometric",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Value in [-1, 1]" }]
            },
            new SnippetItem
            {
                Insert = "acos(§)",
                Description = "Inverse cosine (arc cosine)",
                Category = "Functions/Inverse Trigonometric",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Value in [-1, 1]" }]
            },
            new SnippetItem
            {
                Insert = "atan(§)",
                Description = "Inverse tangent (arc tangent)",
                Category = "Functions/Inverse Trigonometric",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Value" }]
            },
            new SnippetItem
            {
                Insert = "atan2(§; §)",
                Description = "Two-argument arc tangent",
                Category = "Functions/Inverse Trigonometric",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "X coordinate" },
                    new SnippetParameter { Name = "y", Type = ParameterType.Scalar, Description = "Y coordinate" }
                ]
            },
            new SnippetItem
            {
                Insert = "acsc(§)",
                Description = "Inverse cosecant",
                Category = "Functions/Inverse Trigonometric",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Value" }]
            },
            new SnippetItem
            {
                Insert = "asec(§)",
                Description = "Inverse secant",
                Category = "Functions/Inverse Trigonometric",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Value" }]
            },
            new SnippetItem
            {
                Insert = "acot(§)",
                Description = "Inverse cotangent",
                Category = "Functions/Inverse Trigonometric",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Value" }]
            },

            // ============================================
            // HYPERBOLIC FUNCTIONS
            // ============================================
            new SnippetItem
            {
                Insert = "sinh(§)",
                Description = "Hyperbolic sine",
                Category = "Functions/Hyperbolic",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Value" }]
            },
            new SnippetItem
            {
                Insert = "cosh(§)",
                Description = "Hyperbolic cosine",
                Category = "Functions/Hyperbolic",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Value" }]
            },
            new SnippetItem
            {
                Insert = "tanh(§)",
                Description = "Hyperbolic tangent",
                Category = "Functions/Hyperbolic",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Value" }]
            },
            new SnippetItem
            {
                Insert = "csch(§)",
                Description = "Hyperbolic cosecant",
                Category = "Functions/Hyperbolic",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Value" }]
            },
            new SnippetItem
            {
                Insert = "sech(§)",
                Description = "Hyperbolic secant",
                Category = "Functions/Hyperbolic",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Value" }]
            },
            new SnippetItem
            {
                Insert = "coth(§)",
                Description = "Hyperbolic cotangent",
                Category = "Functions/Hyperbolic",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Value" }]
            },

            // ============================================
            // INVERSE HYPERBOLIC FUNCTIONS
            // ============================================
            new SnippetItem
            {
                Insert = "asinh(§)",
                Description = "Inverse hyperbolic sine",
                Category = "Functions/Inverse Hyperbolic",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Value" }]
            },
            new SnippetItem
            {
                Insert = "acosh(§)",
                Description = "Inverse hyperbolic cosine",
                Category = "Functions/Inverse Hyperbolic",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Value ≥ 1" }]
            },
            new SnippetItem
            {
                Insert = "atanh(§)",
                Description = "Inverse hyperbolic tangent",
                Category = "Functions/Inverse Hyperbolic",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Value in (-1, 1)" }]
            },
            new SnippetItem
            {
                Insert = "acsch(§)",
                Description = "Inverse hyperbolic cosecant",
                Category = "Functions/Inverse Hyperbolic",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Value ≠ 0" }]
            },
            new SnippetItem
            {
                Insert = "asech(§)",
                Description = "Inverse hyperbolic secant",
                Category = "Functions/Inverse Hyperbolic",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Value in (0, 1]" }]
            },
            new SnippetItem
            {
                Insert = "acoth(§)",
                Description = "Inverse hyperbolic cotangent",
                Category = "Functions/Inverse Hyperbolic",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Value with |x| > 1" }]
            },

            // ============================================
            // LOGARITHMIC, EXPONENTIAL AND ROOTS
            // ============================================
            new SnippetItem
            {
                Insert = "log(§)",
                Description = "Decimal (base-10) logarithm",
                Category = "Functions/Logarithmic, Exponential and Roots",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Value > 0" }]
            },
            new SnippetItem
            {
                Insert = "ln(§)",
                Description = "Natural logarithm",
                Category = "Functions/Logarithmic, Exponential and Roots",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Value > 0" }]
            },
            new SnippetItem
            {
                Insert = "log_2(§)",
                Description = "Binary (base-2) logarithm",
                Category = "Functions/Logarithmic, Exponential and Roots",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Value > 0" }]
            },
            new SnippetItem
            {
                Insert = "exp(§)",
                Description = "Exponential function (e^x)",
                Category = "Functions/Logarithmic, Exponential and Roots",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Exponent" }]
            },
            new SnippetItem
            {
                Insert = "sqr(§)",
                Description = "Square root",
                Label = "sqr(x)",
                Category = "Functions/Logarithmic, Exponential and Roots",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Value ≥ 0" }]
            },
            new SnippetItem
            {
                Insert = "sqrt(§)",
                Description = "Square root",
                Label = "sqrt(x)",
                Category = "Functions/Logarithmic, Exponential and Roots",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Value ≥ 0" }]
            },
            new SnippetItem
            {
                Insert = "cbrt(§)",
                Description = "Cubic root",
                Category = "Functions/Logarithmic, Exponential and Roots",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Value" }]
            },
            new SnippetItem
            {
                Insert = "root(§; §)",
                Description = "N-th root",
                Category = "Functions/Logarithmic, Exponential and Roots",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Value" },
                    new SnippetParameter { Name = "n", Type = ParameterType.Integer, Description = "Root degree" }
                ]
            },

            // ============================================
            // ROUNDING FUNCTIONS
            // ============================================
            new SnippetItem
            {
                Insert = "round(§)",
                Description = "Round to the nearest integer",
                Category = "Functions/Rounding",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Value" }]
            },
            new SnippetItem
            {
                Insert = "floor(§)",
                Description = "Round down (towards -∞)",
                Category = "Functions/Rounding",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Value" }]
            },
            new SnippetItem
            {
                Insert = "ceiling(§)",
                Description = "Round up (towards +∞)",
                Category = "Functions/Rounding",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Value" }]
            },
            new SnippetItem
            {
                Insert = "trunc(§)",
                Description = "Truncate towards zero",
                Category = "Functions/Rounding",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Value" }]
            },

            // ============================================
            // INTEGER FUNCTIONS
            // ============================================
            new SnippetItem
            {
                Insert = "mod(§; §)",
                Description = "Remainder of integer division",
                Category = "Functions/Integer",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "x", Type = ParameterType.Integer, Description = "Dividend" },
                    new SnippetParameter { Name = "y", Type = ParameterType.Integer, Description = "Divisor" }
                ]
            },
            new SnippetItem
            {
                Insert = "gcd(§; §)",
                Description = "Greatest common divisor",
                Category = "Functions/Integer",
                KeywordType = "Function",
                AcceptsAnyCount = true,
                Parameters =
                [
                    new SnippetParameter { Name = "values", Type = ParameterType.Integer, Description = "Two or more integers", IsVariadic = true }
                ]
            },
            new SnippetItem
            {
                Insert = "lcm(§; §)",
                Description = "Least common multiple",
                Category = "Functions/Integer",
                KeywordType = "Function",
                AcceptsAnyCount = true,
                Parameters =
                [
                    new SnippetParameter { Name = "values", Type = ParameterType.Integer, Description = "Two or more integers", IsVariadic = true }
                ]
            },

            // ============================================
            // COMPLEX NUMBER FUNCTIONS
            // ============================================
            new SnippetItem
            {
                Insert = "re(§)",
                Description = "Real part of a complex number",
                Category = "Functions/Complex",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "z", Type = ParameterType.Scalar, Description = "Complex number" }]
            },
            new SnippetItem
            {
                Insert = "im(§)",
                Description = "Imaginary part of a complex number",
                Category = "Functions/Complex",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "z", Type = ParameterType.Scalar, Description = "Complex number" }]
            },
            new SnippetItem
            {
                Insert = "abs(§)",
                Description = "Absolute value / magnitude",
                Category = "Functions/Complex",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "z", Type = ParameterType.Any, Description = "Value or complex number" }]
            },
            new SnippetItem
            {
                Insert = "phase(§)",
                Description = "Phase angle of a complex number",
                Category = "Functions/Complex",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "z", Type = ParameterType.Scalar, Description = "Complex number" }]
            },
            new SnippetItem
            {
                Insert = "conj(§)",
                Description = "Complex conjugate",
                Category = "Functions/Complex",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "z", Type = ParameterType.Scalar, Description = "Complex number" }]
            },

            // ============================================
            // AGGREGATE AND INTERPOLATION FUNCTIONS
            // ============================================
            // min - variadic (accepts scalars, vectors, matrices)
            new SnippetItem
            {
                Insert = "min(v₁; v₂; ...)",
                Description = "Minimum of multiple values (scalars, vectors, or matrices)",
                Category = "Functions/Aggregate and Interpolation",
                KeywordType = "Function",
                AcceptsAnyCount = true,
                Parameters = [new SnippetParameter { Name = "values", Type = ParameterType.Various, Description = "Values (expanded if vector/matrix)", IsVariadic = true }]
            },
            // min - single vector
            new SnippetItem
            {
                Insert = "min(§)",
                Description = "Minimum element of a vector",
                Category = "Functions/Aggregate and Interpolation",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "v", Type = ParameterType.Vector, Description = "Vector" }]
            },
            // min - single matrix
            new SnippetItem
            {
                Insert = "min(§)",
                Description = "Minimum element of a matrix",
                Category = "Functions/Aggregate and Interpolation",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" }]
            },
            // max - variadic (accepts scalars, vectors, matrices)
            new SnippetItem
            {
                Insert = "max(v₁; v₂; ...)",
                Description = "Maximum of multiple values (scalars, vectors, or matrices)",
                Category = "Functions/Aggregate and Interpolation",
                KeywordType = "Function",
                AcceptsAnyCount = true,
                Parameters = [new SnippetParameter { Name = "values", Type = ParameterType.Various, Description = "Values (expanded if vector/matrix)", IsVariadic = true }]
            },
            // max - single vector
            new SnippetItem
            {
                Insert = "max(§)",
                Description = "Maximum element of a vector",
                Category = "Functions/Aggregate and Interpolation",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "v", Type = ParameterType.Vector, Description = "Vector" }]
            },
            // max - single matrix
            new SnippetItem
            {
                Insert = "max(§)",
                Description = "Maximum element of a matrix",
                Category = "Functions/Aggregate and Interpolation",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" }]
            },
            // sum - variadic (accepts scalars, vectors, matrices)
            new SnippetItem
            {
                Insert = "sum(v₁; v₂; ...)",
                Description = "Sum of multiple values (scalars, vectors, or matrices)",
                Category = "Functions/Aggregate and Interpolation",
                KeywordType = "Function",
                AcceptsAnyCount = true,
                Parameters = [new SnippetParameter { Name = "values", Type = ParameterType.Various, Description = "Values (expanded if vector/matrix)", IsVariadic = true }]
            },
            // sum - single vector
            new SnippetItem
            {
                Insert = "sum(§)",
                Description = "Sum of all elements in a vector",
                Category = "Functions/Aggregate and Interpolation",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "v", Type = ParameterType.Vector, Description = "Vector" }]
            },
            // sum - single matrix
            new SnippetItem
            {
                Insert = "sum(§)",
                Description = "Sum of all elements in a matrix",
                Category = "Functions/Aggregate and Interpolation",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" }]
            },
            // sumsq - variadic (accepts scalars, vectors, matrices)
            new SnippetItem
            {
                Insert = "sumsq(v₁; v₂; ...)",
                Description = "Sum of squares of multiple values (scalars, vectors, or matrices)",
                Category = "Functions/Aggregate and Interpolation",
                KeywordType = "Function",
                AcceptsAnyCount = true,
                Parameters = [new SnippetParameter { Name = "values", Type = ParameterType.Various, Description = "Values (expanded if vector/matrix)", IsVariadic = true }]
            },
            // sumsq - single vector
            new SnippetItem
            {
                Insert = "sumsq(§)",
                Description = "Sum of squares of all elements in a vector",
                Category = "Functions/Aggregate and Interpolation",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "v", Type = ParameterType.Vector, Description = "Vector" }]
            },
            // sumsq - single matrix
            new SnippetItem
            {
                Insert = "sumsq(§)",
                Description = "Sum of squares of all elements in a matrix",
                Category = "Functions/Aggregate and Interpolation",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" }]
            },
            // srss - variadic (accepts scalars, vectors, matrices)
            new SnippetItem
            {
                Insert = "srss(v₁; v₂; ...)",
                Description = "Square root of sum of squares of multiple values (scalars, vectors, or matrices)",
                Category = "Functions/Aggregate and Interpolation",
                KeywordType = "Function",
                AcceptsAnyCount = true,
                Parameters = [new SnippetParameter { Name = "values", Type = ParameterType.Various, Description = "Values (expanded if vector/matrix)", IsVariadic = true }]
            },
            // srss - single vector
            new SnippetItem
            {
                Insert = "srss(§)",
                Description = "Square root of sum of squares of all elements in a vector",
                Category = "Functions/Aggregate and Interpolation",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "v", Type = ParameterType.Vector, Description = "Vector" }]
            },
            // srss - single matrix
            new SnippetItem
            {
                Insert = "srss(§)",
                Description = "Square root of sum of squares of all elements in a matrix",
                Category = "Functions/Aggregate and Interpolation",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" }]
            },
            // average - variadic (accepts scalars, vectors, matrices)
            new SnippetItem
            {
                Insert = "average(v₁; v₂; ...)",
                Description = "Arithmetic mean of multiple values (scalars, vectors, or matrices)",
                Category = "Functions/Aggregate and Interpolation",
                KeywordType = "Function",
                AcceptsAnyCount = true,
                Parameters = [new SnippetParameter { Name = "values", Type = ParameterType.Various, Description = "Values (expanded if vector/matrix)", IsVariadic = true }]
            },
            // average - single vector
            new SnippetItem
            {
                Insert = "average(§)",
                Description = "Arithmetic mean of all elements in a vector",
                Category = "Functions/Aggregate and Interpolation",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "v", Type = ParameterType.Vector, Description = "Vector" }]
            },
            // average - single matrix
            new SnippetItem
            {
                Insert = "average(§)",
                Description = "Arithmetic mean of all elements in a matrix",
                Category = "Functions/Aggregate and Interpolation",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" }]
            },
            // product - variadic (accepts scalars, vectors, matrices)
            new SnippetItem
            {
                Insert = "product(v₁; v₂; ...)",
                Description = "Product of multiple values (scalars, vectors, or matrices)",
                Category = "Functions/Aggregate and Interpolation",
                KeywordType = "Function",
                AcceptsAnyCount = true,
                Parameters = [new SnippetParameter { Name = "values", Type = ParameterType.Various, Description = "Values (expanded if vector/matrix)", IsVariadic = true }]
            },
            // product - single vector
            new SnippetItem
            {
                Insert = "product(§)",
                Description = "Product of all elements in a vector",
                Category = "Functions/Aggregate and Interpolation",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "v", Type = ParameterType.Vector, Description = "Vector" }]
            },
            // product - single matrix
            new SnippetItem
            {
                Insert = "product(§)",
                Description = "Product of all elements in a matrix",
                Category = "Functions/Aggregate and Interpolation",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" }]
            },
            // mean - variadic (accepts scalars, vectors, matrices)
            new SnippetItem
            {
                Insert = "mean(v₁; v₂; ...)",
                Description = "Geometric mean of multiple values (scalars, vectors, or matrices)",
                Category = "Functions/Aggregate and Interpolation",
                KeywordType = "Function",
                AcceptsAnyCount = true,
                Parameters = [new SnippetParameter { Name = "values", Type = ParameterType.Various, Description = "Values (expanded if vector/matrix)", IsVariadic = true }]
            },
            // mean - single vector
            new SnippetItem
            {
                Insert = "mean(§)",
                Description = "Geometric mean of all elements in a vector",
                Category = "Functions/Aggregate and Interpolation",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "v", Type = ParameterType.Vector, Description = "Vector" }]
            },
            // mean - single matrix
            new SnippetItem
            {
                Insert = "mean(§)",
                Description = "Geometric mean of all elements in a matrix",
                Category = "Functions/Aggregate and Interpolation",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" }]
            },
            // take - scalar variadic (n; v1; v2; v3; ...)
            new SnippetItem
            {
                Insert = "take(§; §)",
                Description = "Returns the n-th element from a list of scalars",
                Category = "Functions/Aggregate and Interpolation",
                AcceptsAnyCount = true,
                Parameters =
                [
                    new SnippetParameter { Name = "n", Type = ParameterType.Integer, Description = "Index (1-based)" },
                    new SnippetParameter { Name = "values", Type = ParameterType.Scalar, Description = "Scalar values", IsVariadic = true }
                ]
            },
            // take - from vector (n; vector)
            new SnippetItem
            {
                Insert = "take(§; §)",
                Description = "Returns the n-th element from a vector",
                Category = "Functions/Aggregate and Interpolation",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "n", Type = ParameterType.Integer, Description = "Index (1-based)" },
                    new SnippetParameter { Name = "v", Type = ParameterType.Vector, Description = "Vector" }
                ]
            },
            // line - scalar pairs (x; x1; y1; x2; y2; ...)
            new SnippetItem
            {
                Insert = "line(§; §)",
                Description = "Linear interpolation with scalar data pairs",
                Category = "Functions/Aggregate and Interpolation",
                AcceptsAnyCount = true,
                Parameters =
                [
                    new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Interpolation point" },
                    new SnippetParameter { Name = "data", Type = ParameterType.Scalar, Description = "Data pairs (x1; y1; x2; y2; ...)", IsVariadic = true }
                ]
            },
            // line - with vectors (x; xVector; yVector)
            new SnippetItem
            {
                Insert = "line(§; §; §)",
                Description = "Linear interpolation with x and y vectors",
                Category = "Functions/Aggregate and Interpolation",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Interpolation point" },
                    new SnippetParameter { Name = "xData", Type = ParameterType.Vector, Description = "X data points vector" },
                    new SnippetParameter { Name = "yData", Type = ParameterType.Vector, Description = "Y data points vector" }
                ]
            },
            // spline - scalar pairs (x; x1; y1; x2; y2; ...)
            new SnippetItem
            {
                Insert = "spline(§; §)",
                Description = "Hermite spline interpolation with scalar data pairs",
                Category = "Functions/Aggregate and Interpolation",
                AcceptsAnyCount = true,
                Parameters =
                [
                    new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Interpolation point" },
                    new SnippetParameter { Name = "data", Type = ParameterType.Scalar, Description = "Data pairs (x1; y1; x2; y2; ...)", IsVariadic = true }
                ]
            },
            // spline - with vectors (x; xVector; yVector)
            new SnippetItem
            {
                Insert = "spline(§; §; §)",
                Description = "Hermite spline interpolation with x and y vectors",
                Category = "Functions/Aggregate and Interpolation",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Interpolation point" },
                    new SnippetParameter { Name = "xData", Type = ParameterType.Vector, Description = "X data points vector" },
                    new SnippetParameter { Name = "yData", Type = ParameterType.Vector, Description = "Y data points vector" }
                ]
            },

            // ============================================
            // CONDITIONAL AND LOGICAL FUNCTIONS
            // ============================================
            new SnippetItem
            {
                Insert = "if(§; §; §)",
                Description = "Conditional evaluation",
                Category = "Functions/Conditional and Logical",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "cond", Type = ParameterType.Boolean, Description = "Condition" },
                    new SnippetParameter { Name = "value-if-true", Type = ParameterType.Any, Description = "Value if condition is true" },
                    new SnippetParameter { Name = "value-if-false", Type = ParameterType.Any, Description = "Value if condition is false" }
                ]
            },
            new SnippetItem
            {
                Insert = "switch(c₁; v₁; c₂; v₂; …; def)",
                Description = "Selective evaluation (multiple conditions)",
                Category = "Functions/Conditional and Logical",
                KeywordType = "Function",
                AcceptsAnyCount = true,
                Parameters =
                [
                    new SnippetParameter { Name = "pairs", Type = ParameterType.Various, Description = "Condition/value pairs followed by default value", IsVariadic = true }
                ]
            },
            new SnippetItem
            {
                Insert = "not(§)",
                Description = "Logical NOT",
                Category = "Functions/Conditional and Logical",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "x", Type = ParameterType.Boolean, Description = "Value" }]
            },
            new SnippetItem
            {
                Insert = "and(§; §)",
                Description = "Logical AND of multiple boolean values",
                Category = "Functions/Conditional and Logical",
                KeywordType = "Function",
                AcceptsAnyCount = true,
                Parameters =
                [
                    new SnippetParameter { Name = "values", Type = ParameterType.Boolean, Description = "Boolean values", IsVariadic = true }
                ]
            },
            new SnippetItem
            {
                Insert = "or(§; §)",
                Description = "Logical OR of multiple boolean values",
                Category = "Functions/Conditional and Logical",
                KeywordType = "Function",
                AcceptsAnyCount = true,
                Parameters =
                [
                    new SnippetParameter { Name = "values", Type = ParameterType.Boolean, Description = "Boolean values", IsVariadic = true }
                ]
            },
            new SnippetItem
            {
                Insert = "xor(§; §)",
                Description = "Logical XOR of multiple boolean values",
                Category = "Functions/Conditional and Logical",
                KeywordType = "Function",
                AcceptsAnyCount = true,
                Parameters =
                [
                    new SnippetParameter { Name = "values", Type = ParameterType.Boolean, Description = "Boolean values", IsVariadic = true }
                ]
            },

            // ============================================
            // OTHER FUNCTIONS
            // ============================================
            new SnippetItem
            {
                Insert = "sign(§)",
                Description = "Sign of a number (-1, 0, or 1)",
                Category = "Functions/Other",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Value" }]
            },
            new SnippetItem
            {
                Insert = "random(§)",
                Description = "Random number between 0 and x",
                Category = "Functions/Other",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Upper bound", IsOptional = true }]
            },
            new SnippetItem
            {
                Insert = "getunits(§)",
                Description = "Gets the units of x (returns 1 if unitless)",
                Category = "Functions/Other",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "x", Type = ParameterType.Any, Description = "Value with units" }]
            },
            new SnippetItem
            {
                Insert = "setunits(§; §)",
                Description = "Sets the units to a scalar, vector, or matrix",
                Category = "Functions/Other",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "x", Type = ParameterType.Any, Description = "Value" },
                    new SnippetParameter { Name = "u", Type = ParameterType.Any, Description = "Units to set" }
                ]
            },
            new SnippetItem
            {
                Insert = "clrunits(§)",
                Description = "Clears the units from a scalar, vector, or matrix",
                Category = "Functions/Other",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "x", Type = ParameterType.Any, Description = "Value with units" }]
            },
            new SnippetItem
            {
                Insert = "hp(§)",
                Description = "Converts to high-performance type",
                Category = "Functions/Other",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "x", Type = ParameterType.Any, Description = "Vector or matrix" }]
            },
            new SnippetItem
            {
                Insert = "ishp(§)",
                Description = "Checks if the type is high-performance",
                Category = "Functions/Other",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "x", Type = ParameterType.Any, Description = "Value to check" }]
            },

            // ============================================
            // STRING FUNCTIONS
            // ============================================
            new SnippetItem
            {
                Insert = "len$(§)",
                Description = "Returns the length of a string",
                Category = "Functions/String",
                KeywordType = "Function",
                ReturnType = CalcpadType.Value,
                Parameters = [new SnippetParameter { Name = "s$", Type = ParameterType.String, Description = "String" }]
            },
            new SnippetItem
            {
                Insert = "trim$(§)",
                Description = "Trims whitespace from both ends of a string",
                Category = "Functions/String",
                KeywordType = "Function",
                ReturnType = CalcpadType.StringVariable,
                Parameters = [new SnippetParameter { Name = "s$", Type = ParameterType.String, Description = "String" }]
            },
            new SnippetItem
            {
                Insert = "ltrim$(§)",
                Description = "Trims whitespace from the start of a string",
                Category = "Functions/String",
                KeywordType = "Function",
                ReturnType = CalcpadType.StringVariable,
                Parameters = [new SnippetParameter { Name = "s$", Type = ParameterType.String, Description = "String" }]
            },
            new SnippetItem
            {
                Insert = "rtrim$(§)",
                Description = "Trims whitespace from the end of a string",
                Category = "Functions/String",
                KeywordType = "Function",
                ReturnType = CalcpadType.StringVariable,
                Parameters = [new SnippetParameter { Name = "s$", Type = ParameterType.String, Description = "String" }]
            },
            new SnippetItem
            {
                Insert = "ucase$(§)",
                Description = "Converts a string to upper case",
                Category = "Functions/String",
                KeywordType = "Function",
                ReturnType = CalcpadType.StringVariable,
                Parameters = [new SnippetParameter { Name = "s$", Type = ParameterType.String, Description = "String" }]
            },
            new SnippetItem
            {
                Insert = "lcase$(§)",
                Description = "Converts a string to lower case",
                Category = "Functions/String",
                KeywordType = "Function",
                ReturnType = CalcpadType.StringVariable,
                Parameters = [new SnippetParameter { Name = "s$", Type = ParameterType.String, Description = "String" }]
            },
            new SnippetItem
            {
                Insert = "string$(§)",
                Description = "Converts a value to its string representation (without units)",
                Category = "Functions/String",
                KeywordType = "Function",
                ReturnType = CalcpadType.StringVariable,
                Parameters = [new SnippetParameter { Name = "x", Type = ParameterType.Any, Description = "Value to convert" }]
            },
            new SnippetItem
            {
                Insert = "string$(§; 'true')",
                Description = "Converts a value to its string representation including units",
                Label = "string$ (with units)",
                Category = "Functions/String",
                KeywordType = "Function",
                ReturnType = CalcpadType.StringVariable,
                Parameters =
                [
                    new SnippetParameter { Name = "x", Type = ParameterType.Any, Description = "Value to convert" },
                    new SnippetParameter { Name = "includeUnits", Type = ParameterType.String, Description = "'true' to include units, 'false' to exclude" }
                ]
            },
            new SnippetItem
            {
                Insert = "val$(§)",
                Description = "Parses a string to a numeric value",
                Category = "Functions/String",
                KeywordType = "Function",
                ReturnType = CalcpadType.Value,
                Parameters = [new SnippetParameter { Name = "s$", Type = ParameterType.String, Description = "String to parse" }]
            },
            new SnippetItem
            {
                Insert = "left$(§; §)",
                Description = "Returns the leftmost characters of a string",
                Category = "Functions/String",
                KeywordType = "Function",
                ReturnType = CalcpadType.StringVariable,
                Parameters =
                [
                    new SnippetParameter { Name = "s$", Type = ParameterType.String, Description = "String" },
                    new SnippetParameter { Name = "count", Type = ParameterType.Integer, Description = "Number of characters" }
                ]
            },
            new SnippetItem
            {
                Insert = "right$(§; §)",
                Description = "Returns the rightmost characters of a string",
                Category = "Functions/String",
                KeywordType = "Function",
                ReturnType = CalcpadType.StringVariable,
                Parameters =
                [
                    new SnippetParameter { Name = "s$", Type = ParameterType.String, Description = "String" },
                    new SnippetParameter { Name = "count", Type = ParameterType.Integer, Description = "Number of characters" }
                ]
            },
            new SnippetItem
            {
                Insert = "compare$(§; §)",
                Description = "Compares two strings (-1, 0, or 1)",
                Category = "Functions/String",
                KeywordType = "Function",
                ReturnType = CalcpadType.Value,
                Parameters =
                [
                    new SnippetParameter { Name = "a$", Type = ParameterType.String, Description = "First string" },
                    new SnippetParameter { Name = "b$", Type = ParameterType.String, Description = "Second string" }
                ]
            },
            new SnippetItem
            {
                Insert = "space$(§)",
                Description = "Creates a string of spaces",
                Category = "Functions/String",
                KeywordType = "Function",
                ReturnType = CalcpadType.StringVariable,
                Parameters = [new SnippetParameter { Name = "count", Type = ParameterType.Integer, Description = "Number of spaces" }]
            },
            new SnippetItem
            {
                Insert = "mid$(§; §; §)",
                Description = "Extracts a substring from a string",
                Category = "Functions/String",
                KeywordType = "Function",
                ReturnType = CalcpadType.StringVariable,
                Parameters =
                [
                    new SnippetParameter { Name = "s$", Type = ParameterType.String, Description = "String" },
                    new SnippetParameter { Name = "start", Type = ParameterType.Integer, Description = "Start position (1-based)" },
                    new SnippetParameter { Name = "count", Type = ParameterType.Integer, Description = "Number of characters" }
                ]
            },
            new SnippetItem
            {
                Insert = "replace$(§; §; §)",
                Description = "Replaces all occurrences of a substring",
                Category = "Functions/String",
                KeywordType = "Function",
                ReturnType = CalcpadType.StringVariable,
                Parameters =
                [
                    new SnippetParameter { Name = "s$", Type = ParameterType.String, Description = "Source string" },
                    new SnippetParameter { Name = "old$", Type = ParameterType.String, Description = "String to find" },
                    new SnippetParameter { Name = "new$", Type = ParameterType.String, Description = "Replacement string" }
                ]
            },
            new SnippetItem
            {
                Insert = "instr$(§; §; §)",
                Description = "Finds the position of a substring (1-based, 0 if not found)",
                Category = "Functions/String",
                KeywordType = "Function",
                ReturnType = CalcpadType.Value,
                Parameters =
                [
                    new SnippetParameter { Name = "start", Type = ParameterType.Integer, Description = "Start position (1-based)" },
                    new SnippetParameter { Name = "s$", Type = ParameterType.String, Description = "String to search in" },
                    new SnippetParameter { Name = "search$", Type = ParameterType.String, Description = "String to find" }
                ]
            },
            new SnippetItem
            {
                Insert = "find$(§; §)",
                Description = "Finds all positions of a substring, returns a vector",
                Category = "Functions/String",
                KeywordType = "Function",
                ReturnType = CalcpadType.Value,
                Parameters =
                [
                    new SnippetParameter { Name = "search$", Type = ParameterType.String, Description = "String to find" },
                    new SnippetParameter { Name = "s$", Type = ParameterType.String, Description = "String to search in" }
                ]
            },
            new SnippetItem
            {
                Insert = "concat$(§; §)",
                Description = "Concatenates multiple strings",
                Category = "Functions/String",
                KeywordType = "Function",
                ReturnType = CalcpadType.StringVariable,
                Parameters =
                [
                    new SnippetParameter { Name = "values", Type = ParameterType.Any, Description = "Strings to concatenate", IsVariadic = true }
                ]
            },

            // ============================================
            // JSON FUNCTIONS
            // ============================================
            new SnippetItem
            {
                Insert = "parsejson$(§; §)",
                Description = "Parses a JSON string and extracts a value at the given path",
                Category = "Functions/String",
                KeywordType = "Function",
                ReturnType = CalcpadType.StringVariable,
                Parameters =
                [
                    new SnippetParameter { Name = "json$", Type = ParameterType.String, Description = "JSON string to parse" },
                    new SnippetParameter { Name = "path$", Type = ParameterType.String, Description = "Path to value (e.g., \"key\", \"nested.arr[0]\")" }
                ]
            },

            // ============================================
            // STRING TABLE FUNCTIONS
            // ============================================
            new SnippetItem
            {
                Insert = "table$(§; §)",
                Description = "Creates an empty string table with the specified dimensions",
                Category = "Functions/String",
                KeywordType = "Function",
                ReturnType = CalcpadType.StringTable,
                Parameters =
                [
                    new SnippetParameter { Name = "rows", Type = ParameterType.Integer, Description = "Number of rows" },
                    new SnippetParameter { Name = "cols", Type = ParameterType.Integer, Description = "Number of columns" }
                ]
            },
            new SnippetItem
            {
                Insert = "split$(§; §; §)",
                Description = "Splits a string into a table using row and column delimiters",
                Category = "Functions/String",
                KeywordType = "Function",
                ReturnType = CalcpadType.StringTable,
                Parameters =
                [
                    new SnippetParameter { Name = "s$", Type = ParameterType.String, Description = "String to split" },
                    new SnippetParameter { Name = "rowDelim$", Type = ParameterType.String, Description = "Row delimiter" },
                    new SnippetParameter { Name = "colDelim$", Type = ParameterType.String, Description = "Column delimiter" }
                ]
            },
            new SnippetItem
            {
                Insert = "join$(§; §; §)",
                Description = "Joins a table into a string using row and column delimiters",
                Category = "Functions/String",
                KeywordType = "Function",
                ReturnType = CalcpadType.StringVariable,
                Parameters =
                [
                    new SnippetParameter { Name = "t$", Type = ParameterType.StringTable, Description = "Table to join" },
                    new SnippetParameter { Name = "rowDelim$", Type = ParameterType.String, Description = "Row delimiter", IsOptional = true },
                    new SnippetParameter { Name = "colDelim$", Type = ParameterType.String, Description = "Column delimiter", IsOptional = true }
                ]
            },
            new SnippetItem
            {
                Insert = "rowToStringArray$(§; §)",
                Description = "Extracts a row from a table as a JSON string array (e.g., [\"a\", \"b\", \"c\"])",
                Category = "Functions/String",
                KeywordType = "Function",
                ReturnType = CalcpadType.StringVariable,
                Parameters =
                [
                    new SnippetParameter { Name = "t$", Type = ParameterType.StringTable, Description = "Table variable" },
                    new SnippetParameter { Name = "row", Type = ParameterType.Integer, Description = "Row index (1-based)" }
                ]
            },
            new SnippetItem
            {
                Insert = "colToStringArray$(§; §)",
                Description = "Extracts a column from a table as a JSON string array (e.g., [\"a\", \"b\", \"c\"])",
                Category = "Functions/String",
                KeywordType = "Function",
                ReturnType = CalcpadType.StringVariable,
                Parameters =
                [
                    new SnippetParameter { Name = "t$", Type = ParameterType.StringTable, Description = "Table variable" },
                    new SnippetParameter { Name = "col", Type = ParameterType.Integer, Description = "Column index (1-based)" }
                ]
            },
            new SnippetItem
            {
                Insert = "tableToStringArray$(§)",
                Description = "Converts an entire table to a nested JSON string array (e.g., [[\"a\",\"b\"],[\"c\",\"d\"]])",
                Category = "Functions/String",
                KeywordType = "Function",
                ReturnType = CalcpadType.StringVariable,
                Parameters =
                [
                    new SnippetParameter { Name = "t$", Type = ParameterType.StringTable, Description = "Table variable" }
                ]
            },
            new SnippetItem
            {
                Insert = "typeOf$(§)",
                Description = "Returns the type of an expression as a string (value, complex, vector, matrix, string, table, or undefined)",
                Category = "Functions/String",
                KeywordType = "Function",
                ReturnType = CalcpadType.StringVariable,
                Parameters =
                [
                    new SnippetParameter { Name = "expr", Type = ParameterType.Any, Description = "Expression or variable to check" }
                ]
            },

            // ============================================
            // STRING TABLE MANIPULATION FUNCTIONS
            // ============================================
            new SnippetItem
            {
                Insert = "augmentT$(§; §)",
                Description = "Concatenates two or more tables horizontally (side by side)",
                Category = "Functions/String",
                KeywordType = "Function",
                ReturnType = CalcpadType.StringTable,
                Parameters =
                [
                    new SnippetParameter { Name = "t1$", Type = ParameterType.StringTable, Description = "First table" },
                    new SnippetParameter { Name = "t2$", Type = ParameterType.StringTable, Description = "Second table (more can follow)" }
                ]
            },
            new SnippetItem
            {
                Insert = "stackT$(§; §)",
                Description = "Concatenates two or more tables vertically (stacked)",
                Category = "Functions/String",
                KeywordType = "Function",
                ReturnType = CalcpadType.StringTable,
                Parameters =
                [
                    new SnippetParameter { Name = "t1$", Type = ParameterType.StringTable, Description = "First table" },
                    new SnippetParameter { Name = "t2$", Type = ParameterType.StringTable, Description = "Second table (more can follow)" }
                ]
            },
            new SnippetItem
            {
                Insert = "rowT$(§; §)",
                Description = "Extracts a single row from a table as a 1-row table",
                Category = "Functions/String",
                KeywordType = "Function",
                ReturnType = CalcpadType.StringTable,
                Parameters =
                [
                    new SnippetParameter { Name = "t$", Type = ParameterType.StringTable, Description = "Table variable" },
                    new SnippetParameter { Name = "row", Type = ParameterType.Integer, Description = "Row index (1-based)" }
                ]
            },
            new SnippetItem
            {
                Insert = "colT$(§; §)",
                Description = "Extracts a single column from a table as a 1-column table",
                Category = "Functions/String",
                KeywordType = "Function",
                ReturnType = CalcpadType.StringTable,
                Parameters =
                [
                    new SnippetParameter { Name = "t$", Type = ParameterType.StringTable, Description = "Table variable" },
                    new SnippetParameter { Name = "col", Type = ParameterType.Integer, Description = "Column index (1-based)" }
                ]
            },
            new SnippetItem
            {
                Insert = "extractRowsT$(§; [§])",
                Description = "Extracts multiple rows from a table by index",
                Category = "Functions/String",
                KeywordType = "Function",
                ReturnType = CalcpadType.StringTable,
                Parameters =
                [
                    new SnippetParameter { Name = "t$", Type = ParameterType.StringTable, Description = "Table variable" },
                    new SnippetParameter { Name = "indices", Type = ParameterType.Vector, Description = "Row indices (1-based, e.g., [1; 3; 5])" }
                ]
            },
            new SnippetItem
            {
                Insert = "extractColsT$(§; [§])",
                Description = "Extracts multiple columns from a table by index",
                Category = "Functions/String",
                KeywordType = "Function",
                ReturnType = CalcpadType.StringTable,
                Parameters =
                [
                    new SnippetParameter { Name = "t$", Type = ParameterType.StringTable, Description = "Table variable" },
                    new SnippetParameter { Name = "indices", Type = ParameterType.Vector, Description = "Column indices (1-based, e.g., [1; 3; 5])" }
                ]
            },
            new SnippetItem
            {
                Insert = "subTable$(§; §; §; §; §)",
                Description = "Extracts a rectangular sub-table by row and column bounds",
                Category = "Functions/String",
                KeywordType = "Function",
                ReturnType = CalcpadType.StringTable,
                Parameters =
                [
                    new SnippetParameter { Name = "t$", Type = ParameterType.StringTable, Description = "Table variable" },
                    new SnippetParameter { Name = "r1", Type = ParameterType.Integer, Description = "Starting row (1-based)" },
                    new SnippetParameter { Name = "c1", Type = ParameterType.Integer, Description = "Starting column (1-based)" },
                    new SnippetParameter { Name = "r2", Type = ParameterType.Integer, Description = "Ending row (1-based)" },
                    new SnippetParameter { Name = "c2", Type = ParameterType.Integer, Description = "Ending column (1-based)" }
                ]
            },
            new SnippetItem
            {
                Insert = "transposeT$(§)",
                Description = "Transposes a table (swaps rows and columns)",
                Category = "Functions/String",
                KeywordType = "Function",
                ReturnType = CalcpadType.StringTable,
                Parameters =
                [
                    new SnippetParameter { Name = "t$", Type = ParameterType.StringTable, Description = "Table variable" }
                ]
            }
        ];
    }
}