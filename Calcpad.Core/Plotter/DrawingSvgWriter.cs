using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace Calcpad.Core
{
    /// <summary>
    /// Renders an evaluated drawing to static inline SVG. No scripts; geometry is
    /// layered into CSS-toggleable groups; nodes carry data markers so the editor can
    /// identify literal vs expression-driven nodes without re-parsing.
    /// </summary>
    internal static class DrawingSvgWriter
    {
        internal static string Write(DrawingModel model, EvaluatedDrawing ev, string sidecarPath)
        {
            var bounds = ComputeBounds(ev);

            (double minX, double minY, double maxX, double maxY) = bounds;
            var k = Scale(bounds);
            var sb = new StringBuilder(4096);

            sb.Append("<svg class=\"drawing\" data-drawing-src=\"").Append(EscapeAttr(sidecarPath))
              .Append("\" xmlns=\"http://www.w3.org/2000/svg\" version=\"1.1\" viewbox=\"")
              .Append(F(minX - 80 * k)).Append(' ').Append(F(minY - 120 * k)).Append(' ')
              .Append(F(maxX - minX + 160 * k)).Append(' ').Append(F(maxY - minY + 240 * k))
              .Append("\" width=\"100%\" style=\"width:100%;\">").AppendLine();

            sb.AppendLine("<style type=\"text/css\">");
            sb.AppendLine(".drawing text { fill:#3c4852; font-family:'Segoe UI', Sans; paint-order: stroke; stroke:#fdfdfc; stroke-width:4; stroke-linejoin:round; }");
            sb.AppendLine(".drawing .cdrw-geom line { stroke-linecap: round; }");
            sb.AppendLine(".drawing .cdrw-dims line { stroke:#7b8790; stroke-width:1.5; fill:none; }");
            sb.AppendLine(".drawing .cdrw-dims text { fill:#7b8790; }");
            sb.AppendLine(".drawing .cdrw-callouts text { fill:#56616b; }");
            sb.AppendLine(".drawing text.cdrw-title { font-family: Georgia, serif; font-weight:600; fill:#4a5560; }");
            sb.AppendLine("</style>");

            if (model.View.Title is { Length: > 0 } title)
            {
                sb.Append("<text class=\"cdrw-title\" x=\"").Append(F(minX - 60 * k))
                  .Append("\" y=\"").Append(F(minY - 70 * k))
                  .Append("\" font-size=\"").Append(F(34 * k)).Append("\">")
                  .Append(EscapeText(title)).Append("</text>").AppendLine();
                if (model.View.Subtitle is { Length: > 0 } subtitle)
                {
                    sb.Append("<text class=\"cdrw-title\" x=\"").Append(F(minX - 60 * k))
                      .Append("\" y=\"").Append(F(minY - 40 * k))
                      .Append("\" font-size=\"").Append(F(18 * k)).Append("\">")
                      .Append(EscapeText(subtitle)).Append("</text>").AppendLine();
                }
            }

            sb.AppendLine("<g class=\"cdrw-geom\">");
            foreach (var member in ev.Members)
            {
                sb.Append("<line x1=\"").Append(F(member.A.X)).Append("\" y1=\"").Append(F(member.A.Y))
                  .Append("\" x2=\"").Append(F(member.B.X)).Append("\" y2=\"").Append(F(member.B.Y))
                  .AppendAttr("stroke", StrokeFor(model, member.Group))
                  .AppendAttr("stroke-width", F(4 * k).ToString(CultureInfo.InvariantCulture))
                  .Append("/>").AppendLine();
            }

            foreach (var node in model.Nodes)
            {
                if (!ev.Nodes.TryGetValue(node.Id, out var p))
                    continue;
                var driven = !IsLiteral(node.XRaw) || !IsLiteral(node.YRaw);
                sb.Append("<circle cx=\"").Append(F(p.X)).Append("\" cy=\"").Append(F(p.Y))
                  .Append("\" r=\"").Append(F(3 * k))
                  .AppendAttr("fill", "#fdfdfc")
                  .AppendAttr("stroke", "#3c4852")
                  .AppendAttr("data-node-id", node.Id)
                  .AppendAttr("data-driven", driven ? "true" : "false")
                  .Append("/>").AppendLine();
            }

            if (model.View.Supports is { Count: > 0 } supports)
            {
                foreach (var support in supports)
                {
                    var x = support.Equals("pin", StringComparison.OrdinalIgnoreCase) ? minX : maxX;
                    sb.Append("<path data-support=\"").Append(EscapeAttr(support))
                      .Append("\" d=\"M ").Append(F(x)).Append(' ').Append(F(maxY))
                      .Append(" l -8 14 l 16 0 z\" fill=\"none\" stroke=\"#3c4852\"/>").AppendLine();
                }
            }

            sb.AppendLine("</g>");

            sb.AppendLine("<g class=\"cdrw-callouts\">");
            var slot = 0;
            foreach (var callout in ev.Callouts)
            {
                var y = minY - 10 * k + slot * 30 * k;
                sb.Append("<text x=\"").Append(F(maxX - 120 * k))
                  .Append("\" y=\"").Append(F(y))
                  .Append("\" font-size=\"").Append(F(22 * k)).Append("\">")
                  .Append(EscapeText(callout.Label)).Append("</text>").AppendLine();
                if (callout.State.Length > 0)
                {
                    sb.Append("<text x=\"").Append(F(maxX - 120 * k))
                      .Append("\" y=\"").Append(F(y + 20 * k))
                      .Append("\" font-size=\"").Append(F(13 * k)).Append("\">")
                      .Append(EscapeText(callout.State.ToUpperInvariant())).Append("</text>").AppendLine();
                }

                slot++;
            }

            sb.AppendLine("</g>");

            sb.AppendLine("<g class=\"cdrw-dims\">");
            var index = 0;
            foreach (var dimension in ev.Dimensions)
            {
                var dx = dimension.B.X - dimension.A.X;
                var dy = dimension.B.Y - dimension.A.Y;
                var horizontal = Math.Abs(dx) >= Math.Abs(dy);
                var offset = 40 * k * (1 + index);

                if (horizontal)
                {
                    var ly = maxY + offset;
                    sb.Append("<line x1=\"").Append(F(dimension.A.X)).Append("\" y1=\"").Append(F(ly))
                      .Append("\" x2=\"").Append(F(dimension.B.X)).Append("\" y2=\"").Append(F(ly)).Append("/>").AppendLine();
                    sb.Append("<text x=\"").Append(F((dimension.A.X + dimension.B.X) / 2))
                      .Append("\" y=\"").Append(F(ly - 8 * k))
                      .Append("\" font-size=\"").Append(F(18 * k)).Append("\" text-anchor=\"middle\">")
                      .Append(EscapeText(dimension.Text)).Append("</text>").AppendLine();
                }
                else
                {
                    var lx = minX - offset;
                    sb.Append("<line x1=\"").Append(F(lx)).Append("\" y1=\"").Append(F(dimension.A.Y))
                      .Append("\" x2=\"").Append(F(lx)).Append("\" y2=\"").Append(F(dimension.B.Y)).Append("/>").AppendLine();
                    var tx = lx - 8 * k;
                    var ty = (dimension.A.Y + dimension.B.Y) / 2;
                    sb.Append("<text x=\"").Append(F(tx)).Append("\" y=\"").Append(F(ty))
                      .Append("\" font-size=\"").Append(F(18 * k))
                      .Append("\" transform=\"rotate(-90 ").Append(F(tx)).Append(' ').Append(F(ty))
                      .Append(")\" text-anchor=\"middle\">")
                      .Append(EscapeText(dimension.Text)).Append("</text>").AppendLine();
                }

                index++;
            }

            sb.AppendLine("</g>");
            sb.Append("</svg>");
            return sb.ToString();
        }

        private static string StrokeFor(DrawingModel model, string group)
        {
            foreach (var style in model.Styles)
            {
                if (style.Name.Equals(group, StringComparison.Ordinal))
                    return style.Stroke;
            }

            return "#3c4852";
        }

        private static bool IsLiteral(string raw)
        {
            var t = raw.TrimEnd();
            if (t.Length > 1 && t.EndsWith("m", StringComparison.Ordinal) &&
                double.TryParse(t[..^1].TrimEnd(), NumberStyles.Float, CultureInfo.InvariantCulture, out _))
                return true;

            return double.TryParse(t, NumberStyles.Float, CultureInfo.InvariantCulture, out _);
        }

        private static (double minX, double minY, double maxX, double maxY) ComputeBounds(EvaluatedDrawing ev)
        {
            double minX = double.MaxValue, minY = double.MaxValue, maxX = double.MinValue, maxY = double.MinValue;
            foreach (var p in ev.Nodes.Values)
            {
                minX = Math.Min(minX, p.X); minY = Math.Min(minY, p.Y);
                maxX = Math.Max(maxX, p.X); maxY = Math.Max(maxY, p.Y);
            }

            if (minX > maxX)
            {
                minX = minY = 0;
                maxX = maxY = 100;
            }

            return (minX, minY, maxX, maxY);
        }

        private static double Scale((double minX, double minY, double maxX, double maxY) b) =>
            Math.Max(1.0, (b.maxX - b.minX) / 600);

        private static string F(double d) =>
            Math.Round(d, 2).ToString(CultureInfo.InvariantCulture);

        private static string EscapeAttr(string s) =>
            s.Replace("&", "&amp;", StringComparison.Ordinal).Replace("\"", "&quot;", StringComparison.Ordinal);

        private static string EscapeText(string s) =>
            s.Replace("&", "&amp;", StringComparison.Ordinal).Replace("<", "&lt;", StringComparison.Ordinal);

        private static StringBuilder AppendAttr(this StringBuilder sb, string name, string value) =>
            value.Length == 0 ? sb : sb.Append(' ').Append(name).Append("=\"").Append(value).Append('"');
    }
}
