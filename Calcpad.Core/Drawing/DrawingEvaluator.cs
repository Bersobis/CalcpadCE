using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace Calcpad.Core
{
    internal sealed record DrawnPoint(double X, double Y);

    internal sealed record DrawnMember(string Id, DrawnPoint A, DrawnPoint B, string Group);

    internal sealed record DrawnDimension(string NodeA, DrawnPoint A, string NodeB, DrawnPoint B, string Align, string Text);

    internal sealed record DrawnCallout(string Group, string Label, string State);

    internal sealed record EvaluatedDrawing(
        IReadOnlyDictionary<string, DrawnPoint> Nodes,
        IReadOnlyList<DrawnMember> Members,
        IReadOnlyList<DrawnDimension> Dimensions,
        IReadOnlyList<DrawnCallout> Callouts);

    /// <summary>
    /// Binds host values (or input defaults) to a DrawingModel and evaluates every
    /// geometric quantity. Results are in each input's declared unit.
    /// </summary>
    internal static class DrawingEvaluator
    {
        internal static EvaluatedDrawing Evaluate(
            DrawingModel model,
            IReadOnlyDictionary<string, (double Value, Unit Units)> bindings,
            bool isUs)
        {
            var variables = new Dictionary<string, double>(StringComparer.Ordinal);

            foreach (var input in model.Inputs)
            {
                if (bindings.TryGetValue(input.Name, out var binding))
                {
                    variables[input.Name] = ConvertBinding(binding, input, isUs);
                }
                else if (input.DefaultRaw.Length > 0)
                {
                    variables[input.Name] = DrawingExpression.Evaluate(input.DefaultRaw, new Dictionary<string, double>());
                }
                else
                {
                    throw new DrawingExpressionException(
                        $"Drawing '{model.Name}': input '{input.Name}' has no default and no binding.");
                }
            }

            var nodes = new Dictionary<string, DrawnPoint>(StringComparer.Ordinal);

            // Nodes may reference other nodes' coordinates; iterate until stable.
            foreach (var node in model.Nodes)
                nodes[node.Id] = new DrawnPoint(double.NaN, double.NaN);

            bool changed = true;
            var guard = 0;
            while (changed)
            {
                changed = false;
                if (++guard > model.Nodes.Count + 1)
                    throw new DrawingExpressionException($"Drawing '{model.Name}': circular node references.");

                foreach (var node in model.Nodes)
                {
                    var nx = EvaluateWithNodes(node.XRaw, variables);
                    var ny = EvaluateWithNodes(node.YRaw, variables);
                    var point = new DrawnPoint(nx, ny);
                    if (double.IsNaN(nodes[node.Id].X) || nodes[node.Id] != point)
                    {
                        changed = true;
                        nodes[node.Id] = point;
                    }
                }
            }

            var members = new List<DrawnMember>(model.Members.Count);
            foreach (var member in model.Members)
            {
                if (!nodes.TryGetValue(member.NodeA, out var a))
                    throw new DrawingExpressionException($"Drawing '{model.Name}': member '{member.Id}' references unknown node '{member.NodeA}'.");
                if (!nodes.TryGetValue(member.NodeB, out var b))
                    throw new DrawingExpressionException($"Drawing '{model.Name}': member '{member.Id}' references unknown node '{member.NodeB}'.");

                members.Add(new DrawnMember(member.Id, a, b, member.Group));
            }

            var dimensions = new List<DrawnDimension>(model.Dimensions.Count);
            foreach (var dimension in model.Dimensions)
            {
                if (!nodes.TryGetValue(dimension.NodeA, out var a))
                    throw new DrawingExpressionException($"Drawing '{model.Name}': dimension references unknown node '{dimension.NodeA}'.");
                if (!nodes.TryGetValue(dimension.NodeB, out var b))
                    throw new DrawingExpressionException($"Drawing '{model.Name}': dimension references unknown node '{dimension.NodeB}'.");

                dimensions.Add(new DrawnDimension(
                    dimension.NodeA, a, dimension.NodeB, b, dimension.Align,
                    RenderText(dimension.TextPattern, variables)));
            }

            var callouts = new List<DrawnCallout>(model.Annotations.Count);
            foreach (var annotation in model.Annotations)
                callouts.Add(new DrawnCallout(annotation.Group, annotation.Label, annotation.State));

            return new EvaluatedDrawing(nodes, members, dimensions, callouts);
        }

        private static double ConvertBinding(
            (double Value, Unit Units) binding, DrawingInput input, bool isUs)
        {
            if (binding.Units is null || binding.Units.IsDimensionless || input.UnitText is "-" or "" )
                return binding.Value;

            if (!Unit.TryGet(input.UnitText, isUs, out var declared))
            {
                // '-' means dimensionless declared input: accept the raw value.
                return input.UnitText is "-" ? binding.Value
                    : throw new DrawingExpressionException($"Unknown unit '{input.UnitText}' for drawing input '{input.Name}'.");
            }

            if (binding.Units.IsDimensionless)
                return binding.Value;

            if (!binding.Units.IsConsistent(declared))
                throw new DrawingExpressionException(
                    $"Drawing input '{input.Name}': host unit '{binding.Units.Text}' is not compatible with declared unit '{declared.Text}'.");

            return binding.Value * binding.Units.ConvertTo(declared);
        }

        private static double EvaluateWithNodes(
            string raw,
            IReadOnlyDictionary<string, double> variables,
            Dictionary<string, double>? scratch = null)
        {
            // Node references (e.g. another node's coordinate) are not part of the v1
            // expression grammar; only declared inputs and literals are.
            return DrawingExpression.Evaluate(raw, variables);
        }

        /// <summary>Renders "a = {[L/n]:.3f} m" with computed values, invariant culture.</summary>
        /// <remarks>Placeholder formats are printf-style (.3f); converted to .NET (0.000).</remarks>
        private static string ToDotNetFormat(string printfFormat)
        {
            if (string.IsNullOrEmpty(printfFormat))
                return "0.###";

            var dot = printfFormat.IndexOf('.');
            if (dot < 0)
                return "0.###";

            // Digits between '.' and 'f' — e.g. .3f → 3
            var digits = 0;
            for (var i = dot + 1; i < printfFormat.Length && char.IsDigit(printfFormat[i]); i++)
                digits = digits * 10 + (printfFormat[i] - '0');

            return digits > 0 ? "0." + new string('0', digits) : "0";
        }

        private static string RenderText(string pattern, IReadOnlyDictionary<string, double> variables)
        {
            var sb = new StringBuilder(pattern.Length + 16);
            var i = 0;
            while (i < pattern.Length)
            {
                var open = pattern.IndexOf("{[", i, StringComparison.Ordinal);
                if (open < 0)
                {
                    sb.Append(pattern[i..]);
                    break;
                }

                sb.Append(pattern[i..open]);
                var close = pattern.IndexOf('}', open);
                if (close < 0)
                {
                    sb.Append(pattern[open..]);
                    break;
                }

                var spec = pattern[(open + 2)..close];  // "expr]:format" — ']' closes the expr
                var colon = spec.IndexOf(':');
                var expr = colon < 0 ? spec.TrimEnd(']') : spec[..colon].TrimEnd(']');
                var format = colon < 0 ? "" : spec[(colon + 1)..];

                var value = DrawingExpression.Evaluate(expr, variables);
                sb.Append(value.ToString(ToDotNetFormat(format), CultureInfo.InvariantCulture));
                i = close + 1;
            }

            return sb.ToString();
        }
    }
}
