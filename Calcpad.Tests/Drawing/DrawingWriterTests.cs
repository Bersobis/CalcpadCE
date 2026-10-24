using System;
using Calcpad.Core;
using Xunit;

namespace Calcpad.Tests
{
    public class DrawingWriterTests
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

        [Fact]
        public void RoundTrip_ParseWriteParse_SecondWriteIdentical()
        {
            var first = DrawingWriter.Write(DrawingReader.Parse(Specimen));
            var second = DrawingWriter.Write(DrawingReader.Parse(first));
            Assert.Equal(first, second);
        }

        [Fact]
        public void Write_Specimen_SectionOrderIsCanonical()
        {
            var text = DrawingWriter.Write(DrawingReader.Parse(Specimen));
            int Idx(string kw) => text.IndexOf(kw, StringComparison.Ordinal);
            Assert.True(Idx("#drawing") < Idx("#input"));
            Assert.True(Idx("#input") < Idx("#node"));
            Assert.True(Idx("#node") < Idx("#member"));
            Assert.True(Idx("#member") < Idx("#annotation"));
            Assert.True(Idx("#annotation") < Idx("#dimension"));
            Assert.True(Idx("#dimension") < Idx("#style"));
            Assert.True(Idx("#style") < Idx("#view"));
        }

        [Fact]
        public void Write_PreservesAllContent()
        {
            var text = DrawingWriter.Write(DrawingReader.Parse(Specimen));
            Assert.Contains("#drawing truss-example", text);
            Assert.Contains("#input L = ? {12} m", text);
            Assert.Contains("#node n2 (L/6, h*2/3)", text);
            Assert.Contains("#member m2 n1 n7b group=bot", text);
            Assert.Contains("label=\"Top chord\"", text);
            Assert.Contains("text=\"a = {[L/n]:.3f} m\"", text);
            Assert.Contains("#style top stroke=#4d6f8f width=10", text);
            Assert.Contains("title=\"Truss Members\"", text);
            Assert.Contains("supports=pin,roller", text);
        }

        [Fact]
        public void Write_NoBlankLines()
        {
            var text = DrawingWriter.Write(DrawingReader.Parse(Specimen));
            Assert.DoesNotContain("\n\n", text);
        }
    }
}
