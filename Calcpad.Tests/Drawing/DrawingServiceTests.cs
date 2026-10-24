using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using Calcpad.Server.Services;
using Xunit;

namespace Calcpad.Tests
{
    public class DrawingServiceTests : IDisposable
    {
        private readonly string _dir;
        private readonly string _documentPath;

        public DrawingServiceTests()
        {
            _dir = Path.Combine(Path.GetTempPath(), "calcpad-drawing-service-" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(_dir);
            _documentPath = Path.Combine(_dir, "doc.cpd");
        }

        public void Dispose()
        {
            try { Directory.Delete(_dir, true); }
            catch (IOException) { }
        }

        private const string Sidecar = """
            #drawing truss
            #input L = ? {12} m
            #input h = ? {3} m
            #node n1 (0, 0)
            #node n2 (L/6, h)
            #member m1 n1 n2 group=top
            #view title="Truss"
            """;

        private string WriteSidecar(string name = "truss.cdrw")
        {
            var path = Path.Combine(_dir, name);
            File.WriteAllText(path, Sidecar);
            return name;
        }

        [Fact]
        public void Parse_ReturnsSvgAndMarksDrivenNodes()
        {
            var name = WriteSidecar();

            var result = DrawingService.Parse(_documentPath, name);

            Assert.Contains("data-drawing-src=\"" + name + "\"", result.Svg);
            Assert.Equal("truss", result.Name);
            Assert.True(result.Nodes["n2"].Driven);
            Assert.False(result.Nodes["n1"].Driven);
            Assert.Equal(2.0, result.Nodes["n2"].X, 6);
            Assert.Empty(result.Warnings);
        }

        [Fact]
        public void Save_RewritesLiteralCoordinatesCanonically()
        {
            var name = WriteSidecar();

            DrawingService.Save(_documentPath, name, new Dictionary<string, DrawingService.NodePoint>
            {
                ["n1"] = new(1.5, 2),
            });

            var text = File.ReadAllText(Path.Combine(_dir, name));
            Assert.Contains("#node n1 (1.5, 2)", text);
            Assert.Contains("#node n2 (L/6, h)", text);
        }

        [Fact]
        public void Save_ReplacesExpressionWithDraggedLiteral()
        {
            var name = WriteSidecar();

            DrawingService.Save(_documentPath, name, new Dictionary<string, DrawingService.NodePoint>
            {
                ["n2"] = new(7, 0.75),
            });

            var text = File.ReadAllText(Path.Combine(_dir, name));
            Assert.Contains("#node n2 (7, 0.75)", text);
            Assert.DoesNotContain("L/6", text);

            var reparsed = DrawingService.Parse(_documentPath, name);
            Assert.False(reparsed.Nodes["n2"].Driven);
        }

        [Fact]
        public void Save_UnknownNodeIsRejected()
        {
            var name = WriteSidecar();

            var error = Assert.Throws<DrawingServiceException>(() =>
                DrawingService.Save(_documentPath, name, new Dictionary<string, DrawingService.NodePoint>
                {
                    ["n99"] = new(1, 1),
                }));

            Assert.Contains("n99", error.Message);
            Assert.Equal(404, error.Status);
        }

        [Fact]
        public void ExportDxf_EmitsSectionHeader()
        {
            var name = WriteSidecar();

            var bytes = DrawingService.ExportDxf(_documentPath, name);
            var text = Encoding.ASCII.GetString(bytes);

            Assert.StartsWith("0\r\nSECTION", text);
            Assert.Contains("LINE", text);
        }

        [Fact]
        public void ImportDxf_ProducesLiteralSidecar()
        {
            var name = WriteSidecar();
            var dxf = new MemoryStream(DrawingService.ExportDxf(_documentPath, name));

            var result = DrawingService.ImportDxf(dxf);

            Assert.Contains("#drawing", result.Cdrw);
            Assert.Contains("#node", result.Cdrw);
            Assert.Contains("#member", result.Cdrw);
        }

        [Fact]
        public void Resolve_RejectsTraversalOutsideDocumentDirectory()
        {
            Assert.Throws<DrawingServiceException>(() => DrawingService.Resolve(_documentPath, "../escape.cdrw"));
        }

        [Fact]
        public void Resolve_RejectsNonSidecarExtension()
        {
            Assert.Throws<DrawingServiceException>(() => DrawingService.Resolve(_documentPath, "truss.cpd"));
        }

        [Fact]
        public void Parse_MissingSidecarIsReported()
        {
            var error = Assert.Throws<DrawingServiceException>(() => DrawingService.Parse(_documentPath, "absent.cdrw"));
            Assert.Equal(404, error.Status);
        }
    }
}
