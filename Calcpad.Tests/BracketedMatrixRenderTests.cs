namespace Calcpad.Tests;

public class BracketedMatrixRenderTests
{
    private const string Row = "<span class=\"tr\">";
    private const string Matrix = "<span class=\"matrix\">";

    [Fact]
    public void RowDivisor_RendersOneRowPerDivisor()
    {
        var html = Render("F = 6\n[F; F|F; F]\n");
        var literal = LiteralOf(html);

        Assert.Equal(2, CountOccurrences(literal, Row));
        Assert.Equal(4, CountOccurrences(literal, "<span class=\"td\"><var>F</var></span>"));
        Assert.Contains("<span class=\"td\">6</span>", html);
    }

    [Fact]
    public void NoRowDivisor_RendersSingleRowWithOneCellPerItem()
    {
        var html = Render("F = 6\n[F; F; F; F]\n");
        var literal = LiteralOf(html);

        Assert.Equal(1, CountOccurrences(literal, Row));
        Assert.Equal(4, CountOccurrences(literal, "<span class=\"td\"><var>F</var></span>"));
        Assert.Contains("<span class=\"td\">6</span>", html);
    }

    [Fact]
    public void StructuredRendering_NeverEmitsSeparators()
    {
        var html = Render("F = 6\n[F; F|F; F]\n[F; F; F; F]\n");

        Assert.DoesNotContain("6; 6", html);
        Assert.DoesNotContain("<b class=\"b0\">|</b>", html);
    }

    [Fact]
    public void EveryRow_HasEmptyBracketCells()
    {
        var html = Render("F = 6\n[F; F|F; F]\n[F; F; F; F]\n");

        var rows = html.Split(Row).Skip(1).ToArray();
        Assert.NotEmpty(rows);
        foreach (var row in rows)
        {
            Assert.StartsWith("<span class=\"td\"></span>", row);
            Assert.Contains("<span class=\"td\"></span></span>", row);
        }
    }

    [Fact]
    public void GridMatVec_IsTheDefault()
    {
        Assert.Contains(Matrix, Render("F = 6\n[F; F; F; F]\n"));
    }

    [Fact]
    public void GridMatVec_SwitchesBackFromInlineRendering()
    {
        var inline = Render("F = 6\n#inlineMatVec\n[F; F; F; F]\n");
        var restored = Render("F = 6\n#inlineMatVec\n#gridMatVec\n[F; F; F; F]\n");

        Assert.DoesNotContain(Matrix, inline);
        Assert.Contains(Matrix, restored);
    }

    [Fact]
    public void WhenBothDirectivesAppear_TheLastOneWins()
    {
        var inlineLast = Render("F = 6\n#gridMatVec\n#inlineMatVec\n[F; F; F; F]\n");
        var gridLast = Render("F = 6\n#inlineMatVec\n#gridMatVec\n[F; F; F; F]\n");

        Assert.DoesNotContain(Matrix, inlineLast);
        Assert.Contains(Matrix, gridLast);
    }

    [Fact]
    public void InlineMatVec_RestoresSingleLineVectorRendering()
    {
        var html = Render("#inlineMatVec\nF = 6\n[F; F; F; F]\n");

        Assert.DoesNotContain(Matrix, html);
        Assert.Contains("6; 6", html);
    }

    [Fact]
    public void InlineMatVec_RestoresSingleLineMatrixLiteral()
    {
        var html = Render("#inlineMatVec\nF = 6\n[F; F|F; F]\n");

        Assert.Contains("<span class=\"b0\">[</span>", LiteralOf(html));
        Assert.Contains("6; 6", html);
    }

    [Fact]
    public void RaggedRows_ArePaddedToTheWidestRow()
    {
        // B is triangular: 1, 2, 3 and 2 items. Unpadded, :last-child lands in a different
        // column per row and the right bracket comes out stair-stepped.
        var segments = Render("B = [1|2; 3|4; 5; 6|7; 8]\n").Split(Row).Skip(1).ToArray();

        Assert.Equal(8, segments.Length); // 4 rows for the literal, 4 for the value
        foreach (var segment in segments)
        {
            const string end = "</span></span>";
            var row = segment[..(segment.IndexOf(end, StringComparison.Ordinal) + end.Length)];

            Assert.Equal(5, CountOccurrences(row, "<span class=\"td\">"));
            Assert.EndsWith("<span class=\"td\"></span></span>", row);
        }
    }

    [Fact]
    public void SingleElementVector_GridMode_RendersAsMatrix()
    {
        var html = Render("[42]\n");

        Assert.Contains(Matrix, html);
        Assert.DoesNotContain("42; ", html);
    }

    [Fact]
    public void SingleElementVector_InlineMode_RendersBracketedScalar()
    {
        var html = Render("#inlineMatVec\n[42]\n");

        Assert.DoesNotContain(Matrix, html);
    }

    [Theory]
    [InlineData("[1; 2; 3; 4; 5; 6; 7; 8; 9; 10; 11; 12; 13; 14; 15; 16; 17; 18; 19; 20; 21; 22]")]
    public void LargeVector_TruncatesWithEllipsis(string source)
    {
        var html = Render(source + "\n");

        Assert.Contains("elements skipped", html);
        Assert.Contains(Matrix, html);
    }

    [Fact]
    public void LargeVector_InlineMode_TruncatesWithEllipsis()
    {
        var source = "[1; 2; 3; 4; 5; 6; 7; 8; 9; 10; 11; 12; 13; 14; 15; 16; 17; 18; 19; 20; 21; 22]";
        var html = Render("#inlineMatVec\n" + source + "\n");

        Assert.Contains("elements skipped", html);
        Assert.DoesNotContain(Matrix, html);
    }

    [Fact]
    public void VectorWithUnits_GridMode_AppendsUnitsAfterMatrix()
    {
        // hp vectors carry a shared unit that follows the bracket
        var html = Render("A = vector_hp(3)\nA[1] = 1*m\nA[2] = 2*m\nA[3] = 3*m\nA\n");

        Assert.Contains(Matrix, html);
    }

    [Fact]
    public void DirectiveResetsToGridAtDocumentStart()
    {
        // A first parse with #inlineMatVec must not bleed into a second independent parse.
        var firstHtml = Render("#inlineMatVec\n[1; 2; 3]\n");
        var secondHtml = Render("[1; 2; 3]\n");

        Assert.DoesNotContain(Matrix, firstHtml);
        Assert.Contains(Matrix, secondHtml);
    }

    [Fact]
    public void MultipleDirectiveSwitches_AllTakeEffect()
    {
        // inline → grid → inline: each directive must override the previous.
        var html = Render("#inlineMatVec\n#gridMatVec\n#inlineMatVec\n[1; 2; 3]\n");

        Assert.DoesNotContain(Matrix, html);
    }

    [Fact]
    public void XmlWriter_RendersStructuredMatrix()
    {
        var xml = RenderAs("[6; 6|6; 6]", parser => parser.ToXml());

        Assert.Contains("<m:d>", xml);
        Assert.Contains("<m:mr>", xml);
        Assert.DoesNotContain(";", xml);
    }

    [Fact]
    public void TextWriter_RendersSingleLineWithoutSeparators()
    {
        var text = RenderAs("[6; 6|6; 6]", parser => parser.ToString());

        Assert.Contains("[6  6 |6  6]", text);
        Assert.DoesNotContain(";", text);
    }

    private static string RenderAs(string expression, Func<MathParser, string> render)
    {
        var parser = new MathParser(new MathSettings());
        parser.Parse(expression);
        parser.Calculate();
        return render(parser);
    }

    /// <summary>The unevaluated bracketed group, i.e. everything before the first " = ".</summary>
    private static string LiteralOf(string html)
    {
        var start = html.LastIndexOf("<span class=\"eq\">", StringComparison.Ordinal);
        var end = html.IndexOf(" = ", start, StringComparison.Ordinal);
        return html[start..end];
    }

    private static string Render(string source)
    {
        var macroParser = new MacroParser();
        var hasMacroErrors = macroParser.Parse(source, out var expandedSource, null, 0, false);
        Assert.False(hasMacroErrors);

        var parser = new ExpressionParser();
        parser.Parse(expandedSource, true, false);

        return parser.HtmlResult;
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
}
