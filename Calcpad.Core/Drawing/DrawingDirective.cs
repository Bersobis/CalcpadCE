using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;

namespace Calcpad.Core
{
    /// <summary>
    /// Splits the argument list of $Drawing { path; name = expr; ... } and renders
    /// the referenced sidecar to inline SVG. All failures become exceptions with
    /// actionable messages, which the parse loop turns into rendered errors.
    /// </summary>
    internal static class DrawingDirective
    {
        internal static string Render(
            string args,
            MathParser parser,
            PathRoots pathRoots,
            string sourceDirectory,
            bool isUs,
            bool calculate)
        {
            var (rawPath, bindings) = ParseArgs(args);
            if (rawPath is null || rawPath.Length == 0)
                throw new DrawingExpressionException("The $Drawing directive requires a .cdrw sidecar path.");

            var path = ResolvePath(rawPath, pathRoots, sourceDirectory);
            if (!File.Exists(path))
                throw new DrawingExpressionException($"Drawing sidecar '{Path.GetFileName(rawPath)}' not found.");

            var model = DrawingReader.Parse(File.ReadAllText(path), out var errors);
            if (errors.Count > 0)
                throw new DrawingExpressionException(
                    $"Drawing sidecar '{Path.GetFileName(path)}' has {errors.Count} error(s): {errors[0]}");

            var evaluatedBindings = new Dictionary<string, (double Value, Unit Units)>(StringComparer.Ordinal);
            if (calculate)
            {
                foreach (var (name, expr) in bindings)
                {
                    try
                    {
                        parser.Parse(expr);
                        parser.Calculate();
                    }
                    catch (MathParserException)
                    {
                        throw new DrawingExpressionException(
                            $"Drawing binding '{name}' could not be evaluated as '{expr}'.");
                    }

                    if (!parser.Result.IsReal)
                        throw new DrawingExpressionException(
                            $"Drawing binding '{name}' must be a real number, got '{expr}'.");

                    evaluatedBindings[name] = (parser.Real, parser.Units);
                }
            }

            var evaluated = DrawingEvaluator.Evaluate(model, evaluatedBindings, isUs);
            // data-drawing-src records the path as written in the worksheet so it is
            // stable across machines; hosts resolve it relative to the document.
            return DrawingSvgWriter.Write(model, evaluated, rawPath);
        }

        internal static (string Path, IReadOnlyList<(string Name, string Expression)> Bindings) ParseArgs(string args)
        {
            var parts = TopLevelSplit(args, ';');
            var path = Unquote(parts[0].Trim());

            var bindings = new List<(string, string)>();
            for (var i = 1; i < parts.Count; i++)
            {
                var eq = parts[i].IndexOf('=');
                var name = eq < 0 ? parts[i].Trim() : parts[i][..eq].Trim();
                var expr = eq < 0 ? "" : parts[i][(eq + 1)..].Trim();
                if (name.Length > 0 && expr.Length > 0)
                    bindings.Add((name, expr));
            }

            return (path, bindings);
        }

        private static string ResolvePath(string raw, PathRoots roots, string sourceDirectory)
        {
            if (!roots.TryExpand(raw, out var expanded, out var error))
                throw new DrawingExpressionException(error);

            if (string.IsNullOrEmpty(sourceDirectory) || Path.IsPathRooted(expanded))
                return expanded;

            return Path.GetFullPath(Path.Combine(sourceDirectory, expanded));
        }

        private static List<string> TopLevelSplit(string s, char separator)
        {
            var parts = new List<string>();
            var sb = new StringBuilder();
            var brace = 0;
            var paren = 0;
            var bracket = 0;
            var quote = false;
            foreach (var c in s)
            {
                if (quote)
                {
                    if (c == '"')
                        quote = false;
                }
                else if (c == '"')
                    quote = true;
                else if (c == '{')
                    brace++;
                else if (c == '}')
                    brace--;
                else if (c == '(')
                    paren++;
                else if (c == ')')
                    paren--;
                else if (c == '[')
                    bracket++;
                else if (c == ']')
                    bracket--;
                else if (c == separator && brace == 0 && paren == 0 && bracket == 0)
                {
                    parts.Add(sb.ToString());
                    sb.Clear();
                    continue;
                }

                sb.Append(c);
            }

            parts.Add(sb.ToString());
            return parts;
        }

        private static string Unquote(string s)
        {
            s = s.Trim();
            return s.Length > 1 && s[0] == '"' && s[^1] == '"' ? s[1..^1] : s;
        }
    }
}
