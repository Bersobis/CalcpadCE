# Live Editor — Implementation Approaches, Trade-offs, and Recommendation

Goal: a MathCAD-like live editor — you type a worksheet, math is typeset as real 2D math,
results appear inline, units and recalc behave like a calculator — while staying consistent
with how CalcpadCE is edited today (Monaco source + rendered output).

This document compares the viable ways to build that, and recommends one.

---

## 1. Baseline: what exists today

**Editing model.** Monaco is the authoring surface. The document is Calcpad *source text*.
Everything else is a rendering of that text.

**Two rendering paths exist, and they do not share code:**

| Path | Where | How math is produced |
|---|---|---|
| Preview / PDF / Word | `Calcpad.Server` (`Calcpad.Web/backend`) | `Calcpad.Core` parses, evaluates and writes HTML / OMML |
| Live editor canvas | `calcpad-frontend` (TypeScript, in-browser) | a **second** math implementation: `math/calcpad.ts` parser → MathJSON AST → `math/latex.ts` → MathLive |

**The live editor's own math stack (all client-side TypeScript):**

| File | Lines | Role |
|---|---:|---|
| `math/calcpad.ts` | ~920 | Calcpad source → MathJSON AST (a re-implementation of `MathParser`) |
| `math/latex.ts` | ~950 | AST ⇄ LaTeX (MathLive's language) |
| `math/mathjson.ts` | ~250 | AST node types |
| `math/roundTrip.ts` | ~245 | "is this line safe to edit graphically?" gate |
| `math/commitGuard.ts` | ~150 | last gate before a write-back |
| `math/omml.ts` + `math/xml.ts` | ~700 | AST → OMML (currently unused at runtime) |
| `math/matrixOps.ts`, `insertTemplates.ts`, `insertMultiply.ts` | ~385 | matrix reshape, template insertion |
| `CalcpadMathField.vue`, `CalcpadLiveEditor.vue`, `CalcpadMathToolbar.vue` | ~830 | MathLive wrapper + canvas + docked toolbar |

**Three structural facts that constrain every option below:**

1. **The engine is duplicated.** `math/calcpad.ts` is a second parser next to
   `Calcpad.Core`'s `MathParser`. They must agree, and nothing enforces that.
2. **Coverage is partial by design.** `classifyLineEdit` only marks a line editable when
   the TS round-trip is exact (`textStable && astStable && commitStable`). Everything else
   falls back to raw source. The canvas therefore edits a *subset* of the language.
3. **LaTeX is the pivot.** MathLive accepts LaTeX and derives MathML *from* LaTeX
   (`convertLatexToMathMl(latex)`); it has no OMML support and cannot read MathML.

---

## 2. Hard constraints

- **C1 — Engine fidelity.** `Calcpad.Core` (net10.0) is the source of truth. It pulls
  `SkiaSharp 3.119.1` (native graphics, for plots), `System.IO.Packaging`, and via
  `Calcpad.OpenXml` also `DocumentFormat.OpenXml 3.3.0` + `HtmlAgilityPack`.
  Browser-hostile code sits in `Plotter/Plotter.cs`, `PathRoots.cs`,
  `ExpressionParser.DataExchange.cs`, `ExpressionParser.Portable.cs` (file IO / paths).
- **C2 — No MathML-native WYSIWYG editor exists.** MathLive and MathQuill are LaTeX;
  MathType/Wiris is commercial; anything else is build-it-yourself. *Whatever* the engine
  choice, the 2D-entry widget is a separate, largely orthogonal decision.
- **C3 — Three hosts.** Web (`calcpad-web`), VS Code webview, and Tauri desktop
  (`calcpad-desktop`, which already spawns and owns a `.NET` sidecar).
- **C4 — Server scope.** On this branch `Calcpad.Server` is loopback-only by design.
- **C5 — "Consistent with current editing."** Today's editor is Monaco + server-rendered
  output; the live canvas is the outlier.

---

## 3. The options

### A. Status quo — client-side TypeScript canvas on MathLive (LaTeX)
Keep and grow `math/*.ts` + MathLive.

- **Pros:** works today; no round-trip per keystroke; offline; genuine WYSIWYG typeset editing.
- **Cons:** a second parser that can silently drift from `Calcpad.Core`; partial language
  coverage; LaTeX coupling; MathLive instance per equation line (heavy); bundle weight;
  styling diverges from the rest of the panel.
- **Verdict:** acceptable as a prototype; untenable as the long-term architecture.

### B. Client-side, LaTeX confined — MathML rendering, MathLive only while editing
Keep MathLive for entry, but render the resting state as native **MathML**
(`getValue('math-ml')` / an AST→MathML writer), and confine all LaTeX to one adapter module.

- **Pros:** removes LaTeX from the editor's visible output and from every module except the
  adapter; far fewer live MathLive instances; still WYSIWYG; no server dependency.
- **Cons:** the engine is *still* duplicated in TypeScript (the core problem is untouched);
  MathML is derived from LaTeX inside the library, so LaTeX never fully disappears.
- **Verdict:** a good *editing-layer* refinement. Not a fix for duplication.

### C. C# engine as the single source of truth, thin client (recommended backbone)
Extend the **existing** `/convert` to emit MathML (today it returns HTML only), and have the
client request typeset math per line/region. Monaco stays the authoring surface; the client
holds no parser.

- **Pros:** deletes the duplicate parser and printer; full language fidelity by construction;
  reuses the API and sidecar that already exist in all three hosts; matches how the current
  editor already works (type source → rendered output); OMML/Word already served by `/docx`;
  smallest conceptual change; no new runtime.
- **Cons:** a server round-trip per edit (needs debounce + cancellation — the API already
  supports `OperationCanceledException`/499); requires the server (fine for desktop, and the
  current branch is loopback-only anyway); still needs a math *widget* if 2D entry is wanted.
- **Verdict:** the correct backbone. Solves duplication and fidelity; leaves only the
  widget question open.

### D. C# in the browser — Blazor WebAssembly reusing `Calcpad.Core`
Compile the engine to WASM and run it client-side.

- **Pros:** one engine, no duplication; offline; full fidelity; reuses the C# test suite.
- **Cons:** `SkiaSharp` needs WASM native assets and `DocumentFormat.OpenXml` is large, so the
  payload and cold start are significant; `Plotter` / `PathRoots` / `DataExchange` need
  sandbox abstraction; it introduces a **second UI framework** (Blazor) beside Vue/Monaco,
  with JS↔.NET interop on the editing hot path. Critically, **it does not provide a math
  editor** — you still need MathLive or a custom widget.
- **Verdict:** solves the *rendering* problem at the highest cost, while leaving the *editing*
  problem unsolved. Justified only if offline in-browser C# becomes a hard requirement.

### E. C# on the server — Blazor Server / SignalR against the existing sidecar
Same as C, but with a stateful C# UI session instead of REST.

- **Pros:** no duplication; no WASM payload; full fidelity; the sidecar already exists.
- **Cons:** a persistent connection and per-keystroke latency; a second UI framework; the
  sidecar is per-document and loopback-only here. Adds little over C, which already has the
  engine.
- **Verdict:** only worth it if the UI itself must be C#.

### F. Native desktop C# (Avalonia / WPF) on `Calcpad.Core`
Reference the engine in-process; no serialization boundary at all.

- **Pros:** tightest integration, best performance, full fidelity, one language.
- **Cons:** abandons the web, VS Code and the existing Vue investment; `calcpad-desktop` is
  already Tauri+Vue, so this replaces rather than extends it.
- **Verdict:** only for a desktop-first product. Not aligned with the current three-host shape.

### G. Third-party MathCAD-like engine or commercial MathML editor
MathType/Wiris (MathML-native, commercial), or an OSS CAS (Math.js / SymPy via Pyodide).

- **Pros:** MathType is genuinely MathML-native and MathCAD-like; no widget to build.
- **Cons:** licence cost and vendor lock; OSS CAS engines do not speak Calcpad's dialect or
  units, so they *add* a third math implementation rather than removing one.
- **Verdict:** not recommended; it deepens the duplication.

---

## 4. Comparison

Scores are relative to this project's constraints (5 = best).

| Criterion | A. Status quo | B. LaTeX confined | **C. C# server** | D. Blazor WASM | E. Blazor Server | F. Native C# |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| Single source of truth | 1 | 1 | **5** | 5 | 5 | 5 |
| Language fidelity / coverage | 2 | 2 | **5** | 5 | 5 | 5 |
| MathCAD-like editing UX | 4 | 4 | 3 | 3 | 3 | 4 |
| Consistency with current editing | 2 | 2 | **5** | 2 | 2 | 2 |
| Offline / no-server | 5 | 5 | 2 | 5 | 1 | 5 |
| Latency on the hot path | 5 | 5 | 3 | 4 | 2 | 5 |
| Payload / startup cost | 3 | 4 | 5 | 1 | 4 | 5 |
| Maintenance burden (lower better) | 2 | 3 | **4** | 2 | 2 | 3 |
| Cross-host reuse (web/VSCode/desktop) | 4 | 4 | **5** | 2 | 2 | 1 |
| Effort to reach it | 5 | 3 | 4 | 1 | 2 | 1 |

**Read-out.** C wins on every axis that matters for correctness and maintainability, and
costs only the server round-trip. B is the right *editing-layer* refinement but does not
address duplication. D/E/F all achieve a single source of truth but pay heavily in payload,
framework duplication, or host reach — and **none of them removes the need for a math input
widget**.

---

## 5. Recommendation

**Adopt C as the backbone, with B as the editing layer, and treat D/F as deferred.**

### Phase 1 — make the engine single-source (do this first)
1. Add a MathML output mode to `/convert` (a `format` parameter, or a sibling endpoint).
   `Calcpad.Core` already writes HTML and OMML; MathML is a third writer beside them.
2. Have the client render typeset math from that response. Monaco remains the authoring
   surface — this is exactly the model the preview already uses, so it is *consistent with
   the current Calcpad editing* by construction.
3. Stop growing `math/calcpad.ts`. Freeze it; migrate its consumers to the server response.

**Effect:** the duplicate parser/printer stops being a correctness risk; coverage stops
depending on what the TS round-trip happens to support.

### Phase 2 — MathCAD-like presentation without a second engine
Render each equation region as **MathML** returned by the engine (native browser rendering,
styled to match the panel). Inline results and unit handling come from the same `/convert`
response the preview uses. This delivers the "see real math as you work" experience with no
new math code at all.

### Phase 3 — only if genuine 2D WYSIWYG entry is required
Add a math *widget* on top, and keep it strictly an input device:
- **Preferred:** MathLive, with **all LaTeX confined to one adapter module** (option B).
  The widget converts MathML/AST → LaTeX for display and LaTeX → Calcpad text on commit;
  the C# engine remains the only thing that parses or evaluates.
- **If LaTeX-free is a hard requirement:** a MathML-native editor is the only true answer, and
  it means either a commercial component (MathType/Wiris) or building a contenteditable MathML
  editor. Budget accordingly; there is no free drop-in.

### What not to do
- **Do not** implement the math engine a third time in the widget's language.
- **Do not** reach for Blazor WebAssembly as a first step: it costs a WASM runtime, a second
  UI framework and sandbox abstraction work, and still leaves the editor widget to solve.
- **Do not** adopt an OSS CAS: it adds a dialect that must be reconciled with Calcpad's.

### Decision triggers that would change this
- **Offline/in-browser C# becomes a hard requirement** → promote D (Blazor WASM), and accept
  the SkiaSharp/OpenXml payload cost; consider excluding `Plotter` from the WASM build.
- **The UI itself must be C#** → promote E or F.
- **The product becomes desktop-only** → promote F.
- **A commercial MathML editor licence is acceptable** → skip Phase 3's build cost entirely.

---

## 6. On "possibly based on C#"

The instinct is right, and the place to apply it is the **engine, not the editor widget**:

- Reusing `Calcpad.Core` for parsing, evaluation and rendering is exactly what removes the
  duplication that makes the current live editor fragile.
- But that reuse does **not** require Blazor or WASM. The engine is already reachable over a
  rich, versioned HTTP API (`/convert`, `/lint`, `/highlight`, `/definitions`,
  `/symbol-at-position`, `/prettify`, `/snippets`, `/pdf`, `/docx`) and every host already
  runs or connects to that server.
- C# cannot supply the missing piece — a 2D math input widget. Blazor has no math editor, and
  MathLive is JavaScript and LaTeX-bound. So "based on C#" fixes rendering and fidelity, and
  leaves editing exactly where it is today.
