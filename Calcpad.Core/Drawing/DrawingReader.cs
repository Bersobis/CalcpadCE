using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text.RegularExpressions;

namespace Calcpad.Core
{
    /// <summary>
    /// Parses .cdrw sidecar text. Validation-only pass: expressions stay raw strings;
    /// undeclared references are surfaced as errors here so evaluation (DrawingEvaluator)
    /// can assume a consistent model.
    /// </summary>
    internal static partial class DrawingReader
    {
        private const string DrawingKw = "#drawing";
        private const string InputKw = "#input";
        private const string NodeKw = "#node";
        private const string MemberKw = "#member";
        private const string AnnotationKw = "#annotation";
        private const string DimensionKw = "#dimension";
        private const string StyleKw = "#style";
        private const string ViewKw = "#view";

        private static readonly string[] KnownRecords =
        [
            DrawingKw, InputKw, NodeKw, MemberKw, AnnotationKw, DimensionKw, StyleKw, ViewKw,
        ];

        private static readonly HashSet<string> FunctionNames = new(StringComparer.Ordinal)
        {
            "sin", "cos", "tan", "sqrt", "abs", "min", "max",
        };

        internal static DrawingModel Parse(string text) => Parse(text, out _);

        internal static DrawingModel Parse(string text, out IReadOnlyList<string> errors)
        {
            var errorList = new List<string>();
            string name = "";
            var inputs = new List<DrawingInput>();
            var nodes = new List<DrawingNode>();
            var members = new List<DrawingMember>();
            var annotations = new List<DrawingCallout>();
            var dimensions = new List<DrawingDimension>();
            var styles = new List<DrawingStyle>();
            string? title = null, subtitle = null, units = null;
            IReadOnlyList<string>? supports = null;

            var lines = text.Split('\n');
            for (var i = 0; i < lines.Length; i++)
            {
                var line = lines[i].TrimEnd('\r').Trim();
                if (line.Length == 0 || line.StartsWith("//"))
                    continue;

                var lineNumber = i + 1;
                var record = GetRecord(line);
                if (record is null)
                {
                    errorList.Add($"(line {lineNumber}): unrecognized record '{FirstWord(line)}'.");
                    continue;
                }

                var body = line[record.Length..].Trim();
                var hash = body.IndexOf(" #", StringComparison.Ordinal);
                var valuePart = (hash < 0 ? body : body[..hash]).Trim();
                var commentPart = hash < 0 ? "" : body[(hash + 1)..].Trim();
                _ = commentPart;

                switch (record)
                {
                    case DrawingKw:
                        name = valuePart.Trim();
                        break;

                    case InputKw:
                        ParseInput(valuePart, lineNumber, errorList, inputs);
                        break;

                    case NodeKw:
                        ParseNode(valuePart, lineNumber, errorList, nodes);
                        break;

                    case MemberKw:
                        ParseMember(valuePart, lineNumber, errorList, members);
                        break;

                    case AnnotationKw:
                        ParseAnnotation(valuePart, lineNumber, errorList, annotations);
                        break;

                    case DimensionKw:
                        ParseDimension(valuePart, lineNumber, errorList, dimensions);
                        break;

                    case StyleKw:
                        ParseStyle(valuePart, lineNumber, errorList, styles);
                        break;

                    case ViewKw:
                        ParseView(valuePart, ref title, ref subtitle, ref units, ref supports);
                        break;
                }
            }

            var nodeIds = new HashSet<string>(nodes.Select(n => n.Id), StringComparer.Ordinal);
            var inputNames = new HashSet<string>(inputs.Select(x => x.Name), StringComparer.Ordinal);

            foreach (var member in members)
            {
                if (!nodeIds.Contains(member.NodeA))
                    errorList.Add($"#member {member.Id}: unknown node '{member.NodeA}'.");
                if (!nodeIds.Contains(member.NodeB))
                    errorList.Add($"#member {member.Id}: unknown node '{member.NodeB}'.");
            }

            foreach (var node in nodes)
            {
                ValidateExpressionIdentifiers(node.XRaw, node.Id, inputNames, errorList);
                ValidateExpressionIdentifiers(node.YRaw, node.Id, inputNames, errorList);
            }

            foreach (var dimension in dimensions)
            {
                if (!nodeIds.Contains(dimension.NodeA))
                    errorList.Add($"#dimension {dimension.NodeA}→{dimension.NodeB}: unknown node '{dimension.NodeA}'.");
                if (!nodeIds.Contains(dimension.NodeB))
                    errorList.Add($"#dimension {dimension.NodeA}→{dimension.NodeB}: unknown node '{dimension.NodeB}'.");
            }

            errors = errorList;
            return new DrawingModel(
                name,
                inputs,
                nodes,
                members,
                annotations,
                dimensions,
                styles,
                new DrawingView(title, subtitle, units, supports));
        }

        private static void ValidateExpressionIdentifiers(
            string raw, string nodeId, HashSet<string> inputNames, List<string> errorList)
        {
            if (string.IsNullOrWhiteSpace(raw))
                return;

            var washed = WashUnitSuffixes(raw.Trim());
            if (washed.Length == 0)
                return;

            if (double.TryParse(washed, NumberStyles.Float, CultureInfo.InvariantCulture, out _))
                return;

            foreach (var identifier in ScanIdentifiers(raw))
            {
                if (FunctionNames.Contains(identifier))
                    continue;
                if (UnitSuffixes.Contains(identifier))
                    continue;
                if (inputNames.Contains(identifier))
                    continue;

                errorList.Add($"#node {nodeId}: expression references undeclared name '{identifier}'.");
            }
        }

        private static readonly string[] UnitSuffixesInOrder = ["mm", "cm", "deg", "rad", "m"];

        private static readonly HashSet<string> UnitSuffixes = new(StringComparer.Ordinal)
        {
            "mm", "cm", "m", "deg", "rad",
        };

        private static ReadOnlySpan<char> WashUnitSuffixes(ReadOnlySpan<char> raw)
        {
            var s = raw.TrimEnd();
            var changed = true;
            while (changed && s.Length > 0)
            {
                changed = false;
                foreach (var suffix in UnitSuffixesInOrder)
                {
                    if (s.EndsWith(suffix, StringComparison.Ordinal))
                    {
                        s = s[..^suffix.Length];
                        changed = true;
                    }
                }
            }

            return s.TrimEnd();
        }

        private static IEnumerable<string> ScanIdentifiers(string raw)
        {
            var word = new List<char>();
            foreach (var c in raw)
            {
                if (char.IsLetter(c) || c == '_')
                    word.Add(c);
                else if (word.Count > 0)
                {
                    yield return new string(word.ToArray());
                    word.Clear();
                }
            }

            if (word.Count > 0)
                yield return new string(word.ToArray());
        }

        private static string? GetRecord(string line)
        {
            if (!line.StartsWith("#"))
                return null;

            var space = line.IndexOfAny([' ', '\t', '=']);
            var token = (space < 0 ? line : line[..space]).TrimEnd();
            return KnownRecords.Contains(token) ? token : null;
        }

        private static string FirstWord(string line)
        {
            var i = line.IndexOfAny([' ', '\t', '=']);
            return i < 0 ? line : line[..i];
        }

        // Formats: "L = ? {12}  m  # comment"
        private static void ParseInput(string body, int line, List<string> errors, List<DrawingInput> inputs)
        {
            var eq = body.IndexOf('=');
            if (eq < 0)
            {
                errors.Add($"(line {line}): #input requires 'name = ?'.");
                return;
            }

            var name = body[..eq].Trim();
            if (name.Length == 0 || name.Contains(' ') || name.Contains('='))
            {
                errors.Add($"(line {line}): #input requires a single-token name.");
                return;
            }

            var tail = body[(eq + 1)..].Trim();
            var defStart = tail.IndexOf('{');
            var defEnd = defStart < 0 ? -1 : tail.IndexOf('}', defStart);
            var defaultRaw = defStart >= 0 && defEnd > defStart ? tail[(defStart + 1)..defEnd].Trim() : "";

            var afterDefault = defEnd < 0 ? tail : tail[(defEnd + 1)..].Trim();
            var unitText = afterDefault.Trim();
            inputs.Add(new DrawingInput(name, defaultRaw, unitText.Length == 0 ? "-" : unitText, null));
        }

        // "n2 (L/6, h*2/3)" | "n1 (0, 0)"
        private static void ParseNode(string body, int line, List<string> errors, List<DrawingNode> nodes)
        {
            var open = body.IndexOf('(');
            var close = body.LastIndexOf(')');
            if (open < 0 || close <= open)
            {
                errors.Add($"(line {line}): #node requires a name and (x, y).");
                return;
            }

            var id = body[..open].Trim();
            if (id.Length == 0 || id.Contains(' ') || id.Contains('='))
            {
                errors.Add($"(line {line}): #node requires a single-token name.");
                return;
            }

            var coords = body[(open + 1)..close];
            var comma = coords.IndexOf(',');
            if (comma < 0)
            {
                errors.Add($"#node {id} (line {line}): coordinates need a comma.");
                return;
            }

            var x = coords[..comma].Trim();
            var y = coords[(comma + 1)..].Trim();
            if (x.Length == 0 || y.Length == 0)
            {
                errors.Add($"#node {id} (line {line}): coordinates need two values.");
                return;
            }

            nodes.Add(new DrawingNode(id, x, y));
        }

        // "m1 n1 n2 group=top"
        private static void ParseMember(string body, int line, List<string> errors, List<DrawingMember> members)
        {
            var groupIdx = body.IndexOf("group=", StringComparison.Ordinal);
            if (groupIdx < 0)
            {
                errors.Add($"(line {line}): #member requires group=.");
                return;
            }

            var tokens = body[..groupIdx].Split(' ', StringSplitOptions.RemoveEmptyEntries);
            if (tokens.Length != 3)
            {
                errors.Add($"(line {line}): #member requires id, nodeA, nodeB.");
                return;
            }

            members.Add(new DrawingMember(tokens[0], tokens[1], tokens[2], body[(groupIdx + "group=".Length)..].Trim()));
        }

        // "group=top label="Top chord" state="In compression""
        private static void ParseAnnotation(string body, int line, List<string> errors, List<DrawingCallout> annotations)
        {
            var groupIdx = body.IndexOf("group=", StringComparison.Ordinal);
            if (groupIdx < 0)
            {
                errors.Add($"(line {line}): #annotation requires group=.");
                return;
            }

            var afterGroup = body[(groupIdx + "group=".Length)..];
            var end = ScanToken(afterGroup);
            var group = (end < 0 ? afterGroup : afterGroup[..end]).Trim();
            var label = ExtractQuoted(body, "label") ?? "";
            var state = ExtractQuoted(body, "state") ?? "";
            if (label.Length == 0)
                errors.Add($"(line {line}): #annotation requires label=\"…\".");

            annotations.Add(new DrawingCallout(group, label, state));
        }

        // "n1→n2 align=below text="a = {[L/n]:.3f} m""
        private static void ParseDimension(string body, int line, List<string> errors, List<DrawingDimension> dimensions)
        {
            var arrowIdx = body.IndexOf('→');
            if (arrowIdx < 0)
            {
                errors.Add($"(line {line}): #dimension requires 'nA→nB'.");
                return;
            }

            var nodeA = body[..arrowIdx].Trim();
            var afterArrow = body[(arrowIdx + 1)..];
            var spaceIdx = afterArrow.IndexOf(' ');
            var nodeB = (spaceIdx < 0 ? afterArrow : afterArrow[..spaceIdx]).Trim();

            var alignIdx = body.IndexOf("align=", StringComparison.Ordinal);
            var align = "below";
            if (alignIdx >= 0)
            {
                var rest = body[(alignIdx + "align=".Length)..];
                var end = ScanToken(rest);
                align = (end < 0 ? rest : rest[..end]).Trim();
            }

            var text = ExtractQuoted(body, "text") ?? "";
            if (text.Length == 0)
                errors.Add($"(line {line}): #dimension requires text=\"…\".");

            dimensions.Add(new DrawingDimension(nodeA, nodeB, align, text));
        }

        // "top stroke=#4d6f8f width=10"
        private static void ParseStyle(string body, int line, List<string> errors, List<DrawingStyle> styles)
        {
            var space = body.IndexOf(' ');
            if (space < 0)
            {
                errors.Add($"(line {line}): #style requires name and stroke=.");
                return;
            }

            var name = body[..space].Trim();
            if (name.Length == 0)
            {
                errors.Add($"(line {line}): #style requires a name.");
                return;
            }

            var tail = body[(space + 1)..];
            var strokeIdx = tail.IndexOf("stroke=", StringComparison.Ordinal);
            var stroke = "";
            if (strokeIdx >= 0)
            {
                var rest = tail[(strokeIdx + "stroke=".Length)..];
                var end = ScanToken(rest);
                stroke = (end < 0 ? rest : rest[..end]).Trim();
            }

            var width = 1.0;
            var widthIdx = tail.IndexOf("width=", StringComparison.Ordinal);
            if (widthIdx >= 0)
            {
                var rest = tail[(widthIdx + "width=".Length)..];
                var end = ScanToken(rest);
                var widthText = (end < 0 ? rest : rest[..end]).Trim();
                if (!double.TryParse(widthText, NumberStyles.Float, CultureInfo.InvariantCulture, out width))
                    errors.Add($"(line {line}): #style {name}: invalid width '{widthText}'.");
            }

            styles.Add(new DrawingStyle(name, stroke, width));
        }

        // "title="Truss Members" subtitle="Gravity load" supports=pin,roller"
        private static void ParseView(
            string body,
            ref string? title, ref string? subtitle, ref string? units, ref IReadOnlyList<string>? supports)
        {
            title ??= ExtractQuoted(body, "title");
            subtitle ??= ExtractQuoted(body, "subtitle");
            units ??= ExtractQuoted(body, "units");

            var supIdx = body.IndexOf("supports=", StringComparison.Ordinal);
            if (supIdx >= 0)
            {
                var rest = body[(supIdx + "supports=".Length)..];
                var end = ScanToken(rest);
                var list = (end < 0 ? rest : rest[..end]).Trim();
                supports = list.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            }
        }

        /// <summary>Index of the whitespace that ends a bare token (stops at a quote or end).</summary>
        private static int ScanToken(ReadOnlySpan<char> s)
        {
            for (var i = 0; i < s.Length; i++)
            {
                if (s[i] == ' ' || s[i] == '\t' || s[i] == '"')
                    return i;
            }

            return -1;
        }

        private static string? ExtractQuoted(string body, string key)
        {
            var idx = body.IndexOf(key + "=\"", StringComparison.Ordinal);
            if (idx < 0)
                return null;

            var start = idx + key.Length + 2;
            var end = body.IndexOf('"', start);
            return end < 0 ? null : body[start..end];
        }
    }
}
