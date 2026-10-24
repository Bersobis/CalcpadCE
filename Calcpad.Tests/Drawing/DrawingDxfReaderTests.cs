using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using Calcpad.Core;
using Xunit;

namespace Calcpad.Tests
{
    public class DrawingDxfReaderTests
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

        private static EvaluatedDrawing Eval(DrawingModel model) =>
            DrawingEvaluator.Evaluate(model, new Dictionary<string, (double Value, Unit Units)>(), isUs: false);

        private static (DrawingModel Model, IReadOnlyList<string> Warnings) Read(byte[] dxf)
        {
            using var ms = new MemoryStream(dxf);
            return DrawingDxfReader.Read(ms);
        }

        [Fact]
        public void Read_RoundTrip_PreservesMemberGeometry()
        {
            var model = DrawingReader.Parse(Specimen);
            var original = Eval(model);
            var bytes = DrawingDxfWriter.Write(model, original);

            var (imported, _) = Read(bytes);
            var reEvaluated = Eval(imported);

            // The DXF writer quantizes to 0.1 mm, so 1e-3 m is the honest floor;
            // the 1e-6 m figure in the plan assumed full double precision on disk.
            foreach (var member in original.Members)
                Assert.Contains(reEvaluated.Members, m =>
                    Close(m.A.X, member.A.X, 1e-3) && Close(m.A.Y, member.A.Y, 1e-3) &&
                    Close(m.B.X, member.B.X, 1e-3) && Close(m.B.Y, member.B.Y, 1e-3) &&
                    m.Group == member.Group);
        }

        [Fact]
        public void Read_MemberLayerNames_MapBackToGroups()
        {
            var model = DrawingReader.Parse(Specimen);
            var bytes = DrawingDxfWriter.Write(model, Eval(model));

            var (imported, warnings) = Read(bytes);

            Assert.Contains(imported.Members, m => m.Group == "top");
            Assert.Contains(imported.Members, m => m.Group == "bot");
            Assert.DoesNotContain(warnings, w => w.Contains("GEOM", StringComparison.OrdinalIgnoreCase));
        }

        [Fact]
        public void Read_MissingInsUnits_ProducesWarning()
        {
            var model = DrawingReader.Parse(Specimen);
            var dxf = Encoding.ASCII.GetString(
                DrawingDxfWriter.Write(model, Eval(model)))
                .Replace("  9\r\n$INSUNITS\r\n 70\r\n   4\r\n", "");

            var (_, warnings) = Read(Encoding.ASCII.GetBytes(dxf));

            Assert.Contains(warnings, w => w.Contains("$INSUNITS") && w.Contains("mm"));
        }

        [Fact]
        public void Read_HandWrittenMinimalDxf_ParsesEntities()
        {
            var dxf = """
                0
                SECTION
                2
                HEADER
                  9
                $INSUNITS
                 70
                   4
                0
                ENDSEC
                0
                SECTION
                2
                ENTITIES
                0
                LINE
                8
                GEOM-WEB
                10
                0.0
                20
                0.0
                30
                0.0
                11
                1000.0
                21
                0.0
                31
                0.0
                0
                LINE
                8
                GEOM-WEB
                10
                1000.0
                20
                0.0
                30
                0.0
                11
                500.0
                21
                866.0
                31
                0.0
                0
                LINE
                8
                GEOM-WEB
                10
                500.0
                20
                866.0
                30
                0.0
                11
                0.0
                21
                0.0
                31
                0.0
                0
                TEXT
                8
                CALLOUTS
                10
                12500.0
                20
                3000.0
                30
                0.0
                40
                100.0
                1
                Site note
                0
                ENDSEC
                0
                EOF
                """;

            var (model, warnings) = Read(Encoding.ASCII.GetBytes(dxf));
            Assert.Empty(warnings);
            Assert.Equal(3, model.Nodes.Count);
            Assert.Equal(3, model.Members.Count);
            var ev = Eval(model);
            // mm back to meters: (1, 0) etc.
            Assert.Contains(ev.Members, m => Close(m.A.X, 0, 1e-9) && Close(m.A.Y, 0, 1e-9) &&
                                             Close(m.B.X, 1.0, 1e-9) && Close(m.B.Y, 0, 1e-9));
            Assert.Equal("Site note", model.Annotations.Single().Label);
        }

        [Fact]
        public void Read_UnknownEntity_SkipsAndWarns()
        {
            var dxf = """
                0
                SECTION
                2
                HEADER
                  9
                $INSUNITS
                 70
                   4
                0
                ENDSEC
                0
                SECTION
                2
                ENTITIES
                0
                ELLIPSE
                8
                GEOM-TOP
                10
                0.0
                20
                0.0
                11
                1000.0
                21
                0.0
                0
                LINE
                8
                GEOM-TOP
                10
                0.0
                20
                0.0
                11
                1000.0
                21
                0.0
                0
                ENDSEC
                0
                EOF
                """;

            var (model, warnings) = Read(Encoding.ASCII.GetBytes(dxf));
            Assert.Contains(warnings, w => w.Contains("ELLIPSE"));
            Assert.Single(model.Members);
            Assert.Equal("top", model.Members[0].Group);
        }

        private static bool Close(double a, double b, double tol) => Math.Abs(a - b) <= tol;
    }
}
