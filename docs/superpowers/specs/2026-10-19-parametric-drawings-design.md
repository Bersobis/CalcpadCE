# Parametric Drawings Module for Calcpad — Design

**Date:** 2026-10-19
**Status:** Draft — awaiting approval
**Companion artifact:** interactive mockup at `.superpowers/brainstorm/` (annotation-layer-v3), user-selected variant **C**.

---

## 1. Intent and the why

Calcpad worksheets do engineering math beautifully but cannot *hold* a drawing: today the only routes are `$Plot` (function graphs, not annotated details) and hand-written `#def` macros emitting raw SVG strings (see `Examples/Engineering/3D, Plotting, Drawing/svg_drawing.cpd`). That macro approach *draws* fine but cannot be *edited* — there is no geometry model, no selection, no handles, no verified dimensions.

This module adds **interactive, parametric engineering drawings** (first-case deliverable: the user's truss reference image) that live **inside the script's calculation cycle**:

- A drawing is a first-class object in a worksheet, rendered as SVG in output, **editable in a canvas editor, and exportable/importable to both SVG and DXF** (DXF both directions, editable — see §6).
- Parametric means worksheet variables drive geometry. The user's locked direction for editing is **fully two-way**: drag in the canvas updates the model; typing/dragging numbers updates the drawing.

**Rejected alternative (why "script drives only" was not chosen):** one-way depictions wouldn't satisfy the user's explicit need to *edit* a drawing and have the worksheet follow along. Two-way is the ambitious direction and is what actually closes the gap with tools like Blockpad.

**Prior art influencing this:** Blockpad's model of dimensions/labels as spreadsheet-cell-like annotations (verified via https://blockpad.net/pages/deep-dive/drawings and https://blockpad.net/pages/quick-start-sketches) — annotations holding formulas, and "Use Measured Value" semantics for dimension labels. **Not copied:** Blockpad's constraint-solver-free approach of purely hand-drawn geometry — we keep a small explicit parametric graph because Calcpad's whole identity is "the math is the source of truth".

---

## 2. Goals / Non-goals / Anti-goals

**Goals**
1. Insert a drawing into a worksheet script with a directive-like line (`$Drawing`), referencing a sidecar drawing file.
2. Worksheet variables (e.g. `L`, `h`, `n_panels`, material sizes) drive geometry through named parameter bindings declared in the drawing file.
3. Edit the drawing on a canvas: select entities, drag nodes/handles, see computed dimension annotations update live.
4. Output the drawing as clean, styleable SVG inside the worksheet's rendered HTML. No JavaScript required for the static output (so PDF/Word export keeps working).
5. Export the drawing to DXF and import a DXF back as editable literal geometry.
6. Persist drawings as human-diffable text (one entity per line, roughly), sidecar file, referenced from the worksheet.

**Non-goals**
- Full CAD constraint solver (coincident/parallel/tangency constraint objects with degrees-of-freedom solving). We model explicit parametric relationships instead.
- 3D drawings. (Calcpad already demonstrates 3D via optional three.js embedding; out of scope here.)
- Raster/image tracing, hatching, or section views in v1.
- Automatic generation of geometry from worksheet `#def` macros (that remains available for cases this module doesn't fit).

**Anti-goals (would make this a failure even if it worked)**
- A drawing that silently diverges from the worksheet's numbers (the whole point is they can't disagree).
- A sidecar that references host variables but cannot be opened/diffed/versioned standalone without the host.
- SVG output that only renders with JavaScript enabled (breaks PDF/Word export paths used for reporting).

---

## 3. Locked user decisions (from brainstorming session)

| Decision | User's call |
|---|---|
| Editing truth flow | **Fully two-way** (canvas ↔ script), continuous |
| Where the model lives | **Sidecar drawing file** referenced by the script; canvas edits never rewrite the `.cpd` |
| First showcase drawing | **Truss with dimension annotations** |
| Annotation style | **Variant C — both callouts and dimensions**, each toggleable; dimensions always show computed values |
| Member length | **Always derived**, never independently editable |
| Ambition for DXF | **Editable in and out**, shipped with the truss case |
| Directive | New **`$Drawing`** in Calcpad.Core, styled after `$Plot` |
| Sidecar save timing | **Save on every drag** — each completed drag writes the sidecar immediately |
| First version surface | **Core + all frontends** (CLI, Web, Desktop) from day one |

---

## 4. File format: the sidecar drawing (`.cdrw`)

A `.cdrw` file is UTF-8 text, one record per line, deliberately near-`#include`-compatible so it reads like a small Calcpad dialect. Sections:

```
#drawing truss-example
#input L  = ? {12}    m   # Span between supports
#input h  = ? {3}     m   # Rise at apex
#input n  = ? {6}     -   # Number of panels (int, min 3)

#node  n1  (0, 0)
#node  n2  (L/6, h*4/3)      # expressions allowed
#node  ...
#member m1  n1 n2   group=top
#member ...

#annotation group=top    label="Top chord"  state="In compression"
#dimension n1→n2  align=below  text="a = {[a]:.3f} m"

#style top   stroke=#4d6f8f  width=10
#style web   stroke=#3c4852  width=7

#view  title="Truss Members" subtitle="Gravity load"
       draw_scale=auto  units=m
```

Key semantics:

- `#input` names + defaults + units declare the drawing's **contract** with any host worksheet (name, default, unit). A drawing must render standalone with its own defaults.
- `#node`/`#member`/`#annotation`/`#dimension` records carry **stable IDs** (`n1`, `m1`) so two-way editing has deterministic targets for diff/revert.
- `#node` coordinates may be **literal numbers or expressions** in declared inputs. Expressions use a tiny built-in evaluator (Calcpad-compatible subset: `+ - * / ^ ()`, declared input names, numbers with SI suffixes like `12mm`, and standard math functions `sin/cos/sqrt/...`). This is intentionally **not** the full Calcpad expression language; keeping it small keeps the sidecar cheap to validate and keeps the evaluator portable to the browser editor later.
- `#dimension` text may contain `{[expr]:format}` placeholders; values always come from evaluated geometry, never stored literals (guarantees "can never drift from the geometry").
- `#style` names colors/widths; `#view` carries title/caption/scales. Colors are hex, not theme keywords, so PDF/Word output is stable.

**Diffability rule:** the serializer writes one record per line, in a canonical order (`#drawing`, `#input*`, `#node*`, `#member*`, `#annotation*`, `#dimension*`, `#style*`, `#view`), so a canvas drag session produces a minimal, reviewable diff.

---

## 5. The reference line in the worksheet

```
'Drawing -'$Drawing{ truss-example.cdrw;  L = L_w; h = h_w; n = n_panels }
```

Semantics:

- Path resolution reuses the existing `PathRoots` / document-relative mechanics already used by `#include` and images (`Calcpad.Core/PathRoots.cs`, `ImageReferences.cs`), so `{library}` tokens and doc-relative paths work the same way. Missing file = rendered error placeholder in output, consistent with existing image behavior, plus a recorded parse error.
- Named bindings pass host variable values **by name** into the drawing's declared inputs. Unit checking: host value must be **compatible** with the input's declared unit (m ↔ mm ok with conversion, m ↔ rad is an error), reusing the project's existing unit system (`Calcpad.Core/BaseTypes/Unit.cs`).
- If the host omits a binding, the sidecar default applies (**the drawing never *requires* the host** — standalone renderability is a design invariant).
- Extra/Omissible: a `#val` mode identical in spirit to the existing `#val` directive is not needed in v1; input fields shown on the drawing (the `? {}`-style UI) are **not** in v1 — the host worksheet owns input UI. This stays out until asked for.

---

## 6. SVG and DXF over one model

**SVG (primary output; the thing Calcpad actually embeds in HTML):**
- Model → SVG at render time, every recalculation, via a new `DrawingSvgWriter` in `Calcpad.Core/Plotter/` alongside the existing `SvgDrawing.cs` (reusing its number-formatting conventions, halo trick for dimension text, and `viewBox` habits — cosmetic, not structural, reuse).
- Annotations are layered groups: `<g class="cdrw-geom">`, `<g class="cdrw-callouts">`, `<g class="cdrw-dims">` so worksheet-level CSS (already how plots theme themselves) can toggle/move layers.

**DXF (both directions, editable):**
- Out: `DrawingDxfWriter` writes a real DXF (LINE, LWPOLYLINE, SOLID for supports/fills, TEXT/MTEXT for labels, DIMENSION for dimensions where possible, otherwise exploded primitives). Target: **R2018 ASCII DXF**, tolerant reader in, tolerant writer out.
- In: `DrawingDxfReader` parses LINE/LWPOLYLINE/CIRCLE/ARC/TEXT/SOLID entities into a **literal** `.cdrw` (no expressions attached — you dimension it by hand after import, which is the honest scope set during brainstorming: "import DXF as literal backdrop, then dimension it" — but imported entities become *editable nodes/members*, not a frozen picture).
- Units: DXF has a `$INSUNITS` header; if absent, assume mm and record a warning at import. Round trip must preserve geometry within tolerance; styles degrade gracefully (no hatch/linetype fidelity promise in v1 beyond solid strokes).

---

## 7. Rendering pipeline in Core

- New `DrawingParser` (Parsers/) → `DrawingModel` (new folder `Calcpad.Core/Drawing/`): parse `.cdrw` text → validate → produce a model of nodes/members/annotations with **expression-holding quantities**.
- New `DrawingEvaluator`: substitutes declared inputs with host-provided (or default) values and evaluates node coordinates and dimension values. Because `#node` expressions are small and sidecar-local, evaluation is cheap and re-runs on every worksheet recalc without touching the Calcpad expression pipeline.
- Rendering: `$Drawing` directive → evaluates → emits inline SVG via the writer in §6, wrapped in the same sizing/insertion machinery `PlotParser`/`ChartParser` use (`Calcpad.Core/Parsers/PlotParser.cs` reference for the wrap/attribute pattern).
- Parse errors surface the existing way Calcpad reports them (error HTML at the line + recorded error), never crashing the render.

---

## 8. The canvas editor (two-way, the ambitious part)

Where it lives: the drawing editor ships in **all frontends from the first working version** (user decision: Core + all frontends) — CLI renders via Core with no interactive surface; the desktop app's Vue frontend hosts the canvas editor (same stack as the existing plotting and input-field interactions; no separate Electron surface — the editor is a component, not a window). Server-side Calcpad keeps rendering SVG for non-interactive contexts; the editor is a **client-side SVG view over the same model**, hydrated from the sidecar plus the host bindings.

Editing session:
1. Open a drawing's edit mode (double-click the rendered drawing, or a pencil affordance).
2. Same `DrawingModel` that rendered the SVG is hydrated in the browser; nodes/members/handles get hit-testing.
3. Drag a literal quantity → client-side re-render (no server round trip) → on drag end the sidecar is written immediately (user decision: save on every drag; diffs stay per-drag, reviewable per §4's canonical serialization).

   Per-drag writes produce one file change per drag in version control; squashing or discarding is left to the user's normal undo/git workflow, not the editor.
4. Drag a **driven** quantity → blocked with an inline affordance explaining it's driven by an expression, offering "unlink to literal" (this is Blockpad's "Use Measured Value" inverted: the *default* is respect-the-math).
5. Changing **host worksheet inputs** re-evaluates and re-renders both the SVG in output and the hydrated editor view.

**Two-way honesty note:** the worksheet's `.cpd` file is *never* rewritten by the editor (that was the sidecar decision's payoff). Two-way means: drag the drawing → sidecar geometry changes → rendered drawing changes; type in worksheet → bindings change → drawing's computed geometry changes. The `.cpd` stays untouched by canvas sessions, so version control stays sane.

**Out of scope for v1 editor:** multi-select, copy/paste of entities, undo/redo beyond browser-native input undo, snapping beyond endpoint/midpoint (Blockpad-style numerous snap modes are future work).

---

## 9. Performance expectations

- A typical drawing (the truss: 14 nodes, 25 members, 3+ dimension annotations) parses + evaluates + renders in well under 10 ms on server hardware; even a pathological sidecar (10k entities) should stay < 100 ms since the evaluator is arithmetic, not solving. This is per-recalc, so it sits on the same hot path as plot/chart rendering — same order of magnitude as the existing SVG plot path, not a regression risk.
- Canvas editor drag re-render is client-side full re-render of a small SVG (< a few ms for realistic drawings); no virtual DOM, no diffing engine.
- DXF import/export is file I/O bound, not per-frame; no perf constraint promised.

---

## 10. Testing and verification

- **Golden tests** on the sidecar parser: every example drawing file gets a canonical-serialization round-trip test (parse → serialize → parse → byte-identical aside from whitespace/comments).
- **Golden tests** on SVG output for the truss example: hand-inspected once, then locked so refactorings can't silently change output bytes.
- **Golden tests** on DXF round-trip: import a DXF → export it → re-import → geometry matches within tolerance.
- **Binding/unit tests**: host value with wrong unit → clear error, no partial render. Missing sidecar → rendered error placeholder + recorded error.
- **Editor interaction tests** are Playwright (the repo already has Playwright infrastructure) over the desktop app: select node, drag, check `#node` line changed in sidecar; change host input, check node moved.
- **Performance test** with a 10k-entity generated drawing to hold the < 100 ms parse+eval+render budget.

---

## 11. What this deliberately leaves to the builder

- Exact SVG class names and `<style>` conventions (just keep the layering of §6 and worksheet-overridable CSS).
- Internal `DrawingModel` data structure details (just honor the stable-ID and canonical-serialization rules).
- The precise small-expression grammar (start from the §4 list; extend only when a real drawing needs it, keeping sidecar-local evaluation self-contained).
- Whether DXF dimension entities are written as DIMENSION or exploded primitives per case (pick per-case based on which round-trips better; document the choice).

---

## 12. Anti-goals re-checked against this document (soft honesty pass)

- "SVG output without JavaScript" — met, SVG is static.
- "Drawing can't silently diverge from worksheet numbers" — met, dimensions always computed.
- "Drawing must open standalone with defaults" — met, `#input` defaults; drawing-side file never requires host bindings.

---

## 13. Sources consulted

- Interactive brainstorm with the user (this document's §3 table is their recorded decisions, verbatim in intent).
- Blockpad drawings docs: https://blockpad.net/pages/deep-dive/drawings and https://blockpad.net/pages/quick-start-sketches (dimension-as-cell semantics, "Use Measured Value", snap lists); https://blockpad.net/pages/releasenotes/1.5.0 (dimension label fix history showing limitations of their approach).

---

## Appendix A — what the truss example will look like in `.cdrw`

Abridged from the actual mockup artifact used in the session, so builder and user are looking at the same artifact:

```
#drawing truss-example
#input L = ? {12}  m
#input h = ? {3}   m
#input n = ? {6}   -
#node n1 (0, 0)
#node n2 (L/n, h*2/3)
... (14 nodes total: 7 bottom, 7 top incl. apex)
#member m1 n1 n2 group=top
... (25 members: 6 top, 6 bottom, 13 web)
#annotation group=top  label="Top chord"  state="In compression"
#annotation group=bot  label="Bottom chord"  state="In tension"
#dimension n1→n2  align=below  text="a = {[L/n]:.3f} m"
#dimension n1→n7  align=left   text="h = {[h]:.3f} m"
#dimension n1→n7b  align=below  text="L = {[L]:.3f} m"
#style top stroke=#4d6f8f width=10
#style bot stroke=#d9683f width=10
#style web stroke=#3c4852 width=7
#view title="Truss Members" subtitle="Gravity load"
```
