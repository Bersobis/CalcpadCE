using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace Calcpad.Core
{
    /// <summary>
    /// Emits R2018 ASCII DXF. Geometry is written in millimeters ($INSUNITS = 4).
    /// Dimensions are written as exploded primitives (leader lines + text), documented
    /// in the spec's §11 builder-discretion note.
    /// </summary>
    internal static class DrawingDxfWriter
    {
        internal static byte[] Write(DrawingModel model, EvaluatedDrawing ev)
        {
            var sb = new StringBuilder(8192);

            void Pair(int code, string value) => sb.Append(FormatCode(code)).Append("\r\n").Append(value).Append("\r\n");
            void Line(int layer, double x1, double y1, double x2, double y2)
            {
                Pair(0, "LINE"); Pair(8, Layer(layer)); Pair(100, "AcDbEntity"); Pair(100, "AcDbLine");
                Pair(10, X(x1)); Pair(20, Y(y1)); Pair(30, "0.0");
                Pair(11, X(x2)); Pair(21, Y(y2)); Pair(31, "0.0");
            }

            sb.Append("0\r\nSECTION\r\n2\r\nHEADER\r\n");
            sb.Append("  9\r\n$ACADVER\r\n  1\r\nACAD1032\r\n");  // R2018 read-compat
            sb.Append("  9\r\n$INSUNITS\r\n 70\r\n   4\r\n");   // millimeters
            sb.Append("0\r\nENDSEC\r\n");

            sb.Append("0\r\nSECTION\r\n2\r\nENTITIES\r\n");

            foreach (var member in ev.Members)
            {
                Line(LayerIndexFor(model, member.Group),
                    ToMm(member.A.X), ToMm(member.A.Y),
                    ToMm(member.B.X), ToMm(member.B.Y));
            }

            foreach (var callout in ev.Callouts)
            {
                Pair(0, "TEXT"); Pair(8, "CALLOUTS");
                Pair(100, "AcDbEntity"); Pair(100, "AcDbText");
                // Anchor points are not parametrically placed in v1; top-right stack.
                var y = 3000 + 400 * calloutAnchorIndex++;
                Pair(10, "12500.0"); Pair(20, Y(y)); Pair(30, "0.0");
                Pair(40, "100.0");
                Pair(1, callout.Label + (callout.State.Length > 0 ? " — " + callout.State : ""));
            }

            foreach (var dimension in ev.Dimensions)
            {
                var dx = dimension.B.X - dimension.A.X;
                var dy = dimension.B.Y - dimension.A.Y;
                var horizontal = Math.Abs(dx) >= Math.Abs(dy);
                var offset = 500 * (1 + dimIdx++);

                if (horizontal)
                {
                    var y = ToMm(Math.Max(dimension.A.Y, dimension.B.Y)) + offset;
                    Line(Dims, ToMm(dimension.A.X), y, ToMm(dimension.B.X), y);
                    Pair(0, "TEXT"); Pair(8, "DIMS");
                    Pair(100, "AcDbEntity"); Pair(100, "AcDbText");
                    Pair(10, X(ToMm((dimension.A.X + dimension.B.X) / 2)));
                    Pair(20, Y(y + 30.0)); Pair(30, "0.0");
                    Pair(40, "60.0"); Pair(1, dimension.Text);
                }
                else
                {
                    var x = ToMm(Math.Min(dimension.A.X, dimension.B.X)) - offset;
                    Line(Dims, x, ToMm(dimension.A.Y), x, ToMm(dimension.B.Y));
                    Pair(0, "TEXT"); Pair(8, "DIMS");
                    Pair(100, "AcDbEntity"); Pair(100, "AcDbText");
                    Pair(10, X(x - 30.0));
                    Pair(20, Y(ToMm((dimension.A.Y + dimension.B.Y) / 2))); Pair(30, "0.0");
                    Pair(40, "60.0"); Pair(1, dimension.Text);
                }
            }

            sb.Append("0\r\nENDSEC\r\n0\r\nEOF\r\n");
            return Encoding.ASCII.GetBytes(sb.ToString());
        }

        private static int dimIdx;
        private static int calloutAnchorIndex;

        private const int Dims = 3;

        private static int LayerIndexFor(DrawingModel model, string group)
        {
            return group switch
            {
                "top" => 0,
                "bot" => 1,
                "web" => 2,
                _ => 2,
            };
        }

        private static string Layer(int index) =>
            index switch
            {
                0 => "GEOM-TOP",
                1 => "GEOM-BOT",
                2 => "GEOM-WEB",
                3 => "DIMS",
                _ => "GEOM-WEB",
            };

        private static double ToMm(double meters) => meters * 1000;

        /// <summary>DXF convention: group codes right-aligned in a 3-character field.</summary>
        private static string FormatCode(int code) =>
            code.ToString(CultureInfo.InvariantCulture).PadLeft(3);

        private static string X(double d) => d.ToString("0.0", CultureInfo.InvariantCulture);
        private static string Y(double d) => d.ToString("0.0", CultureInfo.InvariantCulture);
    }
}
