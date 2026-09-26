namespace Calcpad.Tests
{
    public class SettingsDirectiveTests
    {
        private static string Render(string source)
        {
            var parser = new ExpressionParser { Settings = new Settings() };
            parser.Parse(source, true, false);
            return parser.HtmlResult;
        }

        // The substitution step is inline on a single bracketed line or a grid of aligned
        // cells. Calculated results are always the grid, so both markers can coexist.
        private const string Grid = "<span class=\"matrix\">";
        private const string Inline = "<span class=\"b0\">[</span>";

        [Fact]
        public void SettingsDirective_AppliesDecimals()
        {
            var html = Render("#settings {\"decimals\": 4}\nx = 6.12345");
            Assert.Contains("6.1235", html);
        }

        [Fact]
        public void SettingsDirective_AppliesInlineMatrices()
        {
            var substitution = SubstitutionOf(Render("F = 6\n#settings {\"inlineMatrices\": true}\n[F; 2; 3]"));

            Assert.Contains(Inline, substitution);
            Assert.DoesNotContain(Grid, substitution);
        }

        [Fact]
        public void SettingsDirective_ChangesInlineMatricesMidFile()
        {
            // a substitutes inline, b substitutes as a grid again. Counting the grids per
            // equation: a has only its result, b has the literal and the substituted value.
            var html = Render(
                "F = 6\n#settings {\"inlineMatrices\": true}\na = [1; 2; F]\n" +
                "#settings {\"inlineMatrices\": false}\nb = [1; 2; F]");
            var equations = html.Split("<span class=\"eq\">").Skip(1).ToArray();

            Assert.Equal(3, equations.Length);
            Assert.Contains(Inline, equations[1]);
            Assert.Equal(1, CountOccurrences(equations[1], Grid));
            Assert.Equal(2, CountOccurrences(equations[2], Grid));
        }

        [Fact]
        public void SettingsDirective_LeavesInlineAsTheDefault()
        {
            var html = Render("F = 6\n[F; 2; 3]");
            var substitution = SubstitutionOf(html);

            Assert.Contains(Inline, substitution);
            Assert.DoesNotContain(Grid, substitution);
            Assert.Contains(Grid, ResultOf(html));
        }

        /// <summary>Substitution step of the last equation, i.e. what sits between the two " = ".</summary>
        private static string SubstitutionOf(string html) => Parts(html) is { Length: > 2 } p ? p[1] : Parts(html)[0];

        private static string ResultOf(string html) => Parts(html)[^1];

        private static string[] Parts(string html)
        {
            var start = html.LastIndexOf("<span class=\"eq\">", StringComparison.Ordinal);
            return html[start..].Split(" = ");
        }

        private static int CountOccurrences(string text, string value)
        {
            var count = 0;
            var start = 0;
            while ((start = text.IndexOf(value, start, StringComparison.Ordinal)) >= 0)
            {
                ++count;
                start += value.Length;
            }

            return count;
        }

        [Fact]
        public void SettingsDirective_ChangesSettingsMidFile()
        {
            // The directive applies to every line after it, so a second directive
            // must change the precision of subsequent output.
            var html = Render("#settings {\"decimals\": 4}\nx = 6.12345\n#settings {\"decimals\": 2}\ny = 8.7654");
            Assert.Contains("6.1235", html);       // x, four decimals
            Assert.Contains("8.77", html);         // y, two decimals
            Assert.DoesNotContain("8.7654", html); // y is not rendered at four decimals
        }

        private static string PlotWidthStyle(string source)
        {
            var m = System.Text.RegularExpressions.Regex.Match(Render(source), @"width:(\d+)pt");
            return m.Success ? m.Groups[1].Value : null;
        }

        [Fact]
        public void SettingsDirective_LaterDirective_OverridesEarlierVariable()
        {
            const string plot = "\n$Plot{ x^2 @ x = 0 : 2 }";
            var variableOnly = PlotWidthStyle("PlotWidth = 800" + plot);
            var directiveOnly = PlotWidthStyle("#settings {\"plotWidth\": 400}" + plot);
            // #settings after the variable assignment must win (latest value).
            var directiveAfterVariable = PlotWidthStyle("PlotWidth = 800\n#settings {\"plotWidth\": 400}" + plot);

            Assert.NotNull(variableOnly);
            Assert.NotEqual(variableOnly, directiveOnly);
            Assert.Equal(directiveOnly, directiveAfterVariable);
        }

        [Fact]
        public void SettingsDirective_LaterVariable_OverridesEarlierDirective()
        {
            const string plot = "\n$Plot{ x^2 @ x = 0 : 2 }";
            var variableOnly = PlotWidthStyle("PlotWidth = 800" + plot);
            // A variable assignment after the directive must win (latest value).
            var variableAfterDirective = PlotWidthStyle("#settings {\"plotWidth\": 400}\nPlotWidth = 800" + plot);

            Assert.NotNull(variableOnly);
            Assert.Equal(variableOnly, variableAfterDirective);
        }

        [Fact]
        public void SettingsDirective_SettingControllingVariable_StaysReadable()
        {
            // Applying a #settings key writes through to its special variable, so
            // the variable resolves afterwards even without an explicit assignment.
            var html = Render("#settings {\"plotWidth\": 400}\nw = PlotWidth");
            Assert.Contains("400", html);
        }

        [Fact]
        public void SettingsDirective_MalformedJson_ReportsError()
        {
            var parser = new ExpressionParser { Settings = new Settings(), Debug = true };
            parser.Parse("#settings {not valid}\nx = 1", true, false);
            Assert.Contains("Invalid JSON in #settings", parser.HtmlResult);
        }

        [Fact]
        public void SettingsDirective_UnknownKey_IsIgnored()
        {
            // Unrecognized keys are silently ignored by the engine (the linter warns).
            var parser = new ExpressionParser { Settings = new Settings(), Debug = true };
            parser.Parse("#settings {\"nonsense\": 4}\nx = 1", true, false);
            Assert.DoesNotContain("Invalid JSON in #settings", parser.HtmlResult);
        }
    }
}
