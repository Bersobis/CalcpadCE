using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;

namespace Calcpad.Core
{
    /// <summary>
    /// Tolerant ASCII DXF import: LINE/LWPOLYLINE become literal nodes and
    /// members, TEXT becomes a callout, anything else is skipped with a
    /// warning. Units come from $INSUNITS; absent means mm.
    /// </summary>
    internal static class DrawingDxfReader
    {
        private const double DedupTolerance = 1e-6;

        internal static (DrawingModel Model, IReadOnlyList<string> Warnings) Read(Stream dxf)
        {
            var warnings = new List<string>();
            var pairs = Pairs(dxf);

            int? insUnits = null;
            var nodes = new List<DrawingNode>();
            var members = new List<DrawingMember>();
            var annotations = new List<DrawingCallout>();
            var nodeIndex = new List<(double X, double Y)>();
            var nodeId = new Dictionary<(double X, double Y), string>();

            for (var i = 0; i < pairs.Count - 1; i++)
            {
                if (pairs[i].Code != 0 || pairs[i].Value != "SECTION")
                    continue;
                var name = i + 2 < pairs.Count && pairs[i + 1].Code == 2 ? pairs[i + 1].Value : "";
                if (name == "HEADER")
                    insUnits = ReadHeader(pairs, i);
                else if (name == "ENTITIES")
                    ReadEntities(pairs, i + 2, warnings, nodes, members, annotations, nodeIndex, nodeId);
            }

            if (insUnits is null)
                warnings.Add("No $INSUNITS in DXF header, assuming mm.");
            else if (insUnits != 4)
                warnings.Add($"Unsupported $INSUNITS value {insUnits}, assuming mm.");

            return (new DrawingModel("imported-drawing",
                Array.Empty<DrawingInput>(), nodes, members, annotations,
                Array.Empty<DrawingDimension>(), Array.Empty<DrawingStyle>(),
                new DrawingView(null, null, "m", null)), warnings);
        }

        private static int? ReadHeader(List<(int Code, string Value)> pairs, int section)
        {
            for (var i = section; i < pairs.Count; i++)
            {
                if (pairs[i].Code == 0 && pairs[i].Value == "ENDSEC")
                    break;
                if (pairs[i].Code == 9 && pairs[i].Value == "$INSUNITS" &&
                    i + 1 < pairs.Count && pairs[i + 1].Code == 70 &&
                    int.TryParse(pairs[i + 1].Value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var v))
                    return v;
            }
            return null;
        }

        private static void ReadEntities(
            List<(int Code, string Value)> pairs, int start, List<string> warnings,
            List<DrawingNode> nodes, List<DrawingMember> members, List<DrawingCallout> annotations,
            List<(double X, double Y)> nodeIndex, Dictionary<(double X, double Y), string> nodeId)
        {
            for (var i = start; i < pairs.Count; i++)
            {
                if (pairs[i].Code != 0)
                    continue;
                var kind = pairs[i].Value;
                if (kind == "ENDSEC")
                    break;

                var attrs = new List<(int, string)>();
                var j = i + 1;
                while (j < pairs.Count && pairs[j].Code != 0)
                    attrs.Add(pairs[j++]);

                switch (kind)
                {
                    case "LINE":
                        AddLine(attrs, warnings, nodes, members, nodeIndex, nodeId);
                        break;
                    case "LWPOLYLINE":
                        AddPolyline(attrs, nodes, members, nodeIndex, nodeId);
                        break;
                    case "TEXT":
                        AddText(attrs, annotations);
                        break;
                    default:
                        warnings.Add($"Entity {kind} skipped: not supported by .cdrw import.");
                        break;
                }
            }
        }

        private static void AddLine(
            List<(int Code, string Value)> attrs, List<string> warnings,
            List<DrawingNode> nodes, List<DrawingMember> members,
            List<(double X, double Y)> nodeIndex, Dictionary<(double X, double Y), string> nodeId)
        {
            var (p1, p2) = Endpoints(attrs, warnings);
            if (p1 is null || p2 is null)
                return;
            var (idA, idB) = (Node(p1.Value, nodeIndex, nodeId, nodes), Node(p2.Value, nodeIndex, nodeId, nodes));
            if (idA == idB)
                return;
            members.Add(new DrawingMember($"m{members.Count + 1}", idA, idB, Group(LayerOf(attrs))));
        }

        private static void AddPolyline(
            List<(int Code, string Value)> attrs, List<DrawingNode> nodes,
            List<DrawingMember> members, List<(double X, double Y)> nodeIndex,
            Dictionary<(double X, double Y), string> nodeId)
        {
            var group = Group(LayerOf(attrs));
            (double X, double Y)? prev = null;
            foreach (var p in Vertices(attrs))
            {
                if (prev is { } a)
                {
                    var (idA, idB) = (Node(a, nodeIndex, nodeId, nodes), Node(p, nodeIndex, nodeId, nodes));
                    if (idA != idB)
                        members.Add(new DrawingMember($"m{members.Count + 1}", idA, idB, group));
                }
                prev = p;
            }
        }

        private static void AddText(List<(int Code, string Value)> attrs, List<DrawingCallout> annotations)
        {
            string text = null, layer = null;
            foreach (var (code, value) in attrs)
            {
                if (code == 1 && text is null)
                    text = value;
                else if (code == 8 && layer is null)
                    layer = value;
            }
            if (!string.IsNullOrEmpty(text))
                annotations.Add(new DrawingCallout(Group(layer) ?? "callouts", text, ""));
        }

        private static string Node((double X, double Y) p, List<(double X, double Y)> nodeIndex,
            Dictionary<(double X, double Y), string> nodeId, List<DrawingNode> nodes)
        {
            foreach (var existing in nodeIndex)
                if (Math.Abs(existing.X - p.X) <= DedupTolerance && Math.Abs(existing.Y - p.Y) <= DedupTolerance)
                    return nodeId[existing];

            var id = $"n{nodeIndex.Count + 1}";
            nodeIndex.Add(p);
            nodeId[p] = id;
            // Coordinates stay in DXF units (mm), carried by the literal suffix.
            nodes.Add(new DrawingNode(id, Literal(p.X), Literal(p.Y)));
            return id;
        }

        private static string Literal(double mm)
        {
            if (Math.Abs(mm) < 1e-9)
                return "0";
            return Math.Round(mm, 6).ToString("0.######", CultureInfo.InvariantCulture) + "mm";
        }

        private static string Group(string layer) =>
            layer switch
            {
                "GEOM-TOP" => "top",
                "GEOM-BOT" => "bot",
                "GEOM-WEB" => "web",
                _ => layer?.ToLowerInvariant(),
            };

        private static string LayerOf(List<(int Code, string Value)> attrs)
        {
            foreach (var (code, value) in attrs)
                if (code == 8)
                    return value;
            return null;
        }

        private static List<(double X, double Y)> Vertices(List<(int Code, string Value)> attrs)
        {
            var points = new List<(double X, double Y)>();
            double? x = null, y = null;
            foreach (var (code, value) in attrs)
            {
                if (code == 10)
                {
                    Flush(x, y, points);
                    x = Double(value);
                    y = null;
                }
                else if (code == 20 && x is not null)
                    y = Double(value);
            }
            Flush(x, y, points);
            return points;

            static void Flush(double? x, double? y, List<(double X, double Y)> points)
            {
                if (x is { } xx && y is { } yy)
                    points.Add((xx, yy));
            }
        }

        private static ((double X, double Y)?, (double X, double Y)?) Endpoints(List<(int Code, string Value)> attrs, List<string> warnings)
        {
            double? x1 = null, y1 = null, x2 = null, y2 = null;
            foreach (var (code, value) in attrs)
            {
                if (code == 10 && x1 is null)
                    x1 = Double(value);
                else if (code == 20 && y1 is null && x1 is not null)
                    y1 = Double(value);
                else if (code == 11 && x2 is null)
                    x2 = Double(value);
                else if (code == 21 && y2 is null && x2 is not null)
                    y2 = Double(value);
            }
            if (x1 is null || y1 is null || x2 is null || y2 is null)
            {
                warnings.Add("LINE entity without two endpoints was skipped.");
                return (null, null);
            }
            return ((x1.Value, y1.Value), (x2.Value, y2.Value));
        }

        private static double Double(string value)
        {
            return double.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out var v)
                ? v
                : double.NaN;
        }

        private static List<(int Code, string Value)> Pairs(Stream dxf)
        {
            using var reader = new StreamReader(dxf, Encoding.ASCII);
            var pairs = new List<(int, string)>();
            while (reader.ReadLine() is { } codeLine)
            {
                var valueLine = reader.ReadLine();
                if (valueLine is null)
                    break;
                if (!int.TryParse(codeLine.Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var code))
                    continue;
                pairs.Add((code, valueLine.TrimEnd('\r')));
            }
            return pairs;
        }
    }
}
