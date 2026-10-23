using System;
using System.Collections.Generic;
using Calcpad.Core;
using Xunit;

namespace Calcpad.Tests
{
    public class DrawingEvaluatorTests
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
        public void Evaluate_Defaults_NodeCoordinates()
        {
            var model = DrawingReader.Parse(Specimen);
            var ev = DrawingEvaluator.Evaluate(model, BindingMap(), isUs: false);
            Assert.Equal(0.0, ev.Nodes["n1"].X);
            Assert.Equal(0.0, ev.Nodes["n1"].Y);
            Assert.Equal(2.0, ev.Nodes["n2"].X);
            Assert.Equal(2.0, ev.Nodes["n2"].Y);
            Assert.Equal(12.0, ev.Nodes["n7b"].X);
            Assert.Equal(0.0, ev.Nodes["n7b"].Y);
        }

        [Fact]
        public void Evaluate_Defaults_DimensionTextComputed()
        {
            var model = DrawingReader.Parse(Specimen);
            var ev = DrawingEvaluator.Evaluate(model, BindingMap(), isUs: false);
            Assert.Contains(ev.Dimensions, d => d.Text == "a = 2.000 m");
            Assert.Contains(ev.Dimensions, d => d.Text == "L = 12.000 m");
            Assert.Contains(ev.Dimensions, d => d.Text == "h = 3.000 m");
        }

        [Fact]
        public void Evaluate_HostBindingInMm_MatchesMeters()
        {
            var model = DrawingReader.Parse(Specimen);
            var inMeters = DrawingEvaluator.Evaluate(model, BindingMap(), isUs: false);
            var inMm = DrawingEvaluator.Evaluate(
                model,
                new Dictionary<string, (double Value, Unit Units)>
                {
                    ["L"] = (12000, Unit.Get("mm", false)),
                    ["h"] = (3000, Unit.Get("mm", false)),
                    ["n"] = (6, null),
                },
                isUs: false);

            Assert.Equal(inMeters.Nodes["n7b"].X, inMm.Nodes["n7b"].X, 9);
        }

        [Fact]
        public void Evaluate_HostUnitless_AcceptedAsDeclared()
        {
            var model = DrawingReader.Parse(Specimen);
            var ev = DrawingEvaluator.Evaluate(
                model,
                new Dictionary<string, (double Value, Unit Units)>
                {
                    ["L"] = (12, null),
                    ["h"] = (3, null),
                    ["n"] = (6, null),
                },
                isUs: false);
            Assert.Equal((2.0, 2.0), (ev.Nodes["n2"].X, ev.Nodes["n2"].Y));
            Assert.Equal(2.0, ev.Nodes["n2"].X);
            Assert.Equal(2.0, ev.Nodes["n2"].Y);
        }

        [Fact]
        public void Evaluate_HostUnitMismatch_ThrowsNamingInput()
        {
            var model = DrawingReader.Parse(Specimen);
            var ex = Assert.Throws<DrawingExpressionException>(() => DrawingEvaluator.Evaluate(
                model,
                new Dictionary<string, (double Value, Unit Units)>
                {
                    ["L"] = (1.0, Unit.Get("rad", false)),
                },
                isUs: false));
            Assert.Contains("L", ex.Message);
        }

        [Fact]
        public void Evaluate_MembersGetCoordinates()
        {
            var model = DrawingReader.Parse(Specimen);
            var ev = DrawingEvaluator.Evaluate(model, BindingMap(), isUs: false);
            var m2 = Assert.Single(ev.Members, m => m.Id == "m2");
            Assert.Equal(0.0, m2.A.X);
            Assert.Equal(0.0, m2.A.Y);
            Assert.Equal(12.0, m2.B.X);
            Assert.Equal(0.0, m2.B.Y);
        }

        [Fact]
        public void Evaluate_MissingRequiredInput_ThrowsNamingInput()
        {
            var model = DrawingReader.Parse(Specimen.Replace("? {12}", "?", StringComparison.Ordinal).Replace("? {3}", "?", StringComparison.Ordinal));
            var ex = Assert.Throws<DrawingExpressionException>(() =>
                DrawingEvaluator.Evaluate(model, new Dictionary<string, (double Value, Unit Units)>(), isUs: false));
            Assert.Contains("L", ex.Message);
        }

        private static IReadOnlyDictionary<string, (double Value, Unit Units)> BindingMap() =>
            new Dictionary<string, (double Value, Unit Units)>();
    }
}
