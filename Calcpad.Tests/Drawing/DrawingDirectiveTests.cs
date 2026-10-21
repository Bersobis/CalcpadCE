using System;
using System.IO;
using Calcpad.Core;
using Xunit;

namespace Calcpad.Tests
{
    public class DrawingDirectiveTests : IDisposable
    {
        private readonly string _dir;
        private readonly string _sourcePath;

        public DrawingDirectiveTests()
        {
            _dir = Path.Combine(Path.GetTempPath(), "calcpad-drawing-" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(_dir);
            _sourcePath = Path.Combine(_dir, "doc.cpd");
        }

        public void Dispose()
        {
            try { Directory.Delete(_dir, true); }
            catch (IOException) { }
        }

        private const string Sidecar = """
            #drawing truss-example
            #input L = ? {12}  m
            #input h = ? {3}   m
            #node n1 (0, 0)
            #node n2 (L/6, h)
            #member m1 n1 n2 group=top
            #view title="Truss"
            """;

        private string Render(string source)
        {
            var macroParser = new MacroParser();
            Assert.False(macroParser.Parse(source, out var expanded, null, 0, false), expanded);
            var parser = new ExpressionParser
            {
                Settings = new Settings(),
                Debug = true,
                SourceFilePath = _sourcePath,
            };
            parser.Parse(expanded, true, false);
            return parser.HtmlResult;
        }

        [Fact]
        public void Render_WithSidecarAndBinding_RendersDrawingSvg()
        {
            var sidecar = Path.Combine(_dir, "truss-example.cdrw");
            File.WriteAllText(sidecar, Sidecar);

            var html = Render($"L_w = 6m\n$drawing{{ truss-example.cdrw; L = L_w }}");

            Assert.Contains("<svg class=\"drawing\"", html);
            Assert.Contains("data-drawing-src", html);
            Assert.Contains("cdrw-geom", html);
            Assert.DoesNotContain("<script", html);
        }

        [Fact]
        public void Render_MissingSidecar_ProducesVisibleErrorWithoutThrowing()
        {
            var html = Render("$drawing{ nope.cdrw }");

            Assert.Contains("nope.cdrw", html);
        }

        [Fact]
        public void Render_BindingUsesUndefinedVariable_ReportsTheVariable()
        {
            var sidecar = Path.Combine(_dir, "truss-example.cdrw");
            File.WriteAllText(sidecar, Sidecar);

            var html = Render("$drawing{ truss-example.cdrw; L = Q_missing }");

            Assert.Contains("Q_missing", html);
        }

        [Fact]
        public void Render_UnitMismatch_ReportsTheInput()
        {
            var sidecar = Path.Combine(_dir, "truss-example.cdrw");
            File.WriteAllText(sidecar, Sidecar);

            var html = Render("t = 2s\n$drawing{ truss-example.cdrw; L = t }");

            Assert.Contains("L", html);
            Assert.True(html.Contains("compatible") || html.Contains("'m'"), html);
        }

        [Fact]
        public void Render_BrokenDirective_RecordsError()
        {
            var sidecar = Path.Combine(_dir, "truss-example.cdrw");
            File.WriteAllText(sidecar, "#drawing truss-example\n#input L = ? {12} m\n#node n1 (0, 0)\n#node n2 (L, 0)\n#member m1 n1 nX group=top\n");
            var macroParser = new MacroParser();
            Assert.False(macroParser.Parse("$drawing{ truss-example.cdrw }", out var expanded, null, 0, false), expanded);
            var parser = new ExpressionParser
            {
                Settings = new Settings(),
                Debug = true,
                SourceFilePath = _sourcePath,
            };
            parser.Parse(expanded, true, false);

            Assert.NotEmpty(parser.Errors);
        }

        [Fact]
        public void Render_SidecarSyntaxError_ReportsSidecarFile()
        {
            var sidecar = Path.Combine(_dir, "truss-example.cdrw");
            File.WriteAllText(sidecar, "#drawing truss-example\n#input L = ? {12} m\n#node n1 (0, 0)\n#member m1 n1 nZ group=top\n");

            var html = Render("$drawing{ truss-example.cdrw }");

            Assert.Contains("truss-example.cdrw", html);
        }
    }
}
