using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace Calcpad.Core
{
    internal sealed class DrawingExpressionException : Exception
    {
        internal DrawingExpressionException(string message) : base(message) { }
    }

    /// <summary>
    /// Arithmetic evaluator for .cdrw sidecar expressions. Deliberately not the Calcpad
    /// expression language: a small, self-contained subset that can later run in the browser.
    /// </summary>
    internal static class DrawingExpression
    {
        private static readonly (string Name, int Arity, Func<double[], double> Fn)[] Functions =
        {
            ("sin", 1, a => Math.Sin(a[0])),
            ("cos", 1, a => Math.Cos(a[0])),
            ("tan", 1, a => Math.Tan(a[0])),
            ("sqrt", 1, a => Math.Sqrt(a[0])),
            ("abs", 1, a => Math.Abs(a[0])),
            ("min", 2, a => Math.Min(a[0], a[1])),
            ("max", 2, a => Math.Max(a[0], a[1])),
        };

        private static readonly string[] FunctionNames = InitFunctionNames();

        private static string[] InitFunctionNames()
        {
            var names = new string[Functions.Length];
            for (var i = 0; i < Functions.Length; i++)
                names[i] = Functions[i].Name;
            return names;
        }

        internal static double Evaluate(string expression, IReadOnlyDictionary<string, double> variables)
        {
            if (string.IsNullOrWhiteSpace(expression))
                throw new DrawingExpressionException("Empty drawing expression.");

            var parser = new Parser(expression, variables ?? EmptyVariables);
            var value = parser.ParseExpression();
            parser.SkipWhitespace();
            if (!parser.IsAtEnd)
                throw new DrawingExpressionException($"Unexpected character '{parser.Current}' at position {parser.Position + 1}.");

            return value;
        }

        private static readonly IReadOnlyDictionary<string, double> EmptyVariables =
            new Dictionary<string, double>();

        private struct UnitLiteral
        {
            internal string Suffix;
            internal double Factor;
        }

        // Suffixes recognized after a number, mapped to SI-base factors (m, rad, dimensionless).
        private static readonly UnitLiteral[] UnitLiterals =
        {
            new() { Suffix = "mm", Factor = 0.001 },
            new() { Suffix = "cm", Factor = 0.01 },
            new() { Suffix = "m", Factor = 1 },
            new() { Suffix = "deg", Factor = Math.PI / 180 },
            new() { Suffix = "rad", Factor = 1 },
        };

        private class Parser
        {
            private readonly string _s;
            private readonly IReadOnlyDictionary<string, double> _variables;
            internal int Position;

            internal Parser(string s, IReadOnlyDictionary<string, double> variables)
            {
                _s = s;
                _variables = variables;
            }

            internal bool IsAtEnd => Position >= _s.Length;

            internal char Current => _s[Position];

            internal void SkipWhitespace()
            {
                while (Position < _s.Length && char.IsWhiteSpace(_s[Position]))
                    Position++;
            }

            internal double ParseExpression()
            {
                var value = ParseTerm();
                while (true)
                {
                    SkipWhitespace();
                    if (IsAtEnd)
                        return value;

                    switch (Current)
                    {
                        case '+':
                            Position++;
                            value += ParseTerm();
                            break;
                        case '-':
                            Position++;
                            value -= ParseTerm();
                            break;
                        default:
                            return value;
                    }
                }
            }

            private double ParseTerm()
            {
                var value = ParseFactor();
                while (true)
                {
                    SkipWhitespace();
                    if (IsAtEnd)
                        return value;

                    switch (Current)
                    {
                        case '*':
                            Position++;
                            value *= ParseFactor();
                            break;
                        case '/':
                            Position++;
                            value /= ParseFactor();
                            break;
                        default:
                            return value;
                    }
                }
            }

            private double ParseFactor()
            {
                SkipWhitespace();
                if (IsAtEnd)
                    throw new DrawingExpressionException($"Unexpected end of expression in '{_s}'.");

                if (Current == '+')
                {
                    Position++;
                    return ParseFactor();
                }

                if (Current == '-')
                {
                    Position++;
                    return -ParseFactor();
                }

                var value = ParsePrimary();
                SkipWhitespace();
                if (!IsAtEnd && Current == '^')
                {
                    Position++;
                    var exponent = ParseFactor();
                    return Math.Pow(value, exponent);
                }

                return value;
            }

            private double ParsePrimary()
            {
                SkipWhitespace();
                if (Current == '(')
                {
                    Position++;
                    var value = ParseExpression();
                    SkipWhitespace();
                    if (IsAtEnd || Current != ')')
                        throw new DrawingExpressionException($"Missing ')' at position {Position + 1} in '{_s}'.");

                    Position++;
                    return value;
                }

                var start = Position;
                while (!IsAtEnd && (char.IsLetter(Current) || Current == '_'))
                    Position++;

                if (Position > start)
                {
                    var identifier = _s[start..Position];
                    SkipWhitespace();
                    if (!IsAtEnd && Current == '(')
                    {
                        Position++;
                        var args = new List<double> { ParseExpression() };
                        SkipWhitespace();
                        while (!IsAtEnd && Current == ';')
                        {
                            Position++;
                            args.Add(ParseExpression());
                            SkipWhitespace();
                        }

                        if (IsAtEnd || Current != ')')
                            throw new DrawingExpressionException($"Missing ')' after function '{identifier}' in '{_s}'.");

                        Position++;
                        var fn = Array.Find(Functions, f => f.Name == identifier);
                        if (fn.Fn is null)
                            throw new DrawingExpressionException($"Unknown function '{identifier}' at position {start + 1}");
                        if (fn.Arity != args.Count)
                            throw new DrawingExpressionException($"Function '{identifier}' expects {fn.Arity} argument(s), got {args.Count}.");

                        return fn.Fn(args.ToArray());
                    }

                    if (_variables.TryGetValue(identifier, out var variable))
                        return variable;

                    throw new DrawingExpressionException($"Unknown identifier '{identifier}' at position {start + 1}");
                }

                return ParseNumber();
            }

            private double ParseNumber()
            {
                SkipWhitespace();
                var start = Position;
                while (!IsAtEnd && (char.IsDigit(Current) || Current == '.'))
                    Position++;

                if (Position == start)
                    throw new DrawingExpressionException(IsAtEnd
                        ? $"Unexpected end of expression in '{_s}'."
                        : $"Unexpected character '{Current}' at position {Position + 1}.");

                var numberText = _s[start..Position];
                if (!double.TryParse(numberText, NumberStyles.Float, CultureInfo.InvariantCulture, out var number))
                    throw new DrawingExpressionException($"Invalid number '{numberText}' at position {start + 1}.");

                // A unit suffix may follow the digits; only recognize it when no identifier follows
                // (e.g. "12mm" is a unit literal, "12mmx" is an identifier).
                foreach (var unit in UnitLiterals)
                {
                    if (Position + unit.Suffix.Length <= _s.Length &&
                        string.CompareOrdinal(_s, Position, unit.Suffix, 0, unit.Suffix.Length) == 0 &&
                        (Position + unit.Suffix.Length == _s.Length ||
                         !(char.IsLetterOrDigit(_s[Position + unit.Suffix.Length]) || _s[Position + unit.Suffix.Length] == '_')))
                    {
                        Position += unit.Suffix.Length;
                        return number * unit.Factor;
                    }
                }

                return number;
            }
        }
    }
}
