using System;
using System.Collections.Generic;
using Calcpad.Highlighter.Linter.Constants;
using Calcpad.Highlighter.Linter.Helpers;
using Calcpad.Highlighter.Linter.Models;
using Calcpad.Highlighter.Snippets.Models;
using Calcpad.Highlighter.Tokenizer.Models;

namespace Calcpad.Highlighter.Linter.Validators.Stage3
{
    /// <summary>
    /// Validates function calls against their signatures, checking parameter counts and types.
    /// </summary>
    public class FunctionTypeValidator
    {
        public void Validate(Stage3Context stage3, LinterResult result, TokenizedLineProvider tokenProvider)
        {
            for (int i = 0; i < stage3.Lines.Count; i++)
            {
                var line = stage3.Lines[i];

                if (LineParser.ShouldSkipLine(line))
                    continue;

                ReadOnlySpan<char> trimmedSpan = line.AsSpan().Trim();

                if (LineParser.IsDirectiveLine(trimmedSpan))
                    continue;

                // Skip command block function definitions - type checking doesn't apply
                // since parameters can accept various types at runtime
                var trimmed = trimmedSpan.ToString();
                if (CalcpadPatterns.FunctionWithCommandBlock.IsMatch(trimmed))
                    continue;

                var tokens = tokenProvider.GetTokensForLine(i);

                // Pass Stage3 line index - diagnostic extensions handle mapping
                ValidateFunctionCallsOnLine(line, tokens, i, stage3, result);
            }
        }

        private void ValidateFunctionCallsOnLine(string line, IEnumerable<Token> tokens, int stage3Line, Stage3Context stage3, LinterResult result)
        {
            // Get function parameters from this line - these should be treated as Various type
            var functionParams = ParsingHelpers.GetFunctionParamsFromLine(line);

            foreach (var token in tokens)
            {
                if (token.Type != TokenType.Function && token.Type != TokenType.StringFunction)
                    continue;

                var funcName = token.Text;

                // Extract parameters from the call
                var (found, paramsStr) = ParsingHelpers.ExtractParamsString(line, token.Column + token.Length);
                if (!found)
                    continue;

                var parameters = ParameterParser.ParseParameters(paramsStr);
                var paramCount = parameters.Count;

                // Check for empty parameters in function calls (not allowed)
                for (int paramIdx = 0; paramIdx < parameters.Count; paramIdx++)
                {
                    if (string.IsNullOrWhiteSpace(parameters[paramIdx]))
                    {
                        var endCol = ParsingHelpers.FindClosingParen(line, token.Column + token.Length);
                        result.AddError(stage3Line, token.Column, endCol, "CPD-3311",
                            "Empty parameter " + (paramIdx + 1) + " in call to '" + funcName + "'");
                        break; // Report only the first empty parameter
                    }
                }

                // Check built-in functions with known signatures
                if (FunctionSignatures.HasSignature(funcName))
                {
                    // Get all overloads for this function
                    var overloads = FunctionSignatures.GetAllOverloads(funcName);

                    // Find overloads that match the parameter count
                    var matchingOverloads = FindMatchingOverloads(overloads, paramCount);

                    if (matchingOverloads.Count == 0)
                    {
                        // No overload matches the parameter count - report error
                        var signature = FunctionSignatures.GetSignature(funcName);
                        var endCol = ParsingHelpers.FindClosingParen(line, token.Column + token.Length);

                        if (paramCount < signature.MinParams)
                        {
                            result.AddError(stage3Line, token.Column, endCol, "CPD-3307",
                                "'" + funcName + "' requires at least " + signature.MinParams + " parameter(s), got " + paramCount);
                        }
                        else if (signature.MaxParams >= 0 && paramCount > signature.MaxParams)
                        {
                            result.AddError(stage3Line, token.Column, endCol, "CPD-3308",
                                "'" + funcName + "' accepts at most " + signature.MaxParams + " parameter(s), got " + paramCount);
                        }
                        continue;
                    }

                    // Validate parameter types if we have a TypeTracker
                    if (stage3.TypeTracker != null)
                    {
                        ValidateParameterTypesAgainstOverloads(parameters, matchingOverloads, funcName, token, stage3Line, line, stage3, functionParams, result);
                    }
                }
            }
        }

        /// <summary>
        /// Finds all overloads that accept the given parameter count.
        /// </summary>
        private static List<FunctionSignature> FindMatchingOverloads(FunctionSignature[] overloads, int paramCount)
        {
            var matching = new List<FunctionSignature>();

            foreach (var sig in overloads)
            {
                // AcceptsAnyCount means any parameter count is valid
                if (sig.AcceptsAnyCount)
                {
                    matching.Add(sig);
                    continue;
                }

                // Check if parameter count is within bounds
                if (paramCount >= sig.MinParams && (sig.MaxParams < 0 || paramCount <= sig.MaxParams))
                {
                    matching.Add(sig);
                }
            }

            return matching;
        }

        /// <summary>
        /// Validates parameter types against all matching overloads.
        /// If any overload matches all parameters, no error is reported.
        /// Only reports an error if NO overload matches the parameter types.
        /// </summary>
        private void ValidateParameterTypesAgainstOverloads(
            List<string> parameters,
            List<FunctionSignature> matchingOverloads,
            string funcName,
            Token token,
            int stage3Line,
            string line,
            Stage3Context stage3,
            HashSet<string> functionParams,
            LinterResult result)
        {
            // Infer types for all parameters once
            var actualTypes = new CalcpadType[parameters.Count];
            for (int i = 0; i < parameters.Count; i++)
            {
                var param = parameters[i].Trim();
                actualTypes[i] = string.IsNullOrEmpty(param)
                    ? CalcpadType.Unknown
                    : InferParameterType(param, stage3, functionParams);
            }

            // Check if any overload fully matches
            FunctionSignature bestMatch = matchingOverloads[0];
            int bestMatchScore = -1;

            foreach (var sig in matchingOverloads)
            {
                int matchScore = 0;
                bool allMatch = true;

                for (int i = 0; i < parameters.Count; i++)
                {
                    if (string.IsNullOrEmpty(parameters[i].Trim()))
                        continue;

                    var expectedType = sig.GetParameterType(i);

                    // Any and Various always match
                    if (expectedType == ParameterType.Any || expectedType == ParameterType.Various)
                    {
                        matchScore++;
                        continue;
                    }

                    if (FunctionSignature.IsTypeCompatible(expectedType, actualTypes[i]))
                    {
                        matchScore++;
                    }
                    else
                    {
                        allMatch = false;
                    }
                }

                // If this overload matches all parameters, we're done - no error
                if (allMatch)
                    return;

                // Track best partial match for error reporting
                if (matchScore > bestMatchScore)
                {
                    bestMatchScore = matchScore;
                    bestMatch = sig;
                }
            }

            // No overload fully matched - report errors against the best matching signature
            for (int i = 0; i < parameters.Count; i++)
            {
                var param = parameters[i].Trim();
                if (string.IsNullOrEmpty(param))
                    continue;

                var expectedType = bestMatch.GetParameterType(i);
                if (expectedType == ParameterType.Any || expectedType == ParameterType.Various)
                    continue;

                if (!FunctionSignature.IsTypeCompatible(expectedType, actualTypes[i]))
                {
                    var endCol = ParsingHelpers.FindClosingParen(line, token.Column + token.Length);
                    var expectedName = FunctionSignature.GetTypeName(expectedType);
                    var actualName = GetCalcpadTypeName(actualTypes[i]);
                    result.AddWarning(stage3Line, token.Column, endCol, "CPD-3309",
                        "'" + funcName + "' parameter " + (i + 1) + " expects " + expectedName + " but got " + actualName);
                }
            }
        }

        /// <summary>
        /// Infers the CalcpadType of a parameter expression.
        /// </summary>
        private CalcpadType InferParameterType(string expression, Stage3Context stage3, HashSet<string> functionParams)
        {
            var trimmed = expression.Trim();

            // If the expression is a function parameter, treat it as Various (unknown type at definition)
            if (functionParams.Contains(trimmed))
                return CalcpadType.Various;

            // Check if it's a known variable
            if (stage3.TypeTracker != null)
            {
                var varInfo = stage3.TypeTracker.GetVariableInfo(trimmed);
                if (varInfo != null)
                {
                    // For functions, return the return type, not the type (which is Function)
                    if (varInfo.Type == CalcpadType.Function)
                        return varInfo.ReturnType;
                    return varInfo.Type;
                }

                // Try to infer from expression (this handles function calls)
                return stage3.TypeTracker.InferTypeFromExpression(trimmed);
            }

            return CalcpadType.Unknown;
        }

        private static string GetCalcpadTypeName(CalcpadType type)
        {
            return type switch
            {
                CalcpadType.Value => "scalar",
                CalcpadType.Vector => "vector",
                CalcpadType.Matrix => "matrix",
                CalcpadType.StringVariable => "string",
                CalcpadType.Various => "various",
                CalcpadType.Unknown => "unknown",
                _ => type.ToString().ToLower()
            };
        }
    }
}
