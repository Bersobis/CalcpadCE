using System;
using System.Globalization;
using System.Text;

namespace Calcpad.Core
{
    /// <summary>
    /// Canonical .cdrw serializer: one record per line, fixed section order, no blank
    /// lines, no comments — comments and author formatting are intentionally lost so a
    /// canvas drag session produces a minimal, reviewable diff.
    /// </summary>
    internal static class DrawingWriter
    {
        internal static string Write(DrawingModel model)
        {
            var sb = new StringBuilder();
            sb.Append("#drawing ").Append(model.Name).AppendLine();

            foreach (var input in model.Inputs)
            {
                sb.Append("#input ").Append(input.Name).Append(" = ? {").Append(input.DefaultRaw)
                  .Append("} ").Append(input.UnitText).AppendLine();
            }

            foreach (var node in model.Nodes)
            {
                sb.Append("#node ").Append(node.Id).Append(" (").Append(node.XRaw)
                  .Append(", ").Append(node.YRaw).Append(')').AppendLine();
            }

            foreach (var member in model.Members)
            {
                sb.Append("#member ").Append(member.Id).Append(' ').Append(member.NodeA)
                  .Append(' ').Append(member.NodeB).Append(" group=").Append(member.Group).AppendLine();
            }

            foreach (var annotation in model.Annotations)
            {
                sb.Append("#annotation group=").Append(annotation.Group)
                  .Append(" label=\"").Append(Escape(annotation.Label)).Append('"');
                if (annotation.State.Length > 0)
                    sb.Append(" state=\"").Append(Escape(annotation.State)).Append('"');
                sb.AppendLine();
            }

            foreach (var dimension in model.Dimensions)
            {
                sb.Append("#dimension ").Append(dimension.NodeA).Append('→').Append(dimension.NodeB)
                  .Append(" align=").Append(dimension.Align)
                  .Append(" text=\"").Append(Escape(dimension.TextPattern)).Append('"').AppendLine();
            }

            foreach (var style in model.Styles)
            {
                sb.Append("#style ").Append(style.Name)
                  .Append(" stroke=").Append(style.Stroke)
                  .Append(" width=").Append(style.Width.ToString("0.###", CultureInfo.InvariantCulture)).AppendLine();
            }

            sb.Append("#view");
            if (model.View.Title is { Length: > 0 } title)
                sb.Append(" title=\"").Append(Escape(title)).Append('"');
            if (model.View.Subtitle is { Length: > 0 } subtitle)
                sb.Append(" subtitle=\"").Append(Escape(subtitle)).Append('"');
            if (model.View.Supports is { Count: > 0 } supports)
                sb.Append(" supports=").Append(string.Join(',', supports));
            if (model.View.Units is { Length: > 0 } units)
                sb.Append(" units=\"").Append(Escape(units)).Append('"');
            sb.AppendLine();

            return sb.ToString();
        }

        private static string Escape(string s) => s.Replace("\"", "&quot;", StringComparison.Ordinal);
    }
}
