using System;
using System.Collections.Generic;
using Calcpad.Core;
using Xunit;

namespace Calcpad.Tests
{
    public class DrawingExpressionTests
    {
        private static readonly Dictionary<string, double> Empty = new();

        [Theory]
        [InlineData("2+3*4", 14.0)]
        [InlineData("2 + 3 * 4", 14.0)]
        [InlineData("12mm", 0.012)]
        [InlineData("3000mm", 3.0)]
        [InlineData("3m", 3.0)]
        [InlineData("90deg", 0.5 * Math.PI)]
        [InlineData("(2+3)*4", 20.0)]
        [InlineData("-2+5", 3.0)]
        [InlineData("2^-2", 0.25)]
        [InlineData("10/4", 2.5)]
        public void Evaluate_LiteralsAndOperators_ReturnsExpected(string expr, double expected) =>
            Assert.Equal(expected, DrawingExpression.Evaluate(expr, Empty), 12);

        [Fact]
        public void Evaluate_Variables_SubstitutesValues()
        {
            var vars = new Dictionary<string, double> { ["L"] = 12, ["h"] = 3 };
            Assert.Equal(2.0, DrawingExpression.Evaluate("L/6", vars), 12);
            Assert.Equal(2.0, DrawingExpression.Evaluate("h*2/3", vars), 12);
            Assert.Equal(6.0, DrawingExpression.Evaluate("L/2", vars), 12);
        }

        [Fact]
        public void Evaluate_Functions_ReturnsExpected()
        {
            Assert.Equal(Math.Sqrt(2) + 2, DrawingExpression.Evaluate("sqrt(2)+abs(-2)", Empty), 12);
            Assert.Equal(3, DrawingExpression.Evaluate("min(3; 7)", Empty), 12);
            Assert.Equal(7, DrawingExpression.Evaluate("max(3; 7)", Empty), 12);
            Assert.Equal(0.5, DrawingExpression.Evaluate("sin(30deg)", Empty), 12);
        }

        [Theory]
        [InlineData("Q+1")]
        [InlineData("2+3x")]
        [InlineData("")]
        [InlineData("2+")]
        [InlineData("(2+3")]
        [InlineData("L/6")] // unknown variable with empty dictionary
        public void Evaluate_InvalidExpressions_Throws(string expr) =>
            Assert.Throws<DrawingExpressionException>(() => DrawingExpression.Evaluate(expr, Empty));

        [Fact]
        public void Evaluate_UnknownIdentifer_ExceptionNamesToken()
        {
            var ex = Assert.Throws<DrawingExpressionException>(() => DrawingExpression.Evaluate("Q+1", Empty));
            Assert.Contains("Q", ex.Message);
        }
    }
}
