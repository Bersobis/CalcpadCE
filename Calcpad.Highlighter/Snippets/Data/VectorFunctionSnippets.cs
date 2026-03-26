using Calcpad.Highlighter.Linter.Models;
using Calcpad.Highlighter.Snippets.Models;

namespace Calcpad.Highlighter.Snippets.Data
{
    /// <summary>
    /// Snippet definitions for vector functions.
    /// All functions in this file return vectors unless otherwise noted.
    /// </summary>
    public static class VectorFunctionSnippets
    {
        public static readonly SnippetItem[] Items =
        [
            // ============================================
            // VECTOR CREATIONAL FUNCTIONS
            // ============================================
            new SnippetItem
            {
                Insert = "vector(§)",
                Description = "Creates an empty vector with length n",
                Category = "Functions/Vector/Creational",
                KeywordType = "Function",
                ReturnType = CalcpadType.Vector,
                Parameters = [new SnippetParameter { Name = "n", Type = ParameterType.Integer, Description = "Length of vector" }]
            },
            new SnippetItem
            {
                Insert = "vector_hp(§)",
                Description = "Creates an empty high-performance vector with length n",
                Category = "Functions/Vector/Creational",
                KeywordType = "Function",
                ReturnType = CalcpadType.Vector,
                Parameters = [new SnippetParameter { Name = "n", Type = ParameterType.Integer, Description = "Length of vector" }]
            },
            new SnippetItem
            {
                Insert = "range(§; §; §)",
                Description = "Creates a vector with values from x1 to xn with step s",
                Category = "Functions/Vector/Creational",
                KeywordType = "Function",
                ReturnType = CalcpadType.Vector,
                Parameters =
                [
                    new SnippetParameter { Name = "x1", Type = ParameterType.Scalar, Description = "Start value" },
                    new SnippetParameter { Name = "xn", Type = ParameterType.Scalar, Description = "End value" },
                    new SnippetParameter { Name = "s", Type = ParameterType.Scalar, Description = "Step", IsOptional = true }
                ]
            },
            new SnippetItem
            {
                Insert = "range_hp(§; §; §)",
                Description = "Creates a high-performance vector from a range",
                Category = "Functions/Vector/Creational",
                KeywordType = "Function",
                ReturnType = CalcpadType.Vector,
                Parameters =
                [
                    new SnippetParameter { Name = "x1", Type = ParameterType.Scalar, Description = "Start value" },
                    new SnippetParameter { Name = "xn", Type = ParameterType.Scalar, Description = "End value" },
                    new SnippetParameter { Name = "s", Type = ParameterType.Scalar, Description = "Step", IsOptional = true }
                ]
            },

            // ============================================
            // VECTOR STRUCTURAL FUNCTIONS
            // ============================================
            new SnippetItem
            {
                Insert = "len(§)",
                Description = "Returns the length of the vector",
                Category = "Functions/Vector/Structural",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "v", Type = ParameterType.Vector, Description = "Vector" }]
            },
            new SnippetItem
            {
                Insert = "size(§)",
                Description = "Returns the actual size (index of last non-zero element)",
                Category = "Functions/Vector/Structural",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "v", Type = ParameterType.Vector, Description = "Vector" }]
            },
            new SnippetItem
            {
                Insert = "resize(§; §)",
                Description = "Sets a new length for the vector",
                Category = "Functions/Vector/Structural",
                KeywordType = "Function",
                ReturnType = CalcpadType.Vector,
                Parameters =
                [
                    new SnippetParameter { Name = "v", Type = ParameterType.Vector, Description = "Vector" },
                    new SnippetParameter { Name = "n", Type = ParameterType.Integer, Description = "New length" }
                ]
            },
            new SnippetItem
            {
                Insert = "fill(§; §)",
                Description = "Fills the vector with a value",
                Category = "Functions/Vector/Structural",
                KeywordType = "Function",
                ReturnType = CalcpadType.Vector,
                Parameters =
                [
                    new SnippetParameter { Name = "v", Type = ParameterType.Vector, Description = "Vector" },
                    new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Fill value" }
                ]
            },
            new SnippetItem
            {
                Insert = "join(§)",
                Description = "Creates a vector by joining matrices, vectors, and scalars",
                Category = "Functions/Vector/Structural",
                KeywordType = "Function",
                ReturnType = CalcpadType.Vector,
                AcceptsAnyCount = true,
                Parameters = [new SnippetParameter { Name = "items", Type = ParameterType.Various, Description = "Matrices, vectors, and scalars to join", IsVariadic = true }]
            },
            new SnippetItem
            {
                Insert = "slice(§; §; §)",
                Description = "Returns part of vector bounded by indexes i1 and i2",
                Category = "Functions/Vector/Structural",
                KeywordType = "Function",
                ReturnType = CalcpadType.Vector,
                Parameters =
                [
                    new SnippetParameter { Name = "v", Type = ParameterType.Vector, Description = "Vector" },
                    new SnippetParameter { Name = "i1", Type = ParameterType.Integer, Description = "Start index" },
                    new SnippetParameter { Name = "i2", Type = ParameterType.Integer, Description = "End index" }
                ]
            },
            new SnippetItem
            {
                Insert = "first(§; §)",
                Description = "Returns the first n elements of the vector",
                Category = "Functions/Vector/Structural",
                KeywordType = "Function",
                ReturnType = CalcpadType.Vector,
                Parameters =
                [
                    new SnippetParameter { Name = "v", Type = ParameterType.Vector, Description = "Vector" },
                    new SnippetParameter { Name = "n", Type = ParameterType.Integer, Description = "Number of elements" }
                ]
            },
            new SnippetItem
            {
                Insert = "last(§; §)",
                Description = "Returns the last n elements of the vector",
                Category = "Functions/Vector/Structural",
                KeywordType = "Function",
                ReturnType = CalcpadType.Vector,
                Parameters =
                [
                    new SnippetParameter { Name = "v", Type = ParameterType.Vector, Description = "Vector" },
                    new SnippetParameter { Name = "n", Type = ParameterType.Integer, Description = "Number of elements" }
                ]
            },
            new SnippetItem
            {
                Insert = "extract(§; §)",
                Description = "Extracts elements from v whose indexes are in i",
                Category = "Functions/Vector/Structural",
                KeywordType = "Function",
                ReturnType = CalcpadType.Vector,
                Parameters =
                [
                    new SnippetParameter { Name = "v", Type = ParameterType.Vector, Description = "Source vector" },
                    new SnippetParameter { Name = "i", Type = ParameterType.Vector, Description = "Index vector" }
                ]
            },

            // ============================================
            // VECTOR DATA FUNCTIONS
            // ============================================
            new SnippetItem
            {
                Insert = "sort(§)",
                Description = "Sorts the vector in ascending order",
                Category = "Functions/Vector/Data",
                KeywordType = "Function",
                ReturnType = CalcpadType.Vector,
                Parameters = [new SnippetParameter { Name = "v", Type = ParameterType.Vector, Description = "Vector to sort" }]
            },
            new SnippetItem
            {
                Insert = "rsort(§)",
                Description = "Sorts the vector in descending order",
                Category = "Functions/Vector/Data",
                KeywordType = "Function",
                ReturnType = CalcpadType.Vector,
                Parameters = [new SnippetParameter { Name = "v", Type = ParameterType.Vector, Description = "Vector to sort" }]
            },
            new SnippetItem
            {
                Insert = "order(§)",
                Description = "Returns indexes in ascending order by element values",
                Category = "Functions/Vector/Data",
                KeywordType = "Function",
                ReturnType = CalcpadType.Vector,
                Parameters = [new SnippetParameter { Name = "v", Type = ParameterType.Vector, Description = "Vector" }]
            },
            new SnippetItem
            {
                Insert = "revorder(§)",
                Description = "Returns indexes in descending order by element values",
                Category = "Functions/Vector/Data",
                KeywordType = "Function",
                ReturnType = CalcpadType.Vector,
                Parameters = [new SnippetParameter { Name = "v", Type = ParameterType.Vector, Description = "Vector" }]
            },
            new SnippetItem
            {
                Insert = "reverse(§)",
                Description = "Returns vector with elements in reverse order",
                Category = "Functions/Vector/Data",
                KeywordType = "Function",
                ReturnType = CalcpadType.Vector,
                Parameters = [new SnippetParameter { Name = "v", Type = ParameterType.Vector, Description = "Vector" }]
            },
            new SnippetItem
            {
                Insert = "count(§; §; §)",
                Description = "Counts elements equal to x starting from index i",
                Category = "Functions/Vector/Data",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "v", Type = ParameterType.Vector, Description = "Vector" },
                    new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Value to count" },
                    new SnippetParameter { Name = "i", Type = ParameterType.Integer, Description = "Start index" }
                ]
            },
            new SnippetItem
            {
                Insert = "search(§; §; §)",
                Description = "Returns index of first element equal to x starting from i",
                Category = "Functions/Vector/Data",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "v", Type = ParameterType.Vector, Description = "Vector" },
                    new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Value to find" },
                    new SnippetParameter { Name = "i", Type = ParameterType.Integer, Description = "Start index" }
                ]
            },

            // Vector Find Functions - all return vectors of indices
            new SnippetItem
            {
                Insert = "find(§; §; §)",
                Description = "Returns indexes of elements equal to x after index i",
                Category = "Functions/Vector/Data",
                KeywordType = "Function",
                ReturnType = CalcpadType.Vector,
                Parameters =
                [
                    new SnippetParameter { Name = "v", Type = ParameterType.Vector, Description = "Vector" },
                    new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Value" },
                    new SnippetParameter { Name = "i", Type = ParameterType.Integer, Description = "Start index" }
                ]
            },
            new SnippetItem
            {
                Insert = "find_eq(§; §; §)",
                Description = "Returns indexes of elements = x after index i",
                Category = "Functions/Vector/Data",
                KeywordType = "Function",
                ReturnType = CalcpadType.Vector,
                Parameters =
                [
                    new SnippetParameter { Name = "v", Type = ParameterType.Vector, Description = "Vector" },
                    new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Value" },
                    new SnippetParameter { Name = "i", Type = ParameterType.Integer, Description = "Start index" }
                ]
            },
            new SnippetItem
            {
                Insert = "find_ne(§; §; §)",
                Description = "Returns indexes of elements != x after index i",
                Category = "Functions/Vector/Data",
                KeywordType = "Function",
                ReturnType = CalcpadType.Vector,
                Parameters =
                [
                    new SnippetParameter { Name = "v", Type = ParameterType.Vector, Description = "Vector" },
                    new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Value" },
                    new SnippetParameter { Name = "i", Type = ParameterType.Integer, Description = "Start index" }
                ]
            },
            new SnippetItem
            {
                Insert = "find_lt(§; §; §)",
                Description = "Returns indexes of elements < x after index i",
                Category = "Functions/Vector/Data",
                KeywordType = "Function",
                ReturnType = CalcpadType.Vector,
                Parameters =
                [
                    new SnippetParameter { Name = "v", Type = ParameterType.Vector, Description = "Vector" },
                    new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Value" },
                    new SnippetParameter { Name = "i", Type = ParameterType.Integer, Description = "Start index" }
                ]
            },
            new SnippetItem
            {
                Insert = "find_le(§; §; §)",
                Description = "Returns indexes of elements <= x after index i",
                Category = "Functions/Vector/Data",
                KeywordType = "Function",
                ReturnType = CalcpadType.Vector,
                Parameters =
                [
                    new SnippetParameter { Name = "v", Type = ParameterType.Vector, Description = "Vector" },
                    new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Value" },
                    new SnippetParameter { Name = "i", Type = ParameterType.Integer, Description = "Start index" }
                ]
            },
            new SnippetItem
            {
                Insert = "find_gt(§; §; §)",
                Description = "Returns indexes of elements > x after index i",
                Category = "Functions/Vector/Data",
                KeywordType = "Function",
                ReturnType = CalcpadType.Vector,
                Parameters =
                [
                    new SnippetParameter { Name = "v", Type = ParameterType.Vector, Description = "Vector" },
                    new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Value" },
                    new SnippetParameter { Name = "i", Type = ParameterType.Integer, Description = "Start index" }
                ]
            },
            new SnippetItem
            {
                Insert = "find_ge(§; §; §)",
                Description = "Returns indexes of elements >= x after index i",
                Category = "Functions/Vector/Data",
                KeywordType = "Function",
                ReturnType = CalcpadType.Vector,
                Parameters =
                [
                    new SnippetParameter { Name = "v", Type = ParameterType.Vector, Description = "Vector" },
                    new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Value" },
                    new SnippetParameter { Name = "i", Type = ParameterType.Integer, Description = "Start index" }
                ]
            },

            // Vector Lookup Functions
            new SnippetItem
            {
                Insert = "lookup(§; §; §)",
                Description = "Elements of a where corresponding elements of b equal x",
                Category = "Functions/Vector/Data",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "a", Type = ParameterType.Vector, Description = "Result vector" },
                    new SnippetParameter { Name = "b", Type = ParameterType.Vector, Description = "Lookup vector" },
                    new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Lookup value" }
                ]
            },
            new SnippetItem
            {
                Insert = "lookup_eq(§; §; §)",
                Description = "Elements of a where b elements = x",
                Category = "Functions/Vector/Data",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "a", Type = ParameterType.Vector, Description = "Result vector" },
                    new SnippetParameter { Name = "b", Type = ParameterType.Vector, Description = "Lookup vector" },
                    new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Lookup value" }
                ]
            },
            new SnippetItem
            {
                Insert = "lookup_ne(§; §; §)",
                Description = "Elements of a where b elements != x",
                Category = "Functions/Vector/Data",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "a", Type = ParameterType.Vector, Description = "Result vector" },
                    new SnippetParameter { Name = "b", Type = ParameterType.Vector, Description = "Lookup vector" },
                    new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Lookup value" }
                ]
            },
            new SnippetItem
            {
                Insert = "lookup_lt(§; §; §)",
                Description = "Elements of a where b elements < x",
                Category = "Functions/Vector/Data",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "a", Type = ParameterType.Vector, Description = "Result vector" },
                    new SnippetParameter { Name = "b", Type = ParameterType.Vector, Description = "Lookup vector" },
                    new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Lookup value" }
                ]
            },
            new SnippetItem
            {
                Insert = "lookup_le(§; §; §)",
                Description = "Elements of a where b elements <= x",
                Category = "Functions/Vector/Data",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "a", Type = ParameterType.Vector, Description = "Result vector" },
                    new SnippetParameter { Name = "b", Type = ParameterType.Vector, Description = "Lookup vector" },
                    new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Lookup value" }
                ]
            },
            new SnippetItem
            {
                Insert = "lookup_gt(§; §; §)",
                Description = "Elements of a where b elements > x",
                Category = "Functions/Vector/Data",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "a", Type = ParameterType.Vector, Description = "Result vector" },
                    new SnippetParameter { Name = "b", Type = ParameterType.Vector, Description = "Lookup vector" },
                    new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Lookup value" }
                ]
            },
            new SnippetItem
            {
                Insert = "lookup_ge(§; §; §)",
                Description = "Elements of a where b elements >= x",
                Category = "Functions/Vector/Data",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "a", Type = ParameterType.Vector, Description = "Result vector" },
                    new SnippetParameter { Name = "b", Type = ParameterType.Vector, Description = "Lookup vector" },
                    new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Lookup value" }
                ]
            },

            // ============================================
            // VECTOR MATH FUNCTIONS
            // ============================================
            new SnippetItem
            {
                Insert = "norm(§)",
                Description = "L2 (Euclidean) norm of vector",
                Category = "Functions/Vector/Math",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "v", Type = ParameterType.Vector, Description = "Vector" }]
            },
            new SnippetItem
            {
                Insert = "norm_1(§)",
                Description = "L1 (Manhattan) norm of vector",
                Category = "Functions/Vector/Math",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "v", Type = ParameterType.Vector, Description = "Vector" }]
            },
            new SnippetItem
            {
                Insert = "norm_2(§)",
                Description = "L2 (Euclidean) norm of vector",
                Category = "Functions/Vector/Math",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "v", Type = ParameterType.Vector, Description = "Vector" }]
            },
            new SnippetItem
            {
                Insert = "norm_e(§)",
                Description = "L2 (Euclidean) norm of vector",
                Category = "Functions/Vector/Math",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "v", Type = ParameterType.Vector, Description = "Vector" }]
            },
            new SnippetItem
            {
                Insert = "norm_p(§; §)",
                Description = "Lp norm of vector",
                Category = "Functions/Vector/Math",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "v", Type = ParameterType.Vector, Description = "Vector" },
                    new SnippetParameter { Name = "p", Type = ParameterType.Scalar, Description = "Norm order" }
                ]
            },
            new SnippetItem
            {
                Insert = "norm_i(§)",
                Description = "L-infinity norm of vector",
                Category = "Functions/Vector/Math",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "v", Type = ParameterType.Vector, Description = "Vector" }]
            },
            new SnippetItem
            {
                Insert = "unit(§)",
                Description = "Normalized vector (with L2 norm = 1)",
                Category = "Functions/Vector/Math",
                KeywordType = "Function",
                ReturnType = CalcpadType.Vector,
                Parameters = [new SnippetParameter { Name = "v", Type = ParameterType.Vector, Description = "Vector" }]
            },
            new SnippetItem
            {
                Insert = "dot(§; §)",
                Description = "Scalar (dot) product of two vectors",
                Category = "Functions/Vector/Math",
                KeywordType = "Function",
                // dot returns a scalar, not a vector
                Parameters =
                [
                    new SnippetParameter { Name = "a", Type = ParameterType.Vector, Description = "First vector" },
                    new SnippetParameter { Name = "b", Type = ParameterType.Vector, Description = "Second vector" }
                ]
            },
            new SnippetItem
            {
                Insert = "cross(§; §)",
                Description = "Cross product of two vectors (length 2 or 3)",
                Category = "Functions/Vector/Math",
                KeywordType = "Function",
                ReturnType = CalcpadType.Vector,
                Parameters =
                [
                    new SnippetParameter { Name = "a", Type = ParameterType.Vector, Description = "First vector" },
                    new SnippetParameter { Name = "b", Type = ParameterType.Vector, Description = "Second vector" }
                ]
            }
        ];
    }
}