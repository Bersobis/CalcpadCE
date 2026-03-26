using System;
using System.Net;
using System.Text.Json;

namespace Calcpad.Core
{
    public partial class ExpressionParser
    {
        private sealed class UiPropertyMetadata
        {
            public string Type { get; set; }        // "entry", "datagrid", "dropdown", "radio", "checkbox"
            public string Style { get; set; }       // CSS class (nullable)
            public string VariableName { get; set; } // Extracted from expression
            public int Rows { get; set; }           // For datagrid (0 = auto-detect)
            public int Columns { get; set; }        // For datagrid (0 = auto-detect)
            public string[] ColumnHeaders { get; set; } // Custom column headers (nullable)
            public string[] RowHeaders { get; set; }    // Custom row headers (nullable)
            public string[] Keys { get; set; }      // Display labels for dropdown/radio (nullable)
            public string[] Values { get; set; }    // Substitution values for dropdown/radio (nullable)
        }

        private UiPropertyMetadata _pendingUi;
        private int _uiSkipChars;

        /// <summary>
        /// Parses the #UI keyword arguments from the line.
        /// JSON block is optional — type/size is auto-detected from the expression if omitted.
        /// Always computes _uiSkipChars so the prefix is stripped.
        /// Only sets pending UI state when Settings.EnableUi is true.
        /// </summary>
        private void ParseKeywordUi(ReadOnlySpan<char> s)
        {
            // Expand string variables so e.g. #UI UIJSON$ becomes #UI {"type": "entry"}
            var expanded = s.ToString();
            if (_stringVariables.Count > 0)
                expanded = ExpandStringVariables(expanded);

            // Skip past "#ui" + whitespace to find what follows
            var cursor = 3; // "#ui"
            while (cursor < expanded.Length && expanded[cursor] == ' ')
                cursor++;

            string uiType = null;
            string uiStyle = null;
            string[] uiColumnHeaders = null;
            string[] uiRowHeaders = null;
            string[] uiKeys = null;
            string[] uiValues = null;
            int uiRows = 0;
            int uiColumns = 0;

            // Check if there's a JSON block
            if (cursor < expanded.Length && expanded[cursor] == '{')
            {
                var braceEnd = expanded.IndexOf('}', cursor);
                if (braceEnd < 0)
                {
                    AppendError(s.ToString(), "Improper format for #UI keyword. Missing closing brace '}'.", _currentLine);
                    _uiSkipChars = s.Length;
                    _pendingUi = null;
                    return;
                }

                var jsonString = expanded[cursor..(braceEnd + 1)];

                try
                {
                    using var doc = JsonDocument.Parse(jsonString);
                    var root = doc.RootElement;

                    uiType = root.TryGetProperty("type", out var tp) && tp.ValueKind == JsonValueKind.String
                        ? tp.GetString() : null;
                    uiStyle = root.TryGetProperty("style", out var sp) && sp.ValueKind == JsonValueKind.String
                        ? sp.GetString() : null;
                    uiRows = root.TryGetProperty("rows", out var rp) && rp.ValueKind == JsonValueKind.Number
                        ? rp.GetInt32() : 0;
                    uiColumns = root.TryGetProperty("columns", out var cp) && cp.ValueKind == JsonValueKind.Number
                        ? cp.GetInt32() : 0;
                    if (root.TryGetProperty("columnHeaders", out var chp) && chp.ValueKind == JsonValueKind.Array)
                        uiColumnHeaders = ParseJsonStringArray(chp);
                    if (root.TryGetProperty("rowHeaders", out var rhp) && rhp.ValueKind == JsonValueKind.Array)
                        uiRowHeaders = ParseJsonStringArray(rhp);
                    if (root.TryGetProperty("keys", out var kp) && kp.ValueKind == JsonValueKind.Array)
                        uiKeys = ParseJsonStringArray(kp);
                    if (root.TryGetProperty("values", out var vp) && vp.ValueKind == JsonValueKind.Array)
                        uiValues = ParseJsonStringArray(vp);
                }
                catch (JsonException)
                {
                    AppendError(s.ToString(), "Improper format for #UI keyword. Invalid JSON.", _currentLine);
                    // Still compute skip chars so the expression can be parsed
                    ComputeSkipCharsFromOriginal(s);
                    _pendingUi = null;
                    return;
                }

                // Compute _uiSkipChars from the ORIGINAL span
                var origBraceEnd = s.IndexOf('}');
                if (origBraceEnd >= 0)
                    _uiSkipChars = origBraceEnd + 1;
                else
                {
                    // String variable reference — skip past "#ui", whitespace, variable name
                    _uiSkipChars = 3;
                    while (_uiSkipChars < s.Length && s[_uiSkipChars] == ' ')
                        _uiSkipChars++;
                    while (_uiSkipChars < s.Length && s[_uiSkipChars] != ' ')
                        _uiSkipChars++;
                }
                while (_uiSkipChars < s.Length && s[_uiSkipChars] == ' ')
                    _uiSkipChars++;
            }
            else
            {
                // No JSON block — skip past "#ui" + whitespace only
                _uiSkipChars = 3;
                while (_uiSkipChars < s.Length && s[_uiSkipChars] == ' ')
                    _uiSkipChars++;
            }

            if (!Settings.EnableUi)
            {
                _pendingUi = null;
                return;
            }

            // Extract variable name and RHS from the expression after the UI block
            var expressionPart = s[_uiSkipChars..];
            var eqIndex = expressionPart.IndexOf('=');
            string varName = null;
            if (eqIndex > 0)
                varName = expressionPart[..eqIndex].Trim().ToString();

            // Auto-detect type and/or grid size from the RHS
            if (eqIndex > 0)
            {
                var rhs = expressionPart[(eqIndex + 1)..].Trim();
                if (uiType == null)
                {
                    // No explicit type — infer from expression
                    uiType = rhs.IndexOf('[') >= 0 ? "datagrid" : "entry";
                }
                // Fill in missing rows/columns for datagrid from the expression
                if (uiType == "datagrid" && (uiRows == 0 || uiColumns == 0))
                    AutoDetectGridSize(rhs, ref uiRows, ref uiColumns);
            }

            uiType ??= "entry";

            // Validate keys/values for dropdown and radio types
            if (uiType == "dropdown" || uiType == "radio")
            {
                if (uiKeys == null || uiValues == null)
                {
                    AppendError(s.ToString(), $"#UI {uiType}: both 'keys' and 'values' arrays are required.", _currentLine);
                    _pendingUi = null;
                    return;
                }
                if (uiKeys.Length != uiValues.Length)
                {
                    AppendError(s.ToString(), $"#UI {uiType}: 'keys' and 'values' arrays must have the same length.", _currentLine);
                    _pendingUi = null;
                    return;
                }
            }

            _pendingUi = new UiPropertyMetadata
            {
                Type = uiType,
                Style = uiStyle,
                VariableName = varName,
                Rows = uiRows,
                Columns = uiColumns,
                ColumnHeaders = uiColumnHeaders,
                RowHeaders = uiRowHeaders,
                Keys = uiKeys,
                Values = uiValues
            };
        }

        /// <summary>
        /// Auto-detects rows and columns from a vector/matrix RHS.
        /// In Calcpad syntax: | separates rows, ; separates elements within a row.
        /// Vector: [1; 2; 3] → 3 rows, 1 column
        /// Matrix: [1;2;3 | 4;5;6] → 2 rows, 3 columns
        /// </summary>
        private static void AutoDetectGridSize(ReadOnlySpan<char> rhs, ref int rows, ref int columns)
        {
            var bracketStart = rhs.IndexOf('[');
            var bracketEnd = rhs.LastIndexOf(']');
            if (bracketStart < 0 || bracketEnd <= bracketStart)
                return;

            var content = rhs[(bracketStart + 1)..bracketEnd];

            // Count rows: number of '|' + 1 (| separates rows in Calcpad)
            int pipes = 0;
            foreach (var c in content)
                if (c == '|') pipes++;

            if (pipes > 0)
            {
                // Matrix: rows = pipes + 1, columns = semicolons in first row + 1
                if (rows == 0)
                    rows = pipes + 1;

                int semicolons = 0;
                foreach (var c in content)
                {
                    if (c == '|') break;
                    if (c == ';') semicolons++;
                }
                if (columns == 0)
                    columns = semicolons + 1;
            }
            else
            {
                // Vector: single column, rows = semicolons + 1
                int semicolons = 0;
                foreach (var c in content)
                    if (c == ';') semicolons++;

                if (rows == 0)
                    rows = semicolons + 1;
                if (columns == 0)
                    columns = 1;
            }
        }

        private void ComputeSkipCharsFromOriginal(ReadOnlySpan<char> s)
        {
            _uiSkipChars = 3;
            while (_uiSkipChars < s.Length && s[_uiSkipChars] == ' ')
                _uiSkipChars++;
        }

        /// <summary>
        /// Returns data-ui-* attribute string to inject into the wrapping HTML element.
        /// </summary>
        private string GetUiAttributes(int sourceLine)
        {
            var attrs = $" data-ui-type=\"{_pendingUi.Type}\" data-ui-line=\"{sourceLine}\"";
            if (_pendingUi.VariableName != null)
                attrs += $" data-ui-var=\"{_pendingUi.VariableName}\"";
            if (_pendingUi.Style != null)
                attrs += $" data-ui-style=\"{_pendingUi.Style}\"";
            if (_pendingUi.Type == "datagrid")
            {
                attrs += $" data-ui-rows=\"{_pendingUi.Rows}\"";
                attrs += $" data-ui-columns=\"{_pendingUi.Columns}\"";
            }
            return attrs;
        }

        /// <summary>
        /// Injects a UI control into the equation HTML based on the pending UI type.
        /// </summary>
        private string InjectUiInput(string equationHtml, int sourceLine)
        {
            if (_pendingUi?.VariableName == null)
                return equationHtml;

            return _pendingUi.Type switch
            {
                "datagrid" => InjectUiDatagrid(equationHtml, sourceLine),
                "dropdown" => InjectUiDropdown(equationHtml, sourceLine),
                "radio" => InjectUiRadio(equationHtml, sourceLine),
                "checkbox" => InjectUiCheckbox(equationHtml, sourceLine),
                _ => InjectUiEntry(equationHtml, sourceLine)
            };
        }

        private string InjectUiEntry(string equationHtml, int sourceLine)
        {
            const string assignOp = " = ";
            var lastAssign = equationHtml.LastIndexOf(assignOp, StringComparison.Ordinal);
            if (lastAssign < 0)
                return equationHtml;

            var resultStart = lastAssign + assignOp.Length;
            var resultPart = equationHtml[resultStart..];

            SplitValueAndUnit(resultPart, out var numericValue, out var unitHtml);

            var styleClass = _pendingUi.Style != null
                ? $"calcpad-ui-input {_pendingUi.Style}"
                : "calcpad-ui-input";

            var input = $"<input type=\"text\" class=\"{styleClass}\" value=\"{numericValue}\"" +
                        $" data-ui-var=\"{_pendingUi.VariableName}\" data-ui-line=\"{sourceLine}\">";

            return equationHtml[..resultStart] + input + unitHtml;
        }

        private string InjectUiDropdown(string equationHtml, int sourceLine)
        {
            const string assignOp = " = ";
            var lastAssign = equationHtml.LastIndexOf(assignOp, StringComparison.Ordinal);
            if (lastAssign < 0)
                return equationHtml;

            var resultStart = lastAssign + assignOp.Length;
            var resultPart = equationHtml[resultStart..];

            SplitValueAndUnit(resultPart, out var numericValue, out var unitHtml);

            var styleClass = _pendingUi.Style != null
                ? $"calcpad-ui-dropdown {_pendingUi.Style}"
                : "calcpad-ui-dropdown";

            var sb = new System.Text.StringBuilder();
            sb.Append($"<select class=\"{styleClass}\"");
            sb.Append($" data-ui-var=\"{_pendingUi.VariableName}\" data-ui-line=\"{sourceLine}\">");

            for (int i = 0; i < _pendingUi.Keys.Length; i++)
            {
                var selected = _pendingUi.Values[i] == numericValue ? " selected" : "";
                sb.Append($"<option value=\"{WebUtility.HtmlEncode(_pendingUi.Values[i])}\"{selected}>{WebUtility.HtmlEncode(_pendingUi.Keys[i])}</option>");
            }
            sb.Append("</select>");

            return equationHtml[..resultStart] + sb.ToString() + unitHtml;
        }

        private string InjectUiRadio(string equationHtml, int sourceLine)
        {
            const string assignOp = " = ";
            var lastAssign = equationHtml.LastIndexOf(assignOp, StringComparison.Ordinal);
            if (lastAssign < 0)
                return equationHtml;

            var resultStart = lastAssign + assignOp.Length;
            var resultPart = equationHtml[resultStart..];

            SplitValueAndUnit(resultPart, out var numericValue, out var unitHtml);

            var styleClass = _pendingUi.Style != null
                ? $"calcpad-ui-radio {_pendingUi.Style}"
                : "calcpad-ui-radio";

            var groupName = $"ui-radio-{_pendingUi.VariableName}-{sourceLine}";
            var sb = new System.Text.StringBuilder();
            sb.Append($"<span class=\"{styleClass}\"");
            sb.Append($" data-ui-var=\"{_pendingUi.VariableName}\" data-ui-line=\"{sourceLine}\">");

            for (int i = 0; i < _pendingUi.Keys.Length; i++)
            {
                var checkedAttr = _pendingUi.Values[i] == numericValue ? " checked" : "";
                sb.Append($"<label class=\"calcpad-ui-radio-label\">");
                sb.Append($"<input type=\"radio\" name=\"{groupName}\" value=\"{WebUtility.HtmlEncode(_pendingUi.Values[i])}\"{checkedAttr}>");
                sb.Append($" {WebUtility.HtmlEncode(_pendingUi.Keys[i])}</label>");
            }
            sb.Append("</span>");

            return equationHtml[..resultStart] + sb.ToString() + unitHtml;
        }

        private string InjectUiCheckbox(string equationHtml, int sourceLine)
        {
            const string assignOp = " = ";
            var lastAssign = equationHtml.LastIndexOf(assignOp, StringComparison.Ordinal);
            if (lastAssign < 0)
                return equationHtml;

            var resultStart = lastAssign + assignOp.Length;
            var resultPart = equationHtml[resultStart..];

            SplitValueAndUnit(resultPart, out var numericValue, out var unitHtml);

            var styleClass = _pendingUi.Style != null
                ? $"calcpad-ui-checkbox {_pendingUi.Style}"
                : "calcpad-ui-checkbox";

            var isChecked = numericValue.Trim() == "1" ? " checked" : "";

            var input = $"<input type=\"checkbox\" class=\"{styleClass}\"" +
                        $" data-ui-var=\"{_pendingUi.VariableName}\" data-ui-line=\"{sourceLine}\"{isChecked}>";

            return equationHtml[..resultStart] + input + unitHtml;
        }

        /// <summary>
        /// Returns a datagrid div element. Called after the </p> line end
        /// so it's a block-level sibling, not nested inside inline elements.
        /// </summary>
        private string InjectUiDatagrid(string _, int sourceLine)
        {
            var values = _pendingUiDataValues ?? "";

            var styleClass = _pendingUi.Style != null
                ? $"calcpad-ui-datagrid {_pendingUi.Style}"
                : "calcpad-ui-datagrid";

            var attrs = $"<div class=\"{styleClass}\"" +
                       $" data-ui-var=\"{_pendingUi.VariableName}\" data-ui-line=\"{sourceLine}\"" +
                       $" data-ui-rows=\"{_pendingUi.Rows}\" data-ui-columns=\"{_pendingUi.Columns}\"" +
                       $" data-ui-values=\"{values}\"";

            if (_pendingUi.ColumnHeaders != null)
                attrs += $" data-ui-col-headers=\"{string.Join(",", _pendingUi.ColumnHeaders)}\"";
            if (_pendingUi.RowHeaders != null)
                attrs += $" data-ui-row-headers=\"{string.Join(",", _pendingUi.RowHeaders)}\"";

            return attrs + "></div>";
        }

        private string _pendingUiDataValues;

        /// <summary>
        /// Captures matrix/vector values from an expression like "M = [1|2|3; 4|5|6]"
        /// and stores them in _pendingUiDataValues in Calcpad format (| for columns, ; for rows).
        /// </summary>
        private void CaptureDatagridValues(string expressionText)
        {
            var eqIdx = expressionText.IndexOf('=');
            if (eqIdx < 0) return;

            var rhs = expressionText[(eqIdx + 1)..];
            var bracketStart = rhs.IndexOf('[');
            var bracketEnd = rhs.LastIndexOf(']');
            if (bracketStart < 0 || bracketEnd <= bracketStart) return;

            // Extract content between brackets, remove spaces for compact format
            var content = rhs[(bracketStart + 1)..bracketEnd];
            _pendingUiDataValues = content.Replace(" ", "");
        }

        /// <summary>
        /// Splits a result HTML fragment like "5 <i>ft</i>" into numeric value and unit HTML.
        /// </summary>
        private static void SplitValueAndUnit(string resultHtml, out string numericValue, out string unitHtml)
        {
            var unitStart = resultHtml.IndexOf("<i>", StringComparison.Ordinal);
            if (unitStart < 0)
                unitStart = resultHtml.IndexOf("<sup", StringComparison.Ordinal);

            if (unitStart > 0)
            {
                numericValue = resultHtml[..unitStart].TrimEnd('\u2009', ' ');
                unitHtml = "\u2009" + resultHtml[unitStart..];
            }
            else if (unitStart == 0)
            {
                numericValue = string.Empty;
                unitHtml = resultHtml;
            }
            else
            {
                numericValue = resultHtml.Trim();
                unitHtml = string.Empty;
            }
        }

        /// <summary>
        /// Applies a UI override to an expression text before MathParser processes it.
        /// </summary>
        private string ApplyUiOverride(ReadOnlySpan<char> expressionText)
        {
            if (_pendingUi?.VariableName == null ||
                Settings.UiOverrides == null ||
                !Settings.UiOverrides.TryGetValue(_pendingUi.VariableName, out var overrideValue))
                return null;

            var expr = expressionText.ToString();
            var eqIndex = expr.IndexOf('=');
            if (eqIndex < 0)
                return null;

            var lhs = expr[..(eqIndex + 1)];
            var rhs = expr[(eqIndex + 1)..].TrimStart();

            if (_pendingUi.Type == "datagrid")
            {
                // Replace the [...] block, preserving anything after ]
                var bracketStart = rhs.IndexOf('[');
                if (bracketStart < 0) return null;
                var bracketEnd = rhs.LastIndexOf(']');
                if (bracketEnd < 0) return null;
                var afterBracket = rhs[(bracketEnd + 1)..];
                return lhs + " " + overrideValue + afterBracket;
            }

            // Scalar entry: replace numeric value, preserve unit
            var i = 0;
            while (i < rhs.Length && IsNumericChar(rhs[i]))
                i++;

            if (i == 0)
                return null;

            var unit = rhs[i..];
            return lhs + " " + overrideValue + unit;
        }

        private static bool IsNumericChar(char c) =>
            c >= '0' && c <= '9' || c == '.' || c == '-' || c == '+' || c == 'e' || c == 'E';

        private void ResetUiState()
        {
            _pendingUi = null;
            _pendingUiDataValues = null;
            _uiSkipChars = 0;
        }

        private static string[] ParseJsonStringArray(JsonElement arrayElement)
        {
            var headers = new System.Collections.Generic.List<string>();
            foreach (var el in arrayElement.EnumerateArray())
                headers.Add(el.GetString() ?? "");
            return headers.ToArray();
        }
    }
}
