using System;
using System.Collections.Generic;
using System.Diagnostics;
using Calcpad.Core;
using Xunit;

namespace Calcpad.Tests
{
    public class DrawingSvgWriterTests
    {
        private const string Specimen = """
            #drawing truss-example
            #input L = ? {12}  m
            #input h = ? {3}   m
            #input n = ? {6}   -
            #node n1 (0, 0)
            #node n2 (L/6, h*2/3)
            #node n7 (0, 3)
            #node n7b (12, 0)
            #member m1 n1 n2 group=top
            #member m2 n1 n7b group=bot
            #annotation group=top  label="Top chord"  state="In compression"
            #annotation group=bot  label="Bottom chord"  state="In tension"
            #dimension n1→n2  align=below  text="a = {[L/n]:.3f} m"
            #dimension n1→n7  align=left   text="h = {[h]:.3f} m"
            #dimension n1→n7b  align=below  text="L = {[L]:.3f} m"
            #style top stroke=#4d6f8f width=10
            #style bot stroke=#d9683f width=10
            #style web stroke=#3c4852 width=7
            #view title="Truss Members" subtitle="Gravity load" supports=pin,roller
            """;

        private static (DrawingModel Model, EvaluatedDrawing Evaled) Render()
        {
            var model = DrawingReader.Parse(Specimen);
            var ev = DrawingEvaluator.Evaluate(model, new Dictionary<string, (double Value, Unit Units)>(), isUs: false);
            return (model, ev);
        }

        [Fact]
        public void Write_RootHasClassAndDataAttributes()
        {
            var (model, ev) = Render();
            var svg = DrawingSvgWriter.Write(model, ev, "Truss Drawing/truss-example.cdrw");
            Assert.StartsWith("<svg class=\"drawing\"", svg);
            Assert.Contains("data-drawing-src=\"Truss Drawing/truss-example.cdrw\"", svg);
            Assert.EndsWith("</svg>", svg);
        }

        [Fact]
        public void Write_ThreeLayerGroupsPresent()
        {
            var (model, ev) = Render();
            var svg = DrawingSvgWriter.Write(model, ev, "x.cdrw");
            Assert.Contains("<g class=\"cdrw-geom\"", svg);
            Assert.Contains("<g class=\"cdrw-callouts\"", svg);
            Assert.Contains("<g class=\"cdrw-dims\"", svg);
        }

        [Fact]
        public void Write_NodesCarryIdAndDrivenMarkers()
        {
            var (model, ev) = Render();
            var svg = DrawingSvgWriter.Write(model, ev, "x.cdrw");
            // n1 is literal, n2 is expression-driven.
            Assert.Contains("data-node-id=\"n1\"", svg);
            Assert.Contains("data-node-id=\"n2\"", svg);
            Assert.Matches("(?s).*<circle[^>]*data-node-id=\"n1\"[^>]*data-driven=\"false\".*", svg);
            Assert.Matches("(?s).*<circle[^>]*data-node-id=\"n2\"[^>]*data-driven=\"true\".*", svg);
        }

        [Fact]
        public void Write_NodeMarkersAreWellFormed()
        {
            var (model, ev) = Render();
            var svg = DrawingSvgWriter.Write(model, ev, "x.cdrw");
            // A radius missing its closing quote swallows the fill attribute and leaves the
            // marker unrenderable in the browser.
            Assert.Matches("(?s).*<circle[^>]*\\br=\"[0-9.]+\"\\s[^>]*/>", svg);
            Assert.DoesNotContain("fill=\"\"", svg, StringComparison.Ordinal);
        }

        [Fact]
        public void Write_StylesAppliedAsStrokeAttributes()
        {
            var (model, ev) = Render();
            var svg = DrawingSvgWriter.Write(model, ev, "x.cdrw");
            Assert.Contains("stroke=\"#4d6f8f\"", svg);
            Assert.Contains("stroke=\"#d9683f\"", svg);
        }

        [Fact]
        public void Write_ViewTitleRendered()
        {
            var (model, ev) = Render();
            var svg = DrawingSvgWriter.Write(model, ev, "x.cdrw");
            Assert.Contains("Truss Members", svg);
            Assert.Contains("Gravity load", svg);
        }

        [Fact]
        public void Write_DimensionTextPresent()
        {
            var (model, ev) = Render();
            var svg = DrawingSvgWriter.Write(model, ev, "x.cdrw");
            Assert.Contains("a = 2.000 m", svg);
            Assert.Contains("L = 12.000 m", svg);
        }

        [Fact]
        public void Write_NoScriptTag()
        {
            var (model, ev) = Render();
            var svg = DrawingSvgWriter.Write(model, ev, "x.cdrw");
            Assert.DoesNotContain("<script", svg, StringComparison.OrdinalIgnoreCase);
        }

        [Fact]
        public void Write_Deterministic()
        {
            var (model, ev) = Render();
            Assert.Equal(
                DrawingSvgWriter.Write(model, ev, "x.cdrw"),
                DrawingSvgWriter.Write(model, ev, "x.cdrw"));
        }

        [Fact]
        public void Write_SupRenders()
        {
            // Supports configured → the sv supports=path po draws a support glyph.
            var (model, ev) = Render();
            var svg = DrawingSvgWriter.Write(model, ev, "x.cdrw");
            Assert.Contains("data-support", svg);
        }

        // Spec §10: 10k-entity budget. The 100 ms figure is for developer machines;
        // CI margin 250 ms avoids flaky failure on shared runners.
        [Fact]
        public void Write_TenThousandEntities_Under250MsOnCi()
        {
            const int side = 100;
            var sb = new System.Text.StringBuilder("#drawing big\n");
            for (var i = 0; i < side * side; i++)
            {
                var x = i % side * 120.0;
                var y = i / side * 120.0;
                sb.Append(System.Globalization.CultureInfo.InvariantCulture,
                    $"#node p{i} ({x}, {y})\n");
            }

            for (var i = 0; i < side * side - 1; i++)
                sb.Append($"#member m{i} p{i} p{i + 1} group=web\n");

            var model = DrawingReader.Parse(sb.ToString(), out var errors);
            Assert.Empty(errors);
            var ev = DrawingEvaluator.Evaluate(model, new Dictionary<string, (double Value, Unit Units)>(), isUs: false);

            var clock = Stopwatch.StartNew();
            var svg = DrawingSvgWriter.Write(model, ev, "big.cdrw");
            clock.Stop();
            Assert.True(clock.ElapsedMilliseconds < 250,
                $"10k-entity render took {clock.ElapsedMilliseconds} ms (budget 250 ms on CI).");
            Assert.Contains("p0", svg);
        }
    }
}
