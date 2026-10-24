# Parametric Drawings Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add parametric, two-way-editable engineering drawings (sidecar `.cdrw` files, SVG/DXF I/O, `$Drawing` directive) to CalcpadCE, with a node-dragging editor in the web/desktop frontends.

**Architecture:** All model logic stays in `Calcpad.Core` (new `Drawing/` folder): a text model with stable IDs, a tiny arithmetic evaluator for node expressions, an evaluator that binds host values, SVG and DXF writers over one model. `ExpressionParser` gains a `$Drawing` branch copied from the `$Plot` pattern (expression string in → SVG markup appended to output). The ASP.NET backend exposes `/drawing/parse|save|export-dxf|import-dxf` endpoints so the Vue frontends edit drawings without a TS reimplementation of the parser.

**Tech Stack:** .NET 10 / C# (internal), xUnit 2.9.3, minimal-API ASP.NET controller, Vue 3 + TypeScript (calcpad-web + shared calcpad-frontend), Tauri desktop wrapper.

**Spec:** `docs/superpowers/specs/2026-10-19-parametric-drawings-design.md`

## Scope Check

The spec is one module but lands in layers. **Tasks 1–9 are independently shippable** (drawings render in CLI, Web, Desktop, with DXF I/O via server endpoints). Tasks 10–11 are the interactive editor. If capacity forces a cut, ship 1–9 first and re-plan 10–11 separately — they touch only frontend/server files.

## Global Constraints (verbatim from spec)

- DXF target: **R2018 ASCII DXF**; reader/writer tolerant; `$INSUNITS` absent ⇒ **assume mm + record a warning**.
- `.cdrw` serializer: **one record per line, canonical order** `#drawing → #input* → #node* → #member* → #annotation* → #dimension* → #style* → #view`; stable IDs (`n1`, `m1`).
- Dimensions always **computed**, never stored literals; member length always derived.
- SVG output must be **static** — no `<script>`, no JS dependency (PDF/Word export path).
- Sidecar renders **standalone from defaults**; host bindings optional; unit mismatch (e.g. m vs rad) is an **error**, not a silent conversion.
- Editor saves sidecar **on every drag end**; the `.cpd` is **never** rewritten by the editor.
- Canvas edits for **driven** quantities are blocked with an "unlink to literal" affordance.
- All geometry/arithmetic formatting via `CultureInfo.InvariantCulture`.
- Annotations layer as `<g class="cdrw-geom|cdrw-callouts|cdrw-dims">`; callouts and dims are each toggleable (variant C).
- **SDK pin note:** `global.json` pins .NET SDK `10.0.113` (`rollForward: disable`). If `dotnet test` fails with an SDK-resolution error (e.g. only `10.0.400` installed), run verification in the repo's CI environment or install the pinned SDK; an executor must **not** edit `global.json` in a task commit.

## Review Focus

Inputs/failure modes the spec implies that no task's happy path exercises:

1. **Missing/renamed sidecar file** — expect a rendered error placeholder + recorded error, no crash of the whole render. → Pinned by test in Task 8.
2. **Binding references an undefined host variable** (`L = Q_missing`) — expect an error naming the variable. → Task 8.
3. **Unit mismatch** (host in rad, input declared `m`) — expect an error, no partial render. → Tasks 4 (evaluator unit test) and 8 (end-to-end).
4. **DXF without `$INSUNITS`** — expect mm + warning, not silent mis-scale. → Task 7.
5. **`#node` expression referencing an undeclared input** — expect a parse error naming the node id. → Task 2.
6. **Unitless host value for a declared-unit input** — accepted as already-in-declared-unit (design decision; noted to user). → Task 4.

---

### Task 1: Arithmetic evaluator for drawing expressions

**Files:**
- Create: `Calcpad.Core/Drawing/DrawingExpression.cs`
- Test: `Calcpad.Tests/Drawing/DrawingExpressionTests.cs`

**Interfaces:**
- Produces: `internal static class DrawingExpression` with
  `double Evaluate(string expression, IReadOnlyDictionary<string, double> variables)`
  and `internal sealed class DrawingExpressionException : Exception` (message includes offending token and character position). Supports: numbers (also unit-suffixed: `12mm`, `3m`, `90deg` → SI-base doubles, mm⇒0.001 m, deg⇒π/180), `+ - * / ^ ( )`, unary minus, identifiers (case-sensitive), and `sin cos tan sqrt abs min max` (1–2 args, radians for trig — callers pre-convert angles). Whitespace tolerated.

- [ ] **Step 1: Write the failing tests**
  Assert at least: `Evaluate("2+3*4", empty) == 14`; `Evaluate("L/6", {"L":12}) == 2`; `Evaluate("h*2/3", {"h":3}) == 2`; `Evaluate("12mm", empty) == 0.012`; `Evaluate("90deg", empty) == Math.PI/2` within 1e-12; `Evaluate("sqrt(2)+abs(-2)", empty)` ≈ 3.414; error cases: unknown identifier `"Q+1"` throws `DrawingExpressionException`; trailing garbage `"2+3x"` throws; empty string throws.

```csharp
[Theory]
[InlineData("2+3*4", 14)]
[InlineData("12mm", 0.012)]
public void Evaluate_..._ReturnsExpected(string expr, double expected) // + Dictionary cases as above
```

- [ ] **Step 2: Run test to verify it fails**
  Run: `dotnet test Calcpad.Tests/Calcpad.Tests.csproj --filter "FullyQualifiedName~DrawingExpression"`
  Expected: FAIL (types do not exist → compile error).

- [ ] **Step 3: Implement `DrawingExpression.Evaluate`**
  Recursive-descent parser over `ReadOnlySpan<char>`; per-expression tokenizer, no allocations beyond the parse itself. Unit-suffix handling: `Unit.TryGet(suffix, false, out var u)`; if it resolves, convert to base via `u.ConvertTo(baseUnit)` where base is meters for lengths, radians for angles, plain factor for dimensionless (e.g. `-`/min 3 input units); an unknown suffix is a parse error. Keep the class internal and sidecar-local — do not reuse `MathParser`.

- [ ] **Step 4: Run test to verify it passes**
  Run: `dotnet test Calcpad.Tests/Calcpad.Tests.csproj --filter "FullyQualifiedName~DrawingExpression"`
  Expected: PASS

- [ ] **Step 5: Commit** — `git add Calcpad.Core/Drawing/DrawingExpression.cs Calcpad.Tests/Drawing/... && git commit -m "feat(drawings): arithmetic evaluator for sidecar expressions"`

### Task 2: `.cdrw` reader (parse to model)

**Files:**
- Create: `Calcpad.Core/Drawing/DrawingModel.cs` (records: `DrawingModel`, `DrawingInput` (name, defaultRaw, unitText, comment), `DrawingNode` (id, XRaw, YRaw), `DrawingMember` (id, NodeA, NodeB, Group), `DrawingCallout` (Group, Label, State), `DrawingDimension` (NodeA, NodeB, Align, TextPattern), `DrawingStyle` (Name, Stroke, Width), `DrawingView` (Title, Subtitle, Units, Scale, `IReadOnlyList<string>? Supports`)) — all `record` types, strings held raw.
- Create: `Calcpad.Core/Drawing/DrawingReader.cs`
- Test: `Calcpad.Tests/Drawing/DrawingReaderTests.cs`

**Interfaces:**
- Produces: `internal sealed class DrawingReader` with `static DrawingModel Parse(string text)` and `static DrawingModel Parse(string text, out IReadOnlyList<string> errors)`. Errors are strings with line numbers (`"#node n2 (line 7): ..."`). Unknown `#record` types and malformed lines become errors, not exceptions.
- Consumes: nothing (pure text parsing; expressions stay raw strings at this stage).

- [ ] **Step 1: Write the failing tests**
  Use the spec's Appendix A content as the fixture string. Assert: 3 inputs named `L`,`h`,`n` with units `m`,`m`,`-`; node `n2` holds raw exprs `L/6`,`h*2/3`; member groups parsed; 3 dimensions; error path: a source with `#node` before any input, `#member m1 nX n2` (unknown node), and a `#node` whose expression references undeclared name — each surfaces in `errors` mentioning the node/member id (Review Focus #5).

- [ ] **Step 2: Run test to verify it fails**
  Run: `dotnet test Calcpad.Tests/Calcpad.Tests.csproj --filter "FullyQualifiedName~DrawingReader"`
  Expected: FAIL (compile error).

- [ ] **Step 3: Implement `DrawingReader`**
  Line-split, `#`-prefixed records, `key=value` attributes with quoted strings for `label/state/text/title`. Declarations with `?` and `{default}` syntax per spec §4. Explicitly resolve nothing — forward references (member→node declared later) are allowed; validation of references happens here (nodes exist, inputs declared for used names) and expression evaluation happens in Task 4.

- [ ] **Step 4: Run test to verify it passes** (same filter, now PASS)

- [ ] **Step 5: Commit** — `feat(drawings): .cdrw reader with stable-id model`

### Task 3: Canonical `.cdrw` writer (round-trip identity)

**Files:**
- Create: `Calcpad.Core/Drawing/DrawingWriter.cs`
- Test: `Calcpad.Tests/Drawing/DrawingWriterTests.cs`

**Interfaces:**
- Consumes: `DrawingModel` (Task 2).
- Produces: `internal static class DrawingWriter` with `static string Write(DrawingModel model)`.

- [ ] **Step 1: Write the failing test**
  Round-trip: `Parse(Write(Parse(specimen)))` then `Write(...)` again — both writes byte-identical (`Assert.Equal` on strings). Canonical order per Global Constraints; values without quotes unquoted, with quotes quoted; blank lines collapsed (writer output has no blank lines).

- [ ] **Step 2: Run test to verify it fails** (filter `DrawingWriter`, FAIL)

- [ ] **Step 3: Implement `DrawingWriter`**
  StringBuilder, one record per line, canonical order, `InvariantCulture` for numbers. Comments/authors' blank lines are intentionally lost on rewrite (by design — canonical form for diffability; document in class doc comment).

- [ ] **Step 4: Run test to verify it passes** (PASS)

- [ ] **Step 5: Commit** — `feat(drawings): canonical .cdrw serializer`

### Task 4: Evaluator — bindings, unit conversion, computed values

**Files:**
- Create: `Calcpad.Core/Drawing/DrawingEvaluator.cs`
- Test: `Calcpad.Tests/Drawing/DrawingEvaluatorTests.cs`

**Interfaces:**
- Consumes: `DrawingModel`, `DrawingExpression` (Tasks 1–2).
- Produces:
  `internal sealed record EvaluatedDrawing(IReadOnlyDictionary<string, (double X, double Y)> Nodes, IReadOnlyList<(string Id, (double X,double Y) A, (double X,double Y) B, string Group)> Members, IReadOnlyList<DrawnDimension> Dimensions, IReadOnlyList<DrawnCallout> Callouts, ...)`;
  `internal static class DrawingEvaluator` with
  `static EvaluatedDrawing Evaluate(DrawingModel model, IReadOnlyDictionary<string, (double Value, Unit Units)> bindings, bool isUs)`
  returning values **in each input's declared unit** (host conversion: `host.Units.ConvertTo(declared)` after `IsConsistent` check; unitless host ⇒ accept as declared). Dimension text: `{[expr]:.3f}` placeholders formatted `InvariantCulture`.

- [ ] **Step 1: Write the failing tests**
  Defaults-only eval of the truss: `n2 == (2, 2)` (L=12, h=3); dimension `a` text ≡ `"a = 2.000 m"`; `L` dimension `"L = 12.000 m"`. Binding test: pass `L=(12000, mm)` → same geometry as `L=(12, m)` (Review Focus consistency). Unit-mismatch test: `L=(1.0, rad)` throws with message containing the input name (Review Focus #3). Unitless host: `L=(12, null)` accepted.

- [ ] **Step 2: Run test to verify it fails** (filter `DrawingEvaluator`, FAIL)

- [ ] **Step 3: Implement `DrawingEvaluator`**
  Build variable dictionary: defaults → bindings override. Unit-suffixed literals inside expressions are converted per Task 1; bare numbers are in declared units. Nodes/members/dimensions evaluated in declaration order; missing declared inputs (no default, no binding) error naming the input.

- [ ] **Step 4: Run test to verify it passes** (PASS)

- [ ] **Step 5: Commit** — `feat(drawings): evaluator with host-unit conversion and computed dimensions`

### Task 5: SVG writer

**Files:**
- Create: `Calcpad.Core/Plotter/DrawingSvgWriter.cs`
- Test: `Calcpad.Tests/Drawing/DrawingSvgWriterTests.cs`

**Interfaces:**
- Consumes: `EvaluatedDrawing` + `DrawingModel` (styles/annotations/view) + sidecar path (for `data-drawing-src`).
- Produces: `internal static string Write(DrawingModel model, EvaluatedDrawing evaluated, string sidecarPath)` returning the complete `<svg class="drawing" data-drawing-src="...">…</svg>` string.

- [ ] **Step 1: Write the failing tests**
  Assert: opens `<svg class="drawing"` + `data-drawing-src`; contains three groups `<g class="cdrw-geom">`, `cdrw-callouts`, `cdrw-dims`; dimension text nodes carry `paint-order` halo; **each node carries `data-driven="true|false"` and `data-node-id`, consumed by the Task 10 editor**; style colors from model appear as `stroke` attrs (hex verbatim); **no `<script>` substring** (Review Focus: JS-free); two consecutive calls produce byte-identical output (determinism); `viewBox` covers all geometry + margin.

- [ ] **Step 2: Run test to verify it fails** (filter `DrawingSvgWriter`, FAIL)

- [ ] **Step 3: Implement `DrawingSvgWriter`**
  Members ⇒ `<line>`; nodes ⇒ small circles. Pin/roller support glyphs render only when `#view` declares `supports=pin,roller` (the truss example does); add `internal IReadOnlyList<string>? Supports` to `DrawingView` in Task 2's record set so this field is declared up front. Dimension rendering: extension lines, arrows, centered text like the annotation-layer mockup from the brainstorming session (`.superpowers/brainstorm/` session artifact, variant C rendering). Numbers rounded to 2 places, InvariantCulture (mirrors `SvgDrawing.Convert`).

- [ ] **Step 4: Performance test (spec §10)**
  In the same test file: generate a `DrawingModel` with 10k nodes/members programmatically, evaluate + write SVG, assert elapsed < 100 ms (use `Stopwatch`, single-run, generous CI margin at 250 ms to avoid flaky failure on shared runners — the 100 ms budget is for developer machines; the assertion comment must say so).

- [ ] **Step 5: Run test to verify it passes** (PASS)

- [ ] **Step 6: Commit** — `feat(drawings): svg writer with toggleable annotation layers`

### Task 6: DXF writer

**Files:**
- Create: `Calcpad.Core/Drawing/DrawingDxfWriter.cs`
- Test: `Calcpad.Tests/Drawing/DrawingDxfWriterTests.cs`

**Interfaces:**
- Consumes: `DrawingModel`, `EvaluatedDrawing`.
- Produces: `internal static class DrawingDxfWriter` with `static byte[] Write(DrawingModel model, EvaluatedDrawing evaluated)` — R2018 ASCII DXF, geometry converted to mm; layers `GEOM-TOP/GEOM-BOT/GEOM-WEB/CALLOUTS/DIMS`; members as `LINE`, supports as `LWPOLYLINE`, callouts/dims as `TEXT` + exploded leader `LINE`s; `$INSUNITS` = 4 (mm).

- [ ] **Step 1: Write the failing test**
  Assert structure: `HEADER`/`ENTITIES` sections present; `$INSUNITS\n 70\n   4`; a member line's coordinates match evaluated geometry × 1000 (m→mm); text entities present for dimension labels.

- [ ] **Step 2: Run test to verify it fails** (filter `DrawingDxfWriter`, FAIL)

- [ ] **Step 3: Implement `DrawingDxfWriter`**
  Minimal ASCII DXF emitter (pairs of group-code/value lines). No DIMENSION entities in v1 — exploded primitives; documented per spec §11.

- [ ] **Step 4: Run test to verify it passes** (PASS)

- [ ] **Step 5: Commit** — `feat(drawings): R2018 ASCII DXF writer`

### Task 7: DXF reader (literal import)

**Files:**
- Create: `Calcpad.Core/Drawing/DrawingDxfReader.cs`
- Test: `Calcpad.Tests/Drawing/DrawingDxfReaderTests.cs`

**Interfaces:**
- Consumes: DXF bytes.
- Produces: `internal static (DrawingModel Model, IReadOnlyList<string> Warnings) Read(Stream dxf)` — entities map to **literal** nodes/members (no expressions, all numeric); layer names → `group=` values; unknown entities skipped (collect as warnings); missing `$INSUNITS` ⇒ warning `"no $INSUNITS, assuming mm"` (Global Constraints; Review Focus #4) and mm coordinates kept as-is.

- [ ] **Step 1: Write the failing test**
  Round-trip: `Write(evaluated)` → `Read` → node/member coordinates equal the original ±1e-6 m; warning present when header stripped. Reader on a hand-written minimal DXF (not produced by our writer) must also parse — pins the tolerant-reader promise.

- [ ] **Step 2: Run test to verify it fails** (filter `DrawingDxfReader`, FAIL)

- [ ] **Step 3: Implement `DrawingDxfReader`**
  Group-code pair scanner (no XML/DXF library — the subset is small); `LINE`/`LWPOLYLINE`/`CIRCLE`/`ARC`/`TEXT`; endpoint dedup tolerance 1e-9 for node stitching; members from lines whose both endpoints touch other lines.

- [ ] **Step 4: Run test to verify it passes** (PASS)

- [ ] **Step 5: Commit** — `feat(drawings): literal DXF import to editable .cdrw`

### Task 8: `$Drawing` directive in ExpressionParser

**Files:**
- Modify: `Calcpad.Core/Parsers/ExpressionParser/ExpressionParser.cs` (the Parse-method loop, line ~199: change `if ((textSpan[0] != '$' || !ParsePlot(textSpan)) && ...)` to also try `ParseDrawing(textSpan)`)
- Create: `Calcpad.Core/Drawing/DrawingDirective.cs` (the argument parsing + render call, so ExpressionParser.cs stays a thin branch)
- Test: `Calcpad.Tests/Drawing/DrawingDirectiveTests.cs`
- Create: `Examples/Engineering/3D, Plotting, Drawing/Truss Drawing.cpd` + `Truss Drawing/truss-example.cdrw` (sidecar in a folder next to the .cpd — Calcpad's include/image convention); add entry to `docs/examples.yml`

**Interfaces:**
- Consumes: Tasks 2–5 writers/readers; `ExpressionParser`'s `_parser` (MathParser) for binding-value evaluation, `_sb`, `HtmlId`, `InsertAttribute`, `SourceFilePath`, `PathRoots` (all already local to the parse loop's class).
- Produces: syntax `'Label -'$Drawing{ Truss Drawing/truss-example.cdrw; L = L_w; h = h_w }` — file path first, bindings `name = expression` separated by `;`. Path resolution: `{library}`/`{project}` tokens via `PathRoots.TryExpand`, else relative to `Path.GetDirectoryName(SourceFilePath)`.

- [ ] **Step 1: Write the failing tests**
  Using the `Render(source)` helper pattern from `VisibilityDirectiveTests`: (a) a worksheet with a temp-dir sidecar renders `<svg class="drawing"`; (b) missing sidecar renders a visible error placeholder containing the file name and does NOT throw (Review Focus #1); (c) binding `L = Q_missing` produces an error message containing `Q_missing` (Review Focus #2); (d) unit-mismatch error propagates (Review Focus #3 integration); (e) reported errors are captured in `parser.Errors`.

- [ ] **Step 2: Run test to verify it fails**
  Run: `dotnet test Calcpad.Tests/Calcpad.Tests.csproj --filter "FullyQualifiedName~DrawingDirective"`
  Expected: FAIL (unknown directive → renders as plain comment/calc line).

- [ ] **Step 3: Implement `ParseDrawing`**
  Mirror `ParsePlot` (line 264): check `$drawing` prefix case-insensitively, gate on `_isVisible && IsEnabled()`, wrap in try/catch calling `AppendError`. Bindings: split args on `;` outside parens/quotes; each binding eval'd via `_parser.Parse(expr); _parser.Calculate();` then read `Real` + units the same way `PlotParser` reads result values for plot expressions. Emit `InsertAttribute(svg, HtmlId)`.

- [ ] **Step 4: Run test to verify it passes** (PASS)

- [ ] **Step 5: Add the example + regenerate its CI stub**
  Create the example .cpd + sidecar; add `docs/examples.yml` entry (name must equal the .cpd filename per DEVELOPER.md); run `python .github/scripts/compare_renderings.py --write` to refresh the HTML stub the CI expects.

- [ ] **Step 6: Run the full test suite once**
  Run: `dotnet test Calcpad.Tests/Calcpad.Tests.csproj`
  Expected: PASS (guards against regressing `$Plot` parse order).

- [ ] **Step 7: Commit** — `feat(drawings): $Drawing directive rendering sidecars through Core`

### Task 9: Server drawing endpoints

**Files:**
- Create: `Calcpad.Web/backend/Services/DrawingService.cs`
- Modify: `Calcpad.Web/backend/Controllers/CalcpadController.cs` (add 4 endpoints)
- Test: `Calcpad.Tests/Drawing/DrawingServiceTests.cs`

**Interfaces:**
- Consumes: Core `DrawingReader/Writer/Evaluator/SvgWriter/DxfWriter/DxfReader` (Tasks 2–7).
- Produces (all under existing `[ApiController]` with its token auth — reuse the pattern of `/cpdz/decode`):
  - `POST /api/calcpad/drawing/parse` `{ path }` → `{ modelSummary, evaluatedNodes, svg, warnings }` (evaluated with sidecar defaults; path validated to end `.cdrw`, resolved relative to the document path like Core does).
  - `POST /api/calcpad/drawing/save` `{ path, nodes: {id → {x, y}} }` — re-reads the sidecar, applies node coordinate updates **by id**, re-serializes canonically (Task 3), writes the file. Unknown id → 404-ish error body.
  - `POST /api/calcpad/drawing/export-dxf` `{ path }` → DXF bytes.
  - `POST /api/calcpad/drawing/import-dxf` (multipart file) → `{ cdrw }` text.

- [ ] **Step 1: Write the failing tests**
  Service-level (not HTTP): save round-trip (parse specimen → nudge n2 → save → re-read → values changed), unknown-node rejection, export-dxf bytes start with `0  \r\nSECTION`? (exact DXF head), import produces the literal model. Path-shape validation rejects `../` traversal out of the directory (security note).

- [ ] **Step 2: Run test to verify it fails** (filter `DrawingService`, FAIL)

- [ ] **Step 3: Implement `DrawingService` + controller wiring**
  Follow `CalcpadService` conventions (try/catch → `FileLogger.LogError`, non-success `StatusCode(500, ...)`).

- [ ] **Step 4: Run test to verify it passes** (PASS; run whole suite once before commit)

- [ ] **Step 5: Commit** — `feat(drawings): server endpoints for parse, save, and dxf i/o`

### Task 10: Editor MVP in calcpad-web (double-click to drag)

**Files:**
- Create: `Calcpad.Web/frontend/calcpad-web/src/components/DrawingEditor.vue`
- Modify: `Calcpad.Web/frontend/calcpad-frontend/src/api/client.ts` (4 endpoint methods)
- Modify: `Calcpad.Web/frontend/calcpad-web/src/App.vue` + preview toolbar (add "Edit drawing" affordance when preview HTML contains `data-drawing-src`)
- Test: frontend has **no unit-test runner** (verified: no vitest/jest in any package.json). Verification is `tsc` build + a scripted manual pass (below).

**Interfaces:**
- Consumes: Task 9 endpoints via the shared `CalcpadApiClient`; preview iframe HTML inspection (`data-drawing-src` attr on the svg root, emitted by Task 5).
- Produces: Editor modal — shows the parsed SVG (from `/drawing/parse`), draws square handles on **literal** nodes only (driven nodes get a lock glyph + "unlink to literal" button that posts `save` with the literal coordinate replacing the expression — spec §8 semantics), drags with pointer capture, posts `/drawing/save` on pointerup (spec: save on every drag), closes without touching the `.cpd`.

- [ ] **Step 1: Typecheck baseline**
  Run: `npm --prefix Calcpad.Web/frontend/calcpad-frontend run build && npm --prefix Calcpad.Web/frontend/calcpad-web run build` — record green (drift baseline).

- [ ] **Step 2: Implement the four API methods** in `client.ts` (mirror `decodeCpdz`'s `post<...>` shape exactly; add types to `types/api.ts`).

- [ ] **Step 3: Implement `DrawingEditor.vue`**
  Modal styling consistent with existing tabs (`styles/`); SVG injected via `v-html` from the parse response; handle overlay computed from `evaluatedNodes` — **client does not evaluate expressions**; the server's evaluated coordinates are the only geometry the editor shows. Literal-vs-driven distinction comes from the SVG's per-node `data-driven="true|false"` marker (add that marker in Task 5's writer now if not already present — driven nodes rendered as small circles vs plain for literal).

- [ ] **Step 4: Wire the affordance** in App.vue/preview toolbar; visible only when `data-drawing-src` present.

- [ ] **Step 5: Verify build passes** (same two build commands; PASS required)

- [ ] **Step 6: Scripted manual verification (no e2e framework exists — this is the honest substitute; the spec's Playwright plan item is corrected here)**
  Run: `npm --prefix Calcpad.Web/frontend/calcpad-web run dev` with the backend running (`dotnet run --project Calcpad.Web/backend`); open the Truss Drawing example; click Edit drawing; drag `n2`; close; inspect the sidecar on disk — `#node n2` line must reflect the drag on disk **immediately on pointerup** (Global Constraint: save on every drag). Record the outcome in the PR description.

- [ ] **Step 7: Commit** — `feat(drawings): node-drag editor mvp for web and desktop`

### Task 11: DXF import/export UI + docs

**Files:**
- Modify: `Calcpad.Web/frontend/calcpad-frontend/src/vue/CalcpadInsertTab.vue` (desktop insert palette)
- Modify: `Calcpad.Web/frontend/calcpad-web/src/App.vue` (web toolbar entries)
- Create: `docs/parametric-drawings.md` (user-facing doc; link from `docs/index.md`)

**Interfaces:**
- Consumes: Task 9 endpoints.

- [ ] **Step 1: Add "Import DXF drawing…" and "Export DXF" actions**
  Import: file picker → upload → save returned `.cdrw` next to the document (tauri-bridge `writeTextFile` on desktop; browser mode shows the resulting text in the editor with a note, since browser cannot write files — honest limitation, matches existing image-insert behavior).

- [ ] **Step 2: Write the user docs page**
  Cover: the directive syntax, the sidecar format (copy spec §4's example), edit affordance, DXF I/O, and the two known limitations (no constraint solver; DXF imports are literal).

- [ ] **Step 3: Verify builds + manual click-through** (both frontends build PASS; click-through recorded in PR)

- [ ] **Step 4: Commit** — `feat(drawings): dxf import/export surface and user docs`

---

## What this plan deliberately leaves open (builder decides)

- Internal `DrawingModel` member naming beyond the record fields named in Task 2 (keep stable IDs + canonical serialization).
- DXF group-code emission details (any conforming R2018 ASCII output qualifies).
- SVG handle/selection styling (must remain `class`-driven, no inline JS).
- Editor modal micro-UX (consistent with existing tab styling).
