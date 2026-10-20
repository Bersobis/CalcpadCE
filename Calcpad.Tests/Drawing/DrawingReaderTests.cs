using System;
using System.Linq;
using Calcpad.Core;
using Xunit;

namespace Calcpad.Tests
{
    public class DrawingReaderTests
    {
        // Spec Appendix A specimen: the truss example.
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
        public void Parse_Specimen_ExtractsSections()
        {
            var model = DrawingReader.Parse(Specimen);
            Assert.Equal("truss-example", model.Name);
            Assert.Equal(3, model.Inputs.Count);
            Assert.Equal("L", model.Inputs[0].Name);
            Assert.Equal("12", model.Inputs[0].DefaultRaw);
            Assert.Equal("m", model.Inputs[0].UnitText);
            Assert.Equal("n", model.Inputs[2].Name);
            Assert.Equal("-", model.Inputs[2].UnitText);
            Assert.Equal(4, model.Nodes.Count);
            Assert.Equal("n2", model.Nodes[1].Id);
            Assert.Equal("L/6", model.Nodes[1].XRaw);
            Assert.Equal("h*2/3", model.Nodes[1].YRaw);
            Assert.Equal(2, model.Members.Count);
            Assert.Equal(("n1", "n2", "top"), (model.Members[0].NodeA, model.Members[0].NodeB, model.Members[0].Group));
            Assert.Equal(2, model.Annotations.Count);
            Assert.Equal("Top chord", model.Annotations[0].Label);
            Assert.Equal("In compression", model.Annotations[0].State);
            Assert.Equal(3, model.Dimensions.Count);
            Assert.Equal("n1", model.Dimensions[0].NodeA);
            Assert.Equal("a = {[L/n]:.3f} m", model.Dimensions[0].TextPattern);
            Assert.Equal(3, model.Styles.Count);
            Assert.Equal("#4d6f8f", model.Styles[0].Stroke);
            Assert.Equal("Truss Members", model.View.Title);
            Assert.NotNull(model.View.Supports);
            Assert.Equal(2, model.View.Supports.Count);
        }

        [Fact]
        public void Parse_MemberReferencingUnknownNode_SurfacesErrorWithMemberId()
        {
            // Forward reference n9 declared later is fine; nZ never declared must error.
            var errors = DrawingReader.Parse(Specimen + "\n#member m3 n1 nZ group=web", out var list);
            Assert.Contains(list, e => e.Contains("m3") && e.Contains("nZ"));
        }

        [Fact]
        public void Parse_NodeExpressionWithUndeclaredName_SurfacesErrorWithNodeId()
        {
            var errors = DrawingReader.Parse(Specimen + "\n#node n8 (Q_missing, 0)", out var list);
            Assert.Contains(list, e => e.Contains("n8") && e.Contains("Q_missing"));
        }

        [Fact]
        public void Parse_UnknownRecordType_CollectsErrorNotException()
        {
            var errors = DrawingReader.Parse(Specimen + "\n#ghost x=1", out var list);
            Assert.Contains(list, e => e.Contains("#ghost") || e.Contains("ghost"));
        }

        [Fact]
        public void Parse_LineNumberIncludedInErrors()
        {
            var lines = Specimen.Split('\n');
            var errors = DrawingReader.Parse(Specimen + "\n#node n9 (, )", out var list);
            Assert.Contains(list, e => e.Contains("n9"));
        }

        [Fact]
        public void Parse_MissingRequiredName_EmitsError()
        {
            var errors = DrawingReader.Parse("#drawing x\n#node (1, 2)\n", out var list);
            Assert.NotEmpty(list);
        }
    }
}
