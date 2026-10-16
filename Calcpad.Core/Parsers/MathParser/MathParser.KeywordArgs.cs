using System;
using System.Collections.Generic;
using System.Text;

namespace Calcpad.Core
{
    public partial class MathParser
    {
        private bool _hasOptionalParams;

        private static void SkipDefault(Queue<Token> input)
        {
            var depth = 0;
            while (input.Count != 0)
            {
                var t = input.Peek();
                if (depth == 0 && (t.Type == TokenTypes.Divisor || t.Type == TokenTypes.BracketRight))
                    break;

                if (t.Type == TokenTypes.BracketLeft || t.Type == TokenTypes.SquareBracketLeft)
                    ++depth;
                else if (t.Type == TokenTypes.BracketRight || t.Type == TokenTypes.SquareBracketRight)
                    --depth;

                input.Dequeue();
            }
        }

        // Taken from source text since tokens can't be turned back into it (e.g. "1kg").
        private static string[] GetSourceDefaults(ReadOnlySpan<char> source, List<string> parameters)
        {
            var open = source.IndexOf('(');
            var list = source[(open + 1)..IndexOfClosingBracket(source, open)];
            var ranges = SplitArguments(list);
            if (ranges.Count != parameters.Count)
                throw Exceptions.InvalidFunctionDefinition();

            var defaults = new string[ranges.Count];
            for (var i = 0; i < defaults.Length; ++i)
            {
                var parameter = list[ranges[i]];
                var eq = IndexOfTopLevel(parameter, '=');
                if (eq > 0)
                    defaults[i] = parameter[(eq + 1)..].Trim().ToString();
                else if (i > 0 && defaults[i - 1] is not null)
                    throw Exceptions.RequiredParameterAfterOptional(parameters[i]);
            }
            return defaults;
        }

        // "f(3; y = 4)" → "f(3; 4)". Returns null when nothing needed rewriting.
        private string RewriteKeywordArgs(ReadOnlySpan<char> span)
        {
            StringBuilder sb = null;
            var start = 0;
            for (int i = 0, len = span.Length; i < len; ++i)
            {
                if (!Validator.IsVarStartingChar(span[i]))
                    continue;

                var j = i;
                while (j < len && Validator.IsVarChar(span[j]))
                    ++j;

                if (j >= len || span[j] != '(')
                {
                    i = j - 1;
                    continue;
                }
                var index = _functions.IndexOf(span[i..j].ToString());
                var cf = index < 0 ? null : _functions[index];
                if (cf?.DefaultExpressions is null)
                {
                    i = j - 1;
                    continue;
                }
                var close = IndexOfClosingBracket(span, j);
                if (close < 0)
                    break;

                if (span[..i].IsWhiteSpace() && span[(close + 1)..].TrimStart(' ').StartsWith('='))
                {
                    i = close;
                    continue;
                }
                if (!TryResolveKeywordArgs(cf, span[(j + 1)..close], out var arguments))
                {
                    i = j - 1;
                    continue;
                }
                sb ??= new StringBuilder(span.Length + 16);
                sb.Append(span[start..(j + 1)]).Append(arguments).Append(')');
                start = close + 1;
                i = close;
            }
            return sb?.Append(span[start..]).ToString();
        }

        private bool TryResolveKeywordArgs(CustomFunction cf, ReadOnlySpan<char> argsText, out string resolved)
        {
            resolved = null;
            var n = cf.ParameterCount;
            var arguments = new string[n];
            var positionalCount = 0;
            var keywordCount = 0;
            foreach (var range in SplitArguments(argsText))
            {
                var arg = argsText[range].Trim();
                var index = KeywordArgIndex(arg, cf, out var value);
                if (index < 0)
                {
                    if (keywordCount != 0)
                        throw Exceptions.InvalidNumberOfArguments();

                    if (positionalCount >= n)
                        return false;

                    index = positionalCount++;
                    value = arg;
                }
                else if (arguments[index] is not null)
                    throw Exceptions.DuplicateArgument(cf.ParameterName(index));
                else
                    ++keywordCount;

                arguments[index] = value.ToString();
            }
            if (keywordCount == 0 && positionalCount == n)
                return false;

            FillDefaults(arguments, cf.DefaultExpressions);
            // Nested calls need the same treatment
            resolved = string.Join("; ", Array.ConvertAll(arguments, s => RewriteKeywordArgs(s) ?? s));
            return true;
        }

        internal static void FillDefaults(string[] arguments, string[] defaults)
        {
            for (var i = 0; i < arguments.Length; ++i)
                arguments[i] ??= defaults[i] ?? throw Exceptions.InvalidNumberOfArguments();
        }

        private static int KeywordArgIndex(ReadOnlySpan<char> arg, CustomFunction cf, out ReadOnlySpan<char> value)
        {
            var eq = IndexOfTopLevel(arg, '=');
            if (eq > 0 && (eq + 1 >= arg.Length || arg[eq + 1] != '='))
            {
                var index = cf.IndexOfParameter(arg[..eq].TrimEnd());
                if (index >= 0)
                {
                    value = arg[(eq + 1)..].TrimStart();
                    return index;
                }
            }
            value = default;
            return -1;
        }

        private static int IndexOfClosingBracket(ReadOnlySpan<char> s, int open)
        {
            var i = IndexOfTopLevel(s[(open + 1)..], ')');
            return i < 0 ? -1 : open + 1 + i;
        }

        // Index of the first target outside brackets, or of an unmatched closing bracket.
        internal static int IndexOfTopLevel(ReadOnlySpan<char> s, char target)
        {
            var depth = 0;
            for (int i = 0, len = s.Length; i < len; ++i)
            {
                var c = s[i];
                if (c == target && depth == 0)
                    return i;

                if (c is '(' or '[' or '{')
                    ++depth;
                else if (c is ')' or ']' or '}' && --depth < 0)
                    return i;
            }
            return -1;
        }

        private static List<Range> SplitArguments(ReadOnlySpan<char> s)
        {
            var ranges = new List<Range>();
            var start = 0;
            int i;
            while ((i = IndexOfTopLevel(s[start..], ';')) >= 0)
            {
                ranges.Add(start..(start + i));
                start += i + 1;
            }
            ranges.Add(start..s.Length);
            return ranges;
        }
    }
}
