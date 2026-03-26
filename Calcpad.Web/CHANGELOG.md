# Calcpad.Web Changelog

## calcpad-highlighter Branch — Feature Summary

This changelog documents all new features and changes introduced on the `calcpad-highlighter` branch since diverging from `main`. It covers the VS Code extension, web backend, Calcpad.Core parser, and Calcpad.Highlighter library.

---

## 1. Interactive UI Controls (`#UI` Directive)

A new `#UI` keyword allows you to create interactive input controls directly in the preview panel. When a user changes a value, the calculation automatically re-runs with the updated input.

### Basic Entry Field

Place `#UI` before any variable assignment to turn its result into an editable input box:

```
#UI L = 10m
#UI W = 5m
A = L * W
```

In the preview, `L` and `W` appear as editable text fields. Changing either value recalculates `A` in real time.

### Datagrid (Matrix/Vector Editor)

When the right-hand side is a matrix or vector, `#UI` automatically creates a spreadsheet-style grid editor (powered by jspreadsheet):

```
#UI M = [1|2|3; 4|5|6]
```

This auto-detects 2 rows and 3 columns from the matrix syntax. The user can edit individual cells in the preview.

### JSON Configuration

You can provide an optional JSON block to customize the UI control:

```
#UI {"type": "entry", "style": "my-custom-class"} x = 10m
#UI {"type": "datagrid", "rows": 3, "columns": 4} M = [0|0|0|0; 0|0|0|0; 0|0|0|0]
```

**Properties:**
- `type` — `"entry"` for a single input, `"datagrid"` for a spreadsheet grid (auto-detected if omitted)
- `style` — Optional CSS class name applied to the control
- `rows` / `columns` — Explicit grid dimensions (auto-detected from matrix syntax if omitted)

### String Variable Expansion for UI Config

Store JSON configuration in a string variable and reference it in the `#UI` directive:

```
#string UIJSON$ = '{"type": "entry"}'
#UI UIJSON$ L = 10m
```

### Conditional UI Fields

UI fields work inside `#if` blocks:

```
#UI L = 10m
#if L ≡ 10m
    #UI W = 5m
#end if
A = L * W
```

### Where to Find It (VS Code)

- Open a `.cpd` file and use the **UI Preview** panel (the third preview tab in the webview)
- The UI preview calls the `/api/calcpad/convert-ui` endpoint
- Input fields appear with a light yellow background (dark theme: dark gray) and blue focus outline
- Changes are sent back to the server automatically on blur or Enter key

---

## 2. String Variables

A new string type allows you to define and use text values throughout your Calcpad documents.

### Inline Definition (`#string`)

```
#string title$ = 'Engineering Report'
#string author$ = "John Doe"
```

### Multiline Definition (`#def`)

```
#def description$
    This is a multiline
    string variable
#end def
```

### Inline `#def` Shorthand

```
#def label$ = 'Section Header'
```

### String Tables (`#table`)

```
#table results$ = [1,2,3; 4,5,6]
```

### Using String Variables

Reference string variables with the `$` suffix. They expand automatically where referenced:

```
#string name$ = 'Beam Analysis'
'Title: name$
```

### String Comparisons

```
#string status$ = 'OK'
#if status$ ≡ 'OK'
    'All checks passed
#end if

#if status$ ≠ 'FAIL'
    'No failures detected
#end if
```

### Where to Find It (VS Code)

- String variable snippets appear in autocomplete when typing `#string`, `#def`, or `#table`
- The linter validates string variable syntax and reports errors for malformed definitions
- String variables are expanded during content resolution before the expression parser runs

---

## 3. Keyword Arguments in Functions and Macros

Both custom functions and macros now support optional parameters with default values and keyword argument syntax.

### Custom Functions — Optional Parameters

Define default values with `=` in the parameter list:

```
f(x; y = 0; z = 1) = x + y + z
```

Required parameters must come before optional ones.

### Custom Functions — Keyword Arguments

Call functions using `paramName=value` syntax in any order:

```
f(x; y = 0; z = 1) = x * y + z

'Positional only
f(5; 3; 2)

'Keyword arguments (any order)
f(x = 5; z = 2; y = 3)

'Mix positional and keyword (positional first)
f(5; z = 2)       'x=5 (positional), y=0 (default), z=2 (keyword)
```

### Macros — Optional Parameters

Define defaults in macro parameter lists. Macro parameters use the `$` suffix:

```
#def calc$(a$; b$ = 10; c$ = 5)
    result = a$ + b$ + c$
#end def
```

### Macros — Keyword Arguments

Call macros using `paramName$=value` syntax:

```
#def calc$(a$; b$ = 10; c$ = 5)
    result = a$ + b$ + c$
#end def

'Positional only
calc$(1; 2; 3)

'Keyword arguments (any order)
calc$(a$ = 1; c$ = 7; b$ = 2)

'Mix positional and keyword
calc$(1; c$ = 7)    'a$=1 (positional), b$=10 (default), c$=7 (keyword)
```

### Rules

1. Required parameters must come before optional parameters in the definition
2. Positional arguments must come before keyword arguments in a call
3. Default values are expressions evaluated at call time
4. The linter reports errors for unknown keyword arguments (`CPD-3314` for macros, `CPD-3315` for functions)

### Where to Find It (VS Code)

- Autocomplete shows parameter names and defaults when typing function/macro calls
- The linter validates keyword argument names and reports unknown parameters
- Error `CPD-2213` / `CPD-3214` fires if a required parameter appears after an optional one in a definition

---

## 4. Go to Definition and Find All References

Full symbol navigation is now available for variables, functions, macros, and custom units.

### Go to Definition

**Ctrl+Click** (or **F12**) on any symbol to jump to where it was defined.

Works for:
- Variables (`x = 5` → jumps to the assignment)
- Custom functions (`f(x) = ...` → jumps to the definition)
- Macros (`myMacro$()` → jumps to the `#def` block)
- Custom units

### Find All References

**Shift+Alt+F12** (or right-click → "Find All References") to see every location where a symbol is used.

### Rename Symbol

**F2** on a symbol to rename it across the entire file.

### Where to Find It (VS Code)

- These features are registered as VS Code language providers and work in any `.cpd` file
- Results appear in the standard VS Code peek/reference views
- The backend endpoint `/api/calcpad/find-references` powers the reference lookup
- The endpoint `/api/calcpad/definitions` powers Go to Definition

---

## 5. File Auto-Completion for Includes

Typing a path inside `#include` or `#read` directives now triggers file path completion.

```
#include ./path/to/    ← autocomplete shows available .cpd files
#read data/            ← autocomplete shows available files
```

### Where to Find It (VS Code)

- Completion triggers automatically when typing inside `#include` or `#read` arguments
- Relative paths are resolved from the current file's directory
- Only relevant file types are suggested

---

## 6. Symbol Palette and Snippets

### Quick-Type Shortcuts

Type `~` followed by a Greek letter name to insert the symbol:

```
~alpha  → α
~beta   → β
~theta  → θ
~pi     → π
~sigma  → σ
```

### Snippet Categories

Snippets are organized by category and available through the autocomplete menu:

- **Keywords** — `#if`, `#else`, `#end if`, `#for`, `#def`, `#string`, `#table`, `#UI`, etc.
- **Functions** — Built-in math functions with parameter documentation
- **Operators** — Comparison, logical, and assignment operators
- **Units** — Physical units organized by type

### Where to Find It (VS Code)

- Snippets appear in the autocomplete dropdown as you type
- The endpoint `/api/calcpad/snippets` provides snippet data by category
- Keyword snippets include cursor placement markers (the cursor jumps to the right position after inserting)

---

## 7. Table of Contents

Support for generating a table of contents from document headings.

### Syntax

```
'# Section 1
'Some content here
'## Subsection 1.1
'More content
'# Section 2
```

A TOC can be generated from heading comments, with JavaScript-powered navigation in the HTML output.

### Where to Find It

- TOC rendering is handled by `toc.js` injected into the HTML output
- Example file: `Calcpad.Cli/Examples/Demos/toc.cpd`

---

## 8. Recursive Includes

`#include` and `#read` now support full recursive resolution with safety checks.

### Features

- **Nested includes** — An included file can itself include other files, up to 20 levels deep
- **Circular reference detection** — The resolver tracks visited files and prevents infinite loops
- **Remote URLs** — Include content from HTTP/HTTPS URLs:
  ```
  #include https://example.com/shared-calcs.cpd
  ```
- **API routes** — Include content from configured API endpoints:
  ```
  #include <service:endpoint>
  ```

### Where to Find It

- The `IncludeResolver` service in the web backend handles recursive resolution
- The `ContentResolver` in Calcpad.Highlighter performs the same resolution for linting
- Include errors appear as linter diagnostics with source file attribution

---

## 9. PDF Generation with PuppeteerSharp

The PDF engine has been replaced with PuppeteerSharp (headless Chromium) for higher-fidelity rendering, with PDFsharp post-processing for headers, footers, and backgrounds.

### Features

- **Accurate HTML rendering** — Uses a real browser engine for pixel-perfect output
- **Headers and footers** — Configurable with author, company, project name, and page numbers
- **Background overlay** — Apply a background PDF template (e.g., company letterhead)
- **Paper formats** — Letter, Legal, A0–A6
- **Custom margins** — Configurable with unit support
- **Timestamps** — Configurable date/time format in headers/footers
- **Image embedding** — Local images are automatically converted to base64 before PDF rendering

### PDF Settings

Configure PDF output through the VS Code settings panel:

| Setting | Description |
|---------|-------------|
| Title | Document title in header |
| Subtitle | Document subtitle |
| Author | Author name |
| Company | Company name |
| Project | Project name |
| Orientation | Portrait or Landscape |
| Scale | Zoom factor |
| Header / Footer | Enable/disable, center text |
| Background | Path to background PDF |
| Timestamp Format | Date format string |

### Where to Find It (VS Code)

- Use the **Export to PDF** button in the preview toolbar
- A save dialog appears with the option to open the generated PDF
- PDF generation has a 60-second timeout
- The endpoint `/api/calcpad/pdf` handles generation; `/api/calcpad/pdf/health` checks service status

### Browser Detection

PuppeteerSharp auto-detects available browsers in this order:
1. Microsoft Edge
2. Google Chrome
3. System browsers
4. Falls back to auto-downloading ChromeHeadlessShell

---

## 10. Web Backend Refactoring

### New Architecture

The web backend (`Calcpad.Web/backend`) was refactored from the former `Calcpad.Server` project with a cleaner separation of concerns.

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/calcpad/convert` | POST | Standard HTML conversion with theme support |
| `/api/calcpad/convert-unwrapped` | POST | Raw code rendering for error navigation |
| `/api/calcpad/convert-ui` | POST | UI mode with interactive variable overrides |
| `/api/calcpad/debug-raw-code` | POST | Get macro-expanded source code |
| `/api/calcpad/pdf` | POST | Generate PDF document |
| `/api/calcpad/pdf/health` | GET | PDF service health check |
| `/api/calcpad/lint` | POST | Semantic linting with error codes |
| `/api/calcpad/definitions` | POST | Extract macros, functions, variables, units |
| `/api/calcpad/find-references` | POST | Symbol location index (all uses/definitions) |
| `/api/calcpad/snippets` | POST | Code snippets by category |
| `/api/calcpad/resolve-content` | POST | Three-stage content resolution with macro expansion |
| `/api/calcpad/refresh-cache` | POST | Clear remote content cache |
| `/api/calcpad/tokens` | POST | Highlight tokens for a line |
| `/api/calcpad/tokens-line` | POST | Tokenize a single line |
| `/api/calcpad/sample` | GET | Get sample Calcpad content |

### Web Request Router

API routing has been moved from Calcpad.Core to Calcpad.Web for better separation:
- `Router` class handles `<service:endpoint>` syntax for API calls
- Supports authenticated requests with JWT tokens
- Configurable endpoint mappings via `RoutingConfig`

### Content Resolution Pipeline

A new three-stage pipeline in Calcpad.Highlighter processes files for linting:

1. **Stage 1** — Line continuation processing (`\` at end of line)
2. **Stage 2** — Include/read resolution and macro collection (recursive, with source mapping)
3. **Stage 3** — Macro expansion, variable/function/unit definition collection, and type tracking

---

## 11. Disk Caching and Performance

### Disk Cache

Large file contents are cached to disk to reduce memory usage:
- **Location:** `{AppContext.BaseDirectory}/cache/`
- **Cleanup:** Automatic hourly cleanup of files older than 24 hours
- **Format:** `.cache` file extension

### Base64 Truncation

When the linter processes files with embedded base64 content (e.g., images), content above a size threshold is truncated before analysis to prevent memory bloat.

### Remote Content Pre-Fetching

All remote `#include` and `#read` targets (URLs and API routes) are pre-fetched before the main conversion runs. Results are cached:
- **Global cache** — Shared across requests for URLs (which are constant)
- **Per-request cache** — For client-specific files
- Cache can be cleared via `/api/calcpad/refresh-cache`

---

## 12. Linter and Diagnostics Enhancements

### New Error Codes

| Code | Description |
|------|-------------|
| CPD-2201 | Duplicate macro definition |
| CPD-2202 | Macro name must end with `$` |
| CPD-2203 | Macro parameter must end with `$` |
| CPD-2204 | Invalid macro name (must start with a letter) |
| CPD-2205 | Malformed `#def` syntax |
| CPD-2206 | Unmatched `#def` or `#end def` |
| CPD-2207 | Nested macro definition not allowed |
| CPD-2208 | Macro parameter must start with a letter |
| CPD-2209 | Macro definition inside control block has no effect |
| CPD-2210 | Invalid character in macro name |
| CPD-2211 | Invalid character in macro parameter |
| CPD-2212 | Duplicate macro parameter |
| CPD-2213 | Required parameter after optional parameter (macro) |
| CPD-3214 | Required parameter after optional parameter (function) |
| CPD-3314 | Unknown keyword argument in macro call |
| CPD-3315 | Unknown keyword argument in function call |
| CPD-3415 | Malformed JSON in `#UI` directive |

### Semantic Validation

The Stage 3 semantic validator checks:
- Operator usage and placement
- Command syntax
- Directive syntax (including `#UI` JSON validation)
- Assignment patterns
- Incomplete expressions
- Constant reassignment
- Keyword argument validity

---

## 13. Bug Fixes

- **Include path stability** — Fixed crashes from self-referential or deeply nested includes
- **Recursive include support** — Includes now resolve recursively with proper cycle detection
- **Orphaned server cleanup** — Fixed orphaned `dotnet.exe` processes not being terminated when VS Code closes
- **Tokenizer stability** — Fixed multiple tokenizer crashes and edge cases
- **Macro parameter tokenization** — Fixed tokenization of macro parameters across included files
- **API call UI freezing** — Fixed long-running API calls blocking the VS Code UI (now properly async)
- **PDF plotting on Windows** — Fixed plotting issues due to PuppeteerSharp and Edge limitations
- **Global variable scoping** — Improved handling of global variables inside macro `#def` blocks
