using System;
using System.Collections.Generic;
using System.Text;
using Calcpad.Core;
using Xunit;

namespace Calcpad.Tests
{
    public class DrawingDxfWriterTests
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
            #dimension n1→n7b  align=below  text="L = {[L]:.3f} m"
            #style top stroke=#4d6f8f width=10
            #view title="Truss Members"
            """;

        private static EvaluatedDrawing Eval()
        {
            var model = DrawingReader.Parse(Specimen);
            return DrawingEvaluator.Evaluate(model, new Dictionary<string, (double Value, Unit Units)>(), isUs: false);
        }

        [Fact]
        public void Write_HasHeaderAndEntitiesSections()
        {
            var dxf = Encoding.ASCII.GetString(DrawingDxfWriter.Write(DrawingReader.Parse(Specimen), Eval()));
            Assert.Contains("SECTION", dxf);
            Assert.Contains("HEADER", dxf);
            Assert.Contains("ENTITIES", dxf);
            Assert.EndsWith("EOF", dxf.TrimEnd() + "\r\nEOF");
        }

        [Fact]
        public void Write_InsUnitsIsMillimeters()
        {
            var dxf = Encoding.ASCII.GetString(DrawingDxfWriter.Write(DrawingReader.Parse(Specimen), Eval()));
            Assert.Contains("$INSUNITS", dxf);
            Assert.Contains("   4\r\n", dxf); // 4 = millimeters
        }

        [Fact]
        public void Write_MemberGeometry_ConvertedToMm()
        {
            var dxf = Encoding.ASCII.GetString(DrawingDxfWriter.Write(DrawingReader.Parse(Specimen), Eval()));
            // m2: n1 (0,0) → n7b (12,0) → (0,0)-(12000,0)
            Assert.Contains("0\r\nLINE\r\n", dxf);
            Assert.Contains("12000.0\r\n", dxf);
        }

        [Fact]
        public void Write_LayersPerGroupAndAnnotation()
        {
            var dxf = Encoding.ASCII.GetString(DrawingDxfWriter.Write(DrawingReader.Parse(Specimen), Eval()));
            Assert.Contains("GEOM-TOP", dxf);
            Assert.Contains("GEOM-BOT", dxf);
            Assert.Contains("CALLOUTS", dxf);
            Assert.Contains("DIMS", dxf);
        }

        [Fact]
        public void Write_DimensionTextPresent()
        {
            var dxf = Encoding.ASCII.GetString(DrawingDxfWriter.Write(DrawingReader.Parse(Specimen), Eval()));
            Assert.Contains("L = 12.000 m", dxf);
        }
    }
}
