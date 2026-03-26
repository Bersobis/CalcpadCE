using Calcpad.Highlighter.Linter.Models;
using Calcpad.Highlighter.Snippets.Models;

namespace Calcpad.Highlighter.Snippets.Data
{
    /// <summary>
    /// Snippet definitions for matrix functions.
    /// Most functions in this file return matrices unless otherwise noted (e.g., det, rank return scalars).
    /// </summary>
    public static class MatrixFunctionSnippets
    {
        public static readonly SnippetItem[] Items =
        [
            // ============================================
            // MATRIX CREATIONAL FUNCTIONS
            // ============================================
            new SnippetItem
            {
                Insert = "matrix(§; §)",
                Description = "Creates an empty matrix with dimensions m x n",
                Category = "Functions/Matrix/Creational",
                KeywordType = "Function",
                ReturnType = CalcpadType.Matrix,
                Parameters =
                [
                    new SnippetParameter { Name = "m", Type = ParameterType.Integer, Description = "Number of rows" },
                    new SnippetParameter { Name = "n", Type = ParameterType.Integer, Description = "Number of columns" }
                ]
            },
            new SnippetItem
            {
                Insert = "identity(§)",
                Description = "Creates an identity matrix with dimensions n x n",
                Category = "Functions/Matrix/Creational",
                KeywordType = "Function",
                ReturnType = CalcpadType.Matrix,
                Parameters = [new SnippetParameter { Name = "n", Type = ParameterType.Integer, Description = "Size" }]
            },
            new SnippetItem
            {
                Insert = "diagonal(§; §)",
                Description = "Creates a diagonal matrix n x n filled with value d",
                Category = "Functions/Matrix/Creational",
                KeywordType = "Function",
                ReturnType = CalcpadType.Matrix,
                Parameters =
                [
                    new SnippetParameter { Name = "n", Type = ParameterType.Integer, Description = "Size" },
                    new SnippetParameter { Name = "d", Type = ParameterType.Scalar, Description = "Diagonal value" }
                ]
            },
            new SnippetItem
            {
                Insert = "column(§; §)",
                Description = "Creates a column matrix m x 1 filled with value c",
                Category = "Functions/Matrix/Creational",
                KeywordType = "Function",
                ReturnType = CalcpadType.Matrix,
                Parameters =
                [
                    new SnippetParameter { Name = "m", Type = ParameterType.Integer, Description = "Number of rows" },
                    new SnippetParameter { Name = "c", Type = ParameterType.Scalar, Description = "Fill value" }
                ]
            },
            new SnippetItem
            {
                Insert = "utriang(§)",
                Description = "Creates an upper triangular matrix n x n",
                Category = "Functions/Matrix/Creational",
                KeywordType = "Function",
                ReturnType = CalcpadType.Matrix,
                Parameters = [new SnippetParameter { Name = "n", Type = ParameterType.Integer, Description = "Size" }]
            },
            new SnippetItem
            {
                Insert = "ltriang(§)",
                Description = "Creates a lower triangular matrix n x n",
                Category = "Functions/Matrix/Creational",
                KeywordType = "Function",
                ReturnType = CalcpadType.Matrix,
                Parameters = [new SnippetParameter { Name = "n", Type = ParameterType.Integer, Description = "Size" }]
            },
            new SnippetItem
            {
                Insert = "symmetric(§)",
                Description = "Creates a symmetric matrix n x n",
                Category = "Functions/Matrix/Creational",
                KeywordType = "Function",
                ReturnType = CalcpadType.Matrix,
                Parameters = [new SnippetParameter { Name = "n", Type = ParameterType.Integer, Description = "Size" }]
            },

            // High-Performance Matrix Creation
            new SnippetItem
            {
                Insert = "matrix_hp(§; §)",
                Description = "Creates a high-performance matrix m x n",
                Category = "Functions/Matrix/Creational",
                KeywordType = "Function",
                ReturnType = CalcpadType.Matrix,
                Parameters =
                [
                    new SnippetParameter { Name = "m", Type = ParameterType.Integer, Description = "Number of rows" },
                    new SnippetParameter { Name = "n", Type = ParameterType.Integer, Description = "Number of columns" }
                ]
            },
            new SnippetItem
            {
                Insert = "identity_hp(§)",
                Description = "Creates a high-performance identity matrix n x n",
                Category = "Functions/Matrix/Creational",
                KeywordType = "Function",
                ReturnType = CalcpadType.Matrix,
                Parameters = [new SnippetParameter { Name = "n", Type = ParameterType.Integer, Description = "Size" }]
            },
            new SnippetItem
            {
                Insert = "diagonal_hp(§; §)",
                Description = "Creates a high-performance diagonal matrix n x n",
                Category = "Functions/Matrix/Creational",
                KeywordType = "Function",
                ReturnType = CalcpadType.Matrix,
                Parameters =
                [
                    new SnippetParameter { Name = "n", Type = ParameterType.Integer, Description = "Size" },
                    new SnippetParameter { Name = "d", Type = ParameterType.Scalar, Description = "Diagonal value" }
                ]
            },
            new SnippetItem
            {
                Insert = "column_hp(§; §)",
                Description = "Creates a high-performance column matrix m x 1",
                Category = "Functions/Matrix/Creational",
                KeywordType = "Function",
                ReturnType = CalcpadType.Matrix,
                Parameters =
                [
                    new SnippetParameter { Name = "m", Type = ParameterType.Integer, Description = "Number of rows" },
                    new SnippetParameter { Name = "c", Type = ParameterType.Scalar, Description = "Fill value" }
                ]
            },
            new SnippetItem
            {
                Insert = "utriang_hp(§)",
                Description = "Creates a high-performance upper triangular matrix",
                Category = "Functions/Matrix/Creational",
                KeywordType = "Function",
                ReturnType = CalcpadType.Matrix,
                Parameters = [new SnippetParameter { Name = "n", Type = ParameterType.Integer, Description = "Size" }]
            },
            new SnippetItem
            {
                Insert = "ltriang_hp(§)",
                Description = "Creates a high-performance lower triangular matrix",
                Category = "Functions/Matrix/Creational",
                KeywordType = "Function",
                ReturnType = CalcpadType.Matrix,
                Parameters = [new SnippetParameter { Name = "n", Type = ParameterType.Integer, Description = "Size" }]
            },
            new SnippetItem
            {
                Insert = "symmetric_hp(§)",
                Description = "Creates a high-performance symmetric matrix",
                Category = "Functions/Matrix/Creational",
                KeywordType = "Function",
                ReturnType = CalcpadType.Matrix,
                Parameters = [new SnippetParameter { Name = "n", Type = ParameterType.Integer, Description = "Size" }]
            },

            // Vector to Matrix Conversion
            new SnippetItem
            {
                Insert = "vec2diag(§)",
                Description = "Creates a diagonal matrix from vector elements",
                Category = "Functions/Matrix/Creational",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "v", Type = ParameterType.Vector, Description = "Source vector" }]
            },
            new SnippetItem
            {
                Insert = "vec2row(§)",
                Description = "Creates a row matrix from vector elements",
                Category = "Functions/Matrix/Creational",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "v", Type = ParameterType.Vector, Description = "Source vector" }]
            },
            new SnippetItem
            {
                Insert = "vec2col(§)",
                Description = "Creates a column matrix from vector elements",
                Category = "Functions/Matrix/Creational",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "v", Type = ParameterType.Vector, Description = "Source vector" }]
            },
            new SnippetItem
            {
                Insert = "join_cols(§; §)",
                Description = "Creates a matrix by joining column vectors",
                Category = "Functions/Matrix/Creational",
                KeywordType = "Function",
                AcceptsAnyCount = true,
                Parameters = [new SnippetParameter { Name = "columns", Type = ParameterType.Vector, Description = "Column vectors", IsVariadic = true }]
            },
            new SnippetItem
            {
                Insert = "join_rows(§; §)",
                Description = "Creates a matrix by joining row vectors",
                Category = "Functions/Matrix/Creational",
                KeywordType = "Function",
                AcceptsAnyCount = true,
                Parameters = [new SnippetParameter { Name = "rows", Type = ParameterType.Vector, Description = "Row vectors", IsVariadic = true }]
            },
            new SnippetItem
            {
                Insert = "augment(§; §)",
                Description = "Creates a matrix by appending matrices side by side",
                Category = "Functions/Matrix/Creational",
                KeywordType = "Function",
                AcceptsAnyCount = true,
                Parameters = [new SnippetParameter { Name = "matrices", Type = ParameterType.Matrix, Description = "Matrices to append", IsVariadic = true }]
            },
            new SnippetItem
            {
                Insert = "stack(§; §)",
                Description = "Creates a matrix by stacking matrices vertically",
                Category = "Functions/Matrix/Creational",
                KeywordType = "Function",
                AcceptsAnyCount = true,
                Parameters = [new SnippetParameter { Name = "matrices", Type = ParameterType.Matrix, Description = "Matrices to stack", IsVariadic = true }]
            },

            // ============================================
            // MATRIX STRUCTURAL FUNCTIONS
            // ============================================
            new SnippetItem
            {
                Insert = "n_rows(§)",
                Description = "Number of rows in matrix M",
                Category = "Functions/Matrix/Structural",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" }]
            },
            new SnippetItem
            {
                Insert = "n_cols(§)",
                Description = "Number of columns in matrix M",
                Category = "Functions/Matrix/Structural",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" }]
            },
            new SnippetItem
            {
                Insert = "mresize(§; §; §)",
                Description = "Sets new dimensions m and n for matrix M",
                Category = "Functions/Matrix/Structural",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" },
                    new SnippetParameter { Name = "m", Type = ParameterType.Integer, Description = "New row count" },
                    new SnippetParameter { Name = "n", Type = ParameterType.Integer, Description = "New column count" }
                ]
            },
            new SnippetItem
            {
                Insert = "mfill(§; §)",
                Description = "Fills the matrix M with value x",
                Category = "Functions/Matrix/Structural",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" },
                    new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Fill value" }
                ]
            },
            new SnippetItem
            {
                Insert = "fill_row(§; §; §)",
                Description = "Fills the i-th row of matrix M with value x",
                Category = "Functions/Matrix/Structural",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" },
                    new SnippetParameter { Name = "i", Type = ParameterType.Integer, Description = "Row index" },
                    new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Fill value" }
                ]
            },
            new SnippetItem
            {
                Insert = "fill_col(§; §; §)",
                Description = "Fills the j-th column of matrix M with value x",
                Category = "Functions/Matrix/Structural",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" },
                    new SnippetParameter { Name = "j", Type = ParameterType.Integer, Description = "Column index" },
                    new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Fill value" }
                ]
            },
            new SnippetItem
            {
                Insert = "copy(§; §; §; §)",
                Description = "Copies all elements from A to B starting at indexes i, j",
                Category = "Functions/Matrix/Structural",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "A", Type = ParameterType.Matrix, Description = "Source matrix" },
                    new SnippetParameter { Name = "B", Type = ParameterType.Matrix, Description = "Destination matrix" },
                    new SnippetParameter { Name = "i", Type = ParameterType.Integer, Description = "Start row" },
                    new SnippetParameter { Name = "j", Type = ParameterType.Integer, Description = "Start column" }
                ]
            },
            new SnippetItem
            {
                Insert = "add(§; §; §; §)",
                Description = "Adds elements from A to B starting at indexes i, j",
                Category = "Functions/Matrix/Structural",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "A", Type = ParameterType.Matrix, Description = "Source matrix" },
                    new SnippetParameter { Name = "B", Type = ParameterType.Matrix, Description = "Destination matrix" },
                    new SnippetParameter { Name = "i", Type = ParameterType.Integer, Description = "Start row" },
                    new SnippetParameter { Name = "j", Type = ParameterType.Integer, Description = "Start column" }
                ]
            },
            new SnippetItem
            {
                Insert = "row(§; §)",
                Description = "Extracts the i-th row of matrix M as a vector",
                Category = "Functions/Matrix/Structural",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" },
                    new SnippetParameter { Name = "i", Type = ParameterType.Integer, Description = "Row index" }
                ]
            },
            new SnippetItem
            {
                Insert = "col(§; §)",
                Description = "Extracts the j-th column of matrix M as a vector",
                Category = "Functions/Matrix/Structural",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" },
                    new SnippetParameter { Name = "j", Type = ParameterType.Integer, Description = "Column index" }
                ]
            },
            new SnippetItem
            {
                Insert = "extract_rows(§; §)",
                Description = "Extracts rows from M whose indexes are in vector i",
                Category = "Functions/Matrix/Structural",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" },
                    new SnippetParameter { Name = "i", Type = ParameterType.Vector, Description = "Row index vector" }
                ]
            },
            new SnippetItem
            {
                Insert = "extract_cols(§; §)",
                Description = "Extracts columns from M whose indexes are in vector j",
                Category = "Functions/Matrix/Structural",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" },
                    new SnippetParameter { Name = "j", Type = ParameterType.Vector, Description = "Column index vector" }
                ]
            },
            new SnippetItem
            {
                Insert = "diag2vec(§)",
                Description = "Extracts diagonal elements of matrix M to a vector",
                Category = "Functions/Matrix/Structural",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" }]
            },
            new SnippetItem
            {
                Insert = "submatrix(§; §; §; §; §)",
                Description = "Extracts submatrix bounded by rows i1-i2 and columns j1-j2",
                Category = "Functions/Matrix/Structural",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" },
                    new SnippetParameter { Name = "i1", Type = ParameterType.Integer, Description = "Start row" },
                    new SnippetParameter { Name = "i2", Type = ParameterType.Integer, Description = "End row" },
                    new SnippetParameter { Name = "j1", Type = ParameterType.Integer, Description = "Start column" },
                    new SnippetParameter { Name = "j2", Type = ParameterType.Integer, Description = "End column" }
                ]
            },

            // ============================================
            // MATRIX DATA FUNCTIONS
            // ============================================
            new SnippetItem
            {
                Insert = "sort_cols(§; §)",
                Description = "Sorts columns based on values in row i (ascending)",
                Category = "Functions/Matrix/Data",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" },
                    new SnippetParameter { Name = "i", Type = ParameterType.Integer, Description = "Row index for sorting" }
                ]
            },
            new SnippetItem
            {
                Insert = "rsort_cols(§; §)",
                Description = "Sorts columns based on values in row i (descending)",
                Category = "Functions/Matrix/Data",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" },
                    new SnippetParameter { Name = "i", Type = ParameterType.Integer, Description = "Row index for sorting" }
                ]
            },
            new SnippetItem
            {
                Insert = "sort_rows(§; §)",
                Description = "Sorts rows based on values in column j (ascending)",
                Category = "Functions/Matrix/Data",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" },
                    new SnippetParameter { Name = "j", Type = ParameterType.Integer, Description = "Column index for sorting" }
                ]
            },
            new SnippetItem
            {
                Insert = "rsort_rows(§; §)",
                Description = "Sorts rows based on values in column j (descending)",
                Category = "Functions/Matrix/Data",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" },
                    new SnippetParameter { Name = "j", Type = ParameterType.Integer, Description = "Column index for sorting" }
                ]
            },
            new SnippetItem
            {
                Insert = "order_cols(§; §)",
                Description = "Column indexes in ascending order by row i values",
                Category = "Functions/Matrix/Data",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" },
                    new SnippetParameter { Name = "i", Type = ParameterType.Integer, Description = "Row index" }
                ]
            },
            new SnippetItem
            {
                Insert = "revorder_cols(§; §)",
                Description = "Column indexes in descending order by row i values",
                Category = "Functions/Matrix/Data",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" },
                    new SnippetParameter { Name = "i", Type = ParameterType.Integer, Description = "Row index" }
                ]
            },
            new SnippetItem
            {
                Insert = "order_rows(§; §)",
                Description = "Row indexes in ascending order by column j values",
                Category = "Functions/Matrix/Data",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" },
                    new SnippetParameter { Name = "j", Type = ParameterType.Integer, Description = "Column index" }
                ]
            },
            new SnippetItem
            {
                Insert = "revorder_rows(§; §)",
                Description = "Row indexes in descending order by column j values",
                Category = "Functions/Matrix/Data",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" },
                    new SnippetParameter { Name = "j", Type = ParameterType.Integer, Description = "Column index" }
                ]
            },
            new SnippetItem
            {
                Insert = "mcount(§; §)",
                Description = "Number of occurrences of value x in matrix M",
                Category = "Functions/Matrix/Data",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" },
                    new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Value to count" }
                ]
            },
            new SnippetItem
            {
                Insert = "msearch(§; §; §; §)",
                Description = "Vector with indexes of first occurrence of x starting from i, j",
                Category = "Functions/Matrix/Data",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" },
                    new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Value to find" },
                    new SnippetParameter { Name = "i", Type = ParameterType.Integer, Description = "Start row" },
                    new SnippetParameter { Name = "j", Type = ParameterType.Integer, Description = "Start column" }
                ]
            },

            // Matrix Find Functions
            new SnippetItem
            {
                Insert = "mfind(§; §)",
                Description = "Indexes of all elements in M equal to x",
                Category = "Functions/Matrix/Data",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" },
                    new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Value" }
                ]
            },
            new SnippetItem
            {
                Insert = "mfind_eq(§; §)",
                Description = "Indexes of elements = x",
                Category = "Functions/Matrix/Data",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" },
                    new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Value" }
                ]
            },
            new SnippetItem
            {
                Insert = "mfind_ne(§; §)",
                Description = "Indexes of elements != x",
                Category = "Functions/Matrix/Data",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" },
                    new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Value" }
                ]
            },
            new SnippetItem
            {
                Insert = "mfind_lt(§; §)",
                Description = "Indexes of elements < x",
                Category = "Functions/Matrix/Data",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" },
                    new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Value" }
                ]
            },
            new SnippetItem
            {
                Insert = "mfind_le(§; §)",
                Description = "Indexes of elements <= x",
                Category = "Functions/Matrix/Data",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" },
                    new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Value" }
                ]
            },
            new SnippetItem
            {
                Insert = "mfind_gt(§; §)",
                Description = "Indexes of elements > x",
                Category = "Functions/Matrix/Data",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" },
                    new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Value" }
                ]
            },
            new SnippetItem
            {
                Insert = "mfind_ge(§; §)",
                Description = "Indexes of elements >= x",
                Category = "Functions/Matrix/Data",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" },
                    new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Value" }
                ]
            },

            // Matrix Lookup Functions - Horizontal
            new SnippetItem
            {
                Insert = "hlookup(§; §; §; §)",
                Description = "Values from row i2 where row i1 elements = x",
                Category = "Functions/Matrix/Data",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" },
                    new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Lookup value" },
                    new SnippetParameter { Name = "i1", Type = ParameterType.Integer, Description = "Lookup row" },
                    new SnippetParameter { Name = "i2", Type = ParameterType.Integer, Description = "Result row" }
                ]
            },
            new SnippetItem
            {
                Insert = "hlookup_eq(§; §; §; §)",
                Description = "Values from row i2 where row i1 = x",
                Category = "Functions/Matrix/Data",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" },
                    new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Lookup value" },
                    new SnippetParameter { Name = "i1", Type = ParameterType.Integer, Description = "Lookup row" },
                    new SnippetParameter { Name = "i2", Type = ParameterType.Integer, Description = "Result row" }
                ]
            },
            new SnippetItem
            {
                Insert = "hlookup_ne(§; §; §; §)",
                Description = "Values from row i2 where row i1 != x",
                Category = "Functions/Matrix/Data",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" },
                    new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Lookup value" },
                    new SnippetParameter { Name = "i1", Type = ParameterType.Integer, Description = "Lookup row" },
                    new SnippetParameter { Name = "i2", Type = ParameterType.Integer, Description = "Result row" }
                ]
            },
            new SnippetItem
            {
                Insert = "hlookup_lt(§; §; §; §)",
                Description = "Values from row i2 where row i1 < x",
                Category = "Functions/Matrix/Data",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" },
                    new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Lookup value" },
                    new SnippetParameter { Name = "i1", Type = ParameterType.Integer, Description = "Lookup row" },
                    new SnippetParameter { Name = "i2", Type = ParameterType.Integer, Description = "Result row" }
                ]
            },
            new SnippetItem
            {
                Insert = "hlookup_le(§; §; §; §)",
                Description = "Values from row i2 where row i1 <= x",
                Category = "Functions/Matrix/Data",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" },
                    new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Lookup value" },
                    new SnippetParameter { Name = "i1", Type = ParameterType.Integer, Description = "Lookup row" },
                    new SnippetParameter { Name = "i2", Type = ParameterType.Integer, Description = "Result row" }
                ]
            },
            new SnippetItem
            {
                Insert = "hlookup_gt(§; §; §; §)",
                Description = "Values from row i2 where row i1 > x",
                Category = "Functions/Matrix/Data",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" },
                    new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Lookup value" },
                    new SnippetParameter { Name = "i1", Type = ParameterType.Integer, Description = "Lookup row" },
                    new SnippetParameter { Name = "i2", Type = ParameterType.Integer, Description = "Result row" }
                ]
            },
            new SnippetItem
            {
                Insert = "hlookup_ge(§; §; §; §)",
                Description = "Values from row i2 where row i1 >= x",
                Category = "Functions/Matrix/Data",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" },
                    new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Lookup value" },
                    new SnippetParameter { Name = "i1", Type = ParameterType.Integer, Description = "Lookup row" },
                    new SnippetParameter { Name = "i2", Type = ParameterType.Integer, Description = "Result row" }
                ]
            },

            // Matrix Lookup Functions - Vertical
            new SnippetItem
            {
                Insert = "vlookup(§; §; §; §)",
                Description = "Values from column j2 where column j1 = x",
                Category = "Functions/Matrix/Data",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" },
                    new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Lookup value" },
                    new SnippetParameter { Name = "j1", Type = ParameterType.Integer, Description = "Lookup column" },
                    new SnippetParameter { Name = "j2", Type = ParameterType.Integer, Description = "Result column" }
                ]
            },
            new SnippetItem
            {
                Insert = "vlookup_eq(§; §; §; §)",
                Description = "Values from column j2 where column j1 = x",
                Category = "Functions/Matrix/Data",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" },
                    new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Lookup value" },
                    new SnippetParameter { Name = "j1", Type = ParameterType.Integer, Description = "Lookup column" },
                    new SnippetParameter { Name = "j2", Type = ParameterType.Integer, Description = "Result column" }
                ]
            },
            new SnippetItem
            {
                Insert = "vlookup_ne(§; §; §; §)",
                Description = "Values from column j2 where column j1 != x",
                Category = "Functions/Matrix/Data",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" },
                    new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Lookup value" },
                    new SnippetParameter { Name = "j1", Type = ParameterType.Integer, Description = "Lookup column" },
                    new SnippetParameter { Name = "j2", Type = ParameterType.Integer, Description = "Result column" }
                ]
            },
            new SnippetItem
            {
                Insert = "vlookup_lt(§; §; §; §)",
                Description = "Values from column j2 where column j1 < x",
                Category = "Functions/Matrix/Data",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" },
                    new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Lookup value" },
                    new SnippetParameter { Name = "j1", Type = ParameterType.Integer, Description = "Lookup column" },
                    new SnippetParameter { Name = "j2", Type = ParameterType.Integer, Description = "Result column" }
                ]
            },
            new SnippetItem
            {
                Insert = "vlookup_le(§; §; §; §)",
                Description = "Values from column j2 where column j1 <= x",
                Category = "Functions/Matrix/Data",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" },
                    new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Lookup value" },
                    new SnippetParameter { Name = "j1", Type = ParameterType.Integer, Description = "Lookup column" },
                    new SnippetParameter { Name = "j2", Type = ParameterType.Integer, Description = "Result column" }
                ]
            },
            new SnippetItem
            {
                Insert = "vlookup_gt(§; §; §; §)",
                Description = "Values from column j2 where column j1 > x",
                Category = "Functions/Matrix/Data",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" },
                    new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Lookup value" },
                    new SnippetParameter { Name = "j1", Type = ParameterType.Integer, Description = "Lookup column" },
                    new SnippetParameter { Name = "j2", Type = ParameterType.Integer, Description = "Result column" }
                ]
            },
            new SnippetItem
            {
                Insert = "vlookup_ge(§; §; §; §)",
                Description = "Values from column j2 where column j1 >= x",
                Category = "Functions/Matrix/Data",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" },
                    new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Lookup value" },
                    new SnippetParameter { Name = "j1", Type = ParameterType.Integer, Description = "Lookup column" },
                    new SnippetParameter { Name = "j2", Type = ParameterType.Integer, Description = "Result column" }
                ]
            },

            // ============================================
            // MATRIX MATH FUNCTIONS
            // ============================================
            new SnippetItem
            {
                Insert = "hprod(§; §)",
                Description = "Hadamard (element-wise) product of matrices A and B",
                Category = "Functions/Matrix/Math",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "A", Type = ParameterType.Matrix, Description = "First matrix" },
                    new SnippetParameter { Name = "B", Type = ParameterType.Matrix, Description = "Second matrix" }
                ]
            },
            new SnippetItem
            {
                Insert = "fprod(§; §)",
                Description = "Frobenius product of matrices A and B",
                Category = "Functions/Matrix/Math",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "A", Type = ParameterType.Matrix, Description = "First matrix" },
                    new SnippetParameter { Name = "B", Type = ParameterType.Matrix, Description = "Second matrix" }
                ]
            },
            new SnippetItem
            {
                Insert = "kprod(§; §)",
                Description = "Kronecker product of matrices A and B",
                Category = "Functions/Matrix/Math",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "A", Type = ParameterType.Matrix, Description = "First matrix" },
                    new SnippetParameter { Name = "B", Type = ParameterType.Matrix, Description = "Second matrix" }
                ]
            },

            // Matrix Norms
            new SnippetItem
            {
                Insert = "mnorm(§)",
                Description = "L2 norm of matrix M",
                Category = "Functions/Matrix/Math",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" }]
            },
            new SnippetItem
            {
                Insert = "mnorm_1(§)",
                Description = "L1 norm of matrix M",
                Category = "Functions/Matrix/Math",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" }]
            },
            new SnippetItem
            {
                Insert = "mnorm_2(§)",
                Description = "L2 norm of matrix M",
                Category = "Functions/Matrix/Math",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" }]
            },
            new SnippetItem
            {
                Insert = "mnorm_e(§)",
                Description = "Frobenius norm of matrix M",
                Category = "Functions/Matrix/Math",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" }]
            },
            new SnippetItem
            {
                Insert = "mnorm_i(§)",
                Description = "L-infinity norm of matrix M",
                Category = "Functions/Matrix/Math",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" }]
            },

            // Condition Numbers
            new SnippetItem
            {
                Insert = "cond(§)",
                Description = "Condition number based on L2 norm",
                Category = "Functions/Matrix/Math",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" }]
            },
            new SnippetItem
            {
                Insert = "cond_1(§)",
                Description = "Condition number based on L1 norm",
                Category = "Functions/Matrix/Math",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" }]
            },
            new SnippetItem
            {
                Insert = "cond_2(§)",
                Description = "Condition number based on L2 norm",
                Category = "Functions/Matrix/Math",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" }]
            },
            new SnippetItem
            {
                Insert = "cond_e(§)",
                Description = "Condition number based on Frobenius norm",
                Category = "Functions/Matrix/Math",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" }]
            },
            new SnippetItem
            {
                Insert = "cond_i(§)",
                Description = "Condition number based on L-infinity norm",
                Category = "Functions/Matrix/Math",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" }]
            },

            // Matrix Properties
            new SnippetItem
            {
                Insert = "det(§)",
                Description = "Determinant of matrix M",
                Category = "Functions/Matrix/Math",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Square matrix" }]
            },
            new SnippetItem
            {
                Insert = "rank(§)",
                Description = "Rank of matrix M",
                Category = "Functions/Matrix/Math",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" }]
            },
            new SnippetItem
            {
                Insert = "trace(§)",
                Description = "Trace of matrix M (sum of diagonal elements)",
                Category = "Functions/Matrix/Math",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Square matrix" }]
            },
            new SnippetItem
            {
                Insert = "transp(§)",
                Description = "Transpose of matrix M",
                Category = "Functions/Matrix/Math",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" }]
            },
            new SnippetItem
            {
                Insert = "adj(§)",
                Description = "Adjugate of matrix M",
                Category = "Functions/Matrix/Math",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Square matrix" }]
            },
            new SnippetItem
            {
                Insert = "cofactor(§)",
                Description = "Cofactor matrix of M",
                Category = "Functions/Matrix/Math",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Square matrix" }]
            },

            // Eigenvalues and Eigenvectors
            new SnippetItem
            {
                Insert = "eigenvals(§; §)",
                Description = "First ne eigenvalues of matrix M (or all if omitted)",
                Category = "Functions/Matrix/Math",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Square matrix" },
                    new SnippetParameter { Name = "ne", Type = ParameterType.Integer, Description = "Number of eigenvalues", IsOptional = true }
                ]
            },
            new SnippetItem
            {
                Insert = "eigenvecs(§; §)",
                Description = "First ne eigenvectors of matrix M (or all if omitted)",
                Category = "Functions/Matrix/Math",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Square matrix" },
                    new SnippetParameter { Name = "ne", Type = ParameterType.Integer, Description = "Number of eigenvectors", IsOptional = true }
                ]
            },
            new SnippetItem
            {
                Insert = "eigen(§; §)",
                Description = "First ne eigenvalues and eigenvectors (or all if omitted)",
                Category = "Functions/Matrix/Math",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Square matrix" },
                    new SnippetParameter { Name = "ne", Type = ParameterType.Integer, Description = "Number", IsOptional = true }
                ]
            },

            // Matrix Decompositions
            new SnippetItem
            {
                Insert = "cholesky(§)",
                Description = "Cholesky decomposition of symmetric positive-definite matrix",
                Category = "Functions/Matrix/Math",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Symmetric positive-definite matrix" }]
            },
            new SnippetItem
            {
                Insert = "lu(§)",
                Description = "LU decomposition of matrix M",
                Category = "Functions/Matrix/Math",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Square matrix" }]
            },
            new SnippetItem
            {
                Insert = "qr(§)",
                Description = "QR decomposition of matrix M",
                Category = "Functions/Matrix/Math",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" }]
            },
            new SnippetItem
            {
                Insert = "svd(§)",
                Description = "Singular value decomposition of M",
                Category = "Functions/Matrix/Math",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" }]
            },

            // Linear Solvers
            new SnippetItem
            {
                Insert = "inverse(§)",
                Description = "Inverse of matrix M",
                Category = "Functions/Matrix/Math",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Square matrix" }]
            },
            new SnippetItem
            {
                Insert = "lsolve(§; §)",
                Description = "Solves Ax = b using LDLT (symmetric) or LU decomposition",
                Category = "Functions/Matrix/Math",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "A", Type = ParameterType.Matrix, Description = "Coefficient matrix" },
                    new SnippetParameter { Name = "b", Type = ParameterType.Vector, Description = "Right-hand side" }
                ]
            },
            new SnippetItem
            {
                Insert = "clsolve(§; §)",
                Description = "Solves Ax = b using Cholesky decomposition",
                Category = "Functions/Matrix/Math",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "A", Type = ParameterType.Matrix, Description = "Symmetric positive-definite matrix" },
                    new SnippetParameter { Name = "b", Type = ParameterType.Vector, Description = "Right-hand side" }
                ]
            },
            new SnippetItem
            {
                Insert = "slsolve(§; §)",
                Description = "Solves Ax = b using preconditioned conjugate gradient",
                Category = "Functions/Matrix/Math",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "A", Type = ParameterType.Matrix, Description = "HP symmetric positive-definite matrix" },
                    new SnippetParameter { Name = "b", Type = ParameterType.Vector, Description = "Right-hand side" }
                ]
            },
            new SnippetItem
            {
                Insert = "msolve(§; §)",
                Description = "Solves AX = B using LDLT or LU decomposition",
                Category = "Functions/Matrix/Math",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "A", Type = ParameterType.Matrix, Description = "Coefficient matrix" },
                    new SnippetParameter { Name = "B", Type = ParameterType.Matrix, Description = "Right-hand side matrix" }
                ]
            },
            new SnippetItem
            {
                Insert = "cmsolve(§; §)",
                Description = "Solves AX = B using Cholesky decomposition",
                Category = "Functions/Matrix/Math",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "A", Type = ParameterType.Matrix, Description = "Symmetric positive-definite matrix" },
                    new SnippetParameter { Name = "B", Type = ParameterType.Matrix, Description = "Right-hand side matrix" }
                ]
            },
            new SnippetItem
            {
                Insert = "smsolve(§; §)",
                Description = "Solves AX = B using preconditioned conjugate gradient",
                Category = "Functions/Matrix/Math",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "A", Type = ParameterType.Matrix, Description = "HP symmetric positive-definite matrix" },
                    new SnippetParameter { Name = "B", Type = ParameterType.Matrix, Description = "Right-hand side matrix" }
                ]
            },

            // FFT
            new SnippetItem
            {
                Insert = "fft(§)",
                Description = "Fast Fourier transform (1 row for real, 2 for complex)",
                Category = "Functions/Matrix/Math",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Row-major matrix" }]
            },
            new SnippetItem
            {
                Insert = "ift(§)",
                Description = "Inverse Fourier transform (1 row for real, 2 for complex)",
                Category = "Functions/Matrix/Math",
                KeywordType = "Function",
                Parameters = [new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Row-major matrix" }]
            },

            // Double Interpolation
            new SnippetItem
            {
                Insert = "take(§; §; §)",
                Description = "Returns element of matrix M at indexes x and y",
                Category = "Functions/Matrix/Math",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "Row index" },
                    new SnippetParameter { Name = "y", Type = ParameterType.Scalar, Description = "Column index" },
                    new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" }
                ]
            },
            new SnippetItem
            {
                Insert = "line(§; §; §)",
                Description = "Double linear interpolation from matrix M",
                Category = "Functions/Matrix/Math",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "X coordinate" },
                    new SnippetParameter { Name = "y", Type = ParameterType.Scalar, Description = "Y coordinate" },
                    new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" }
                ]
            },
            new SnippetItem
            {
                Insert = "spline(§; §; §)",
                Description = "Double Hermite spline interpolation from matrix M",
                Category = "Functions/Matrix/Math",
                KeywordType = "Function",
                Parameters =
                [
                    new SnippetParameter { Name = "x", Type = ParameterType.Scalar, Description = "X coordinate" },
                    new SnippetParameter { Name = "y", Type = ParameterType.Scalar, Description = "Y coordinate" },
                    new SnippetParameter { Name = "M", Type = ParameterType.Matrix, Description = "Matrix" }
                ]
            }
        ];
    }
}
