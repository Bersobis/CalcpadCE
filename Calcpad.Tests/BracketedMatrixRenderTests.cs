namespace Calcpad.Tests;

public class BracketedMatrixRenderTests
{
    private const string Row = "<span class=\"tr\">";
    private const string Cell = "<span class=\"td\">";
    private const string EmptyCell = "<span class=\"td\"></span>";
    private const string Matrix = "<span class=\"matrix\">";
    private const string Bracket = "<span class=\"b0\">[</span>";
    private const string Inline = "#settings {\"inlineMatrices\": true}";
    private const string Grid = "#settings {\"inlineMatrices\": false}";

    [Fact]
    public void RowDivisor_RendersOneRowPerDivisor()
    {
        var html = Render($"F = 6\n{Grid}\n[F; F|F; F]\n");
        var literal = LiteralOf(html);

        Assert.Equal(2, CountOccurrences(literal, Row));
        Assert.Equal(4, CountOccurrences(literal, Cell + "<var>F</var></span>"));
        Assert.Contains(Cell + "6</span>", html);
    }

    [Fact]
    public void NoRowDivisor_RendersSingleRowWithOneCellPerItem()
    {
        var html = Render($"F = 6\n{Grid}\n[F; F; F; F]\n");
        var literal = LiteralOf(html);

        Assert.Equal(1, CountOccurrences(literal, Row));
        Assert.Equal(4, CountOccurrences(literal, Cell + "<var>F</var></span>"));
        Assert.Contains(Cell + "6</span>", html);
    }

    [Fact]
    public void StructuredRendering_NeverEmitsSeparators()
    {
        var html = Render($"F = 6\n{Grid}\n[F; F|F; F]\n[F; F; F; F]\n");

        Assert.DoesNotContain("6; 6", html);
        Assert.DoesNotContain("<b class=\"b0\">|</b>", html);
    }

    [Fact]
    public void EveryRow_HasEmptyBracketCells()
    {
        var html = Render($"F = 6\n{Grid}\n[F; F|F; F]\n[F; F; F; F]\n");

        var rows = html.Split(Row).Skip(1).ToArray();
        Assert.NotEmpty(rows);
        foreach (var row in rows)
        {
            Assert.StartsWith(EmptyCell, row);
            Assert.Contains(EmptyCell + "</span>", row);
        }
    }

    [Fact]
    public void Result_IsAlwaysAGrid_WhateverTheSetting()
    {
        var inline = ResultOf(Render($"F = 6\n{Inline}\n[F; F|F; F]\n"));
        var grid = ResultOf(Render($"F = 6\n{Grid}\n[F; F|F; F]\n"));

        Assert.Contains(Matrix, inline);
        Assert.Contains(Matrix, grid);
    }

    [Fact]
    public void Substitution_IsInlineByDefault()
    {
        var substitution = SubstitutionOf(Render("F = 6\n[F; F; F; F]\n"));

        Assert.Contains("6; 6", substitution);
        Assert.DoesNotContain(Matrix, substitution);
    }

    [Fact]
    public void GridSetting_RendersTheSubstitutionAsAGrid()
    {
        var substitution = SubstitutionOf(Render($"F = 6\n{Grid}\n[F; F; F; F]\n"));

        Assert.Contains(Matrix, substitution);
        Assert.Equal(1, CountOccurrences(substitution, Row));
    }

    [Fact]
    public void WhenBothSettingsAppear_TheLastOneWins()
    {
        var inlineLast = SubstitutionOf(Render($"F = 6\n{Grid}\n{Inline}\n[F; F; F; F]\n"));
        var gridLast = SubstitutionOf(Render($"F = 6\n{Inline}\n{Grid}\n[F; F; F; F]\n"));

        Assert.DoesNotContain(Matrix, inlineLast);
        Assert.Contains(Matrix, gridLast);
    }

    [Fact]
    public void InlineMatrices_RendersSubstitutionAsSingleLineVector()
    {
        var substitution = SubstitutionOf(Render($"{Inline}\nF = 6\n[F; F; F; F]\n"));

        Assert.Contains("6; 6", substitution);
        Assert.Contains(Bracket, substitution);
    }

    [Fact]
    public void InlineMatrices_RendersSubstitutionAsSingleLineMatrixLiteral()
    {
        var substitution = SubstitutionOf(Render($"{Inline}\nF = 6\n[F; F|F; F]\n"));

        Assert.Contains(Bracket, substitution);
        Assert.Contains("6; 6", substitution);
    }

    [Fact]
    public void RaggedRows_ArePaddedToTheWidestRow()
    {
        // B is triangular: 1, 2, 3 and 2 items. Unpadded, :last-child lands in a different
        // column per row and the right bracket comes out stair-stepped.
        var segments = Render($"{Grid}\nB = [1|2; 3|4; 5; 6|7; 8]\n").Split(Row).Skip(1).ToArray();

        Assert.Equal(8, segments.Length); // 4 rows for the literal, 4 for the result
        foreach (var segment in segments)
        {
            const string end = "</span></span>";
            var row = segment[..(segment.IndexOf(end, StringComparison.Ordinal) + end.Length)];

            Assert.Equal(5, CountOccurrences(row, Cell));
            Assert.EndsWith(EmptyCell + "</span>", row);
        }
    }

    [Fact]
    public void SingleElementVector_GridMode_RendersTheLiteralAsAGrid()
    {
        var html = Render($"{Grid}\n[42]\n");

        Assert.Contains(Matrix, LiteralOf(html));
        Assert.DoesNotContain("42; ", html);
    }

    [Fact]
    public void SingleElementVector_InlineMode_RendersTheLiteralInline()
    {
        var html = Render($"{Inline}\n[42]\n");

        Assert.DoesNotContain(Matrix, LiteralOf(html));
        Assert.Contains(Matrix, ResultOf(html));
    }

    [Theory]
    [InlineData("[1; 2; 3; 4; 5; 6; 7; 8; 9; 10; 11; 12; 13; 14; 15; 16; 17; 18; 19; 20; 21; 22]")]
    public void LargeVector_TruncatesWithEllipsis(string source)
    {
        var html = Render($"{Grid}\n" + source + "\n");

        Assert.Contains("elements skipped", html);
        Assert.Contains(Matrix, ResultOf(html));
    }

    [Fact]
    public void LargeVector_InlineMode_TruncatesWithEllipsis()
    {
        var source = "[1; 2; 3; 4; 5; 6; 7; 8; 9; 10; 11; 12; 13; 14; 15; 16; 17; 18; 19; 20; 21; 22]";
        var html = Render($"{Inline}\n" + source + "\n");

        Assert.Contains("elements skipped", ResultOf(html));
        Assert.Contains(Matrix, ResultOf(html));
    }

    [Fact]
    public void VectorWithUnits_UnitFollowsTheResultGrid()
    {
        // hp vectors carry a shared unit that has to land after the closing bracket
        var result = ResultOf(Render("A = vector_hp(3)*m\nA\n"));

        Assert.Contains(Matrix, result);
        Assert.Contains("\u200A<i>m</i>", result); // hair space, then the unit
    }

    [Fact]
    public void SettingDoesNotLeakBetweenParses()
    {
        // A first parse that turns grid rendering on must not bleed into a second independent parse.
        var first = SubstitutionOf(Render($"{Grid}\n[1; 2; 3]\n"));
        var second = SubstitutionOf(Render("[1; 2; 3]\n"));

        Assert.Contains(Matrix, first);
        Assert.DoesNotContain(Matrix, second);
    }

    [Fact]
    public void MultipleSettingChanges_AllTakeEffect()
    {
        // inline → grid → inline: each #settings must override the previous.
        var substitution = SubstitutionOf(Render($"{Inline}\n{Grid}\n{Inline}\n[1; 2; 3]\n"));

        Assert.DoesNotContain(Matrix, substitution);
    }

    [Fact]
    public void XmlWriter_RendersStructuredMatrix()
    {
        var xml = RenderAs("[6; 6|6; 6]", parser => parser.ToXml(), grid: true);

        Assert.Contains("<m:d>", xml);
        Assert.Contains("<m:mr>", xml);
        Assert.DoesNotContain(";", xml);
    }

    [Fact]
    public void XmlWriter_ResultIsStructuredWhateverTheSetting()
    {
        Assert.Contains("<m:m>", RenderAs("[6; 6|6; 6]", parser => parser.ToXml()));
    }

    [Fact]
    public void XmlWriter_VectorResultIsStructuredWhateverTheSetting()
    {
        // The DOCX export renders equations from this XML, so vectors must stay structured.
        Assert.Contains("<m:m>", RenderAs("[1; 2; 3]", parser => parser.ToXml()));
        Assert.Contains("<m:m>", RenderAs("[1; 2; 3]", parser => parser.ToXml(), grid: true));
    }

    [Fact]
    public void TextWriter_RendersSingleLineWithoutSeparators()
    {
        var text = RenderAs("[6; 6|6; 6]", parser => parser.ToString(), grid: true);

        Assert.Contains("[6  6 |6  6]", text);
        Assert.DoesNotContain(";", text);
    }

    private static string RenderAs(string expression, Func<MathParser, string> render, bool grid = false)
    {
        var parser = new MathParser(new MathSettings { InlineMatrices = !grid });
        parser.Parse(expression);
        parser.Calculate();
        return render(parser);
    }

    /// <summary>The last equation, split on " = " into literal, substitution and result.</summary>
    private static string[] Parts(string html)
    {
        var start = html.LastIndexOf("<span class=\"eq\">", StringComparison.Ordinal);
        return html[start..].Split(" = ");
    }

    /// <summary>The unevaluated bracketed group.</summary>
    private static string LiteralOf(string html) => Parts(html)[0];

    /// <summary>The result, i.e. the calculated value.</summary>
    private static string ResultOf(string html) => Parts(html)[^1];

    /// <summary>With no variables to replace there is no substitution, so the literal stands in for it.</summary>
    private static string SubstitutionOf(string html)
    {
        var parts = Parts(html);
        return parts.Length > 2 ? parts[1] : parts[0];
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
