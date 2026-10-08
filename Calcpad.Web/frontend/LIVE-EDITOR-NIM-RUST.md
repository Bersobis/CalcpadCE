# Live Editor in Nim or Rust? Feasibility, Trade-offs, and Recommendation

Short answer: **both are technically possible; Rust is clearly the better of the two, and
neither should replace the C# engine today.** The reason is that the live editor's bottleneck
is not the language — it is the math *editing widget*, which is JavaScript-only.

---

## 1. First, what is "this"?

The request is ambiguous in a way that changes the answer completely. Three different things
could be ported:

| Scope | What it is | Can Nim/Rust do it? |
|---|---|---|
| **S1 — the editing UI** | the canvas, toolbar, Monaco integration | Only via JS or WASM — the host is a browser/webview |
| **S2 — the math engine** | `Calcpad.Core` (parser, evaluator, units, matrices, plots) | Yes — this is a real, self-contained port target |
| **S3 — the backend/API** | `Calcpad.Server` (ASP.NET Core, `/convert`, `/docx`, `/pdf`, …) | Yes, but it is the least valuable to port |

S1 cannot be "written in Nim/Rust" in any direct sense: the web editor, the VS Code webview
and the Tauri desktop app are all Chromium/WebKit hosts. Nim and Rust reach them only by
compiling to **WebAssembly** (or, for Nim, to JavaScript). So the real question is S2/S3.

---

## 2. Hard constraints that apply to both languages

1. **Delivery target is WASM.** Rust: `wasm32-unknown-unknown` + `wasm-bindgen`/`wasm-pack`
   (first-class, and Vite has `vite-plugin-wasm`). Nim: primarily `nim js` (Nim → JavaScript),
   with WASM via Emscripten or a standalone `wasm32` target — supported, but considerably less
   trodden and less documented than Rust's path.
2. **The widget is not replaceable.** The 2D math editor is MathLive: JavaScript, LaTeX-native.
   There is no Rust or Nim equivalent (MathQuill is JS; MathType/Wiris is commercial JS).
   **Neither language removes it**, so neither language removes LaTeX from the editor.
3. **Performance is not the problem.** A full worksheet converts in milliseconds on a local
   server. The live editor's cost is DOM + MathLive rendering, not arithmetic. Rewriting the
   engine in a faster language optimises a non-bottleneck.
4. **The port target is large.** Measured from the repo (excluding `obj`/`bin`):

   | Project | Files | Lines |
   |---|---:|---:|
   | `Calcpad.Core` | 91 | 43,422 |
   | `Calcpad.Highlighter` | 86 | 22,653 |
   | `Calcpad.Web/backend` | 21 | 6,504 |
   | `Calcpad.OpenXml` | 11 | 2,459 |
   | `Calcpad.Cli` | 5 | 1,310 |
   | `Calcpad.Api` | 9 | 669 |
   | **Production total** | **223** | **~77,000** |
   | `Calcpad.Tests` | 115 | 54,831 |

5. **One thing makes a port tractable:** the repo already carries a **language-agnostic golden
   corpus** — `Tests/`, `Examples/` and `cli-build/` hold ~249 `.cpd` sources with ~231 `.stub`
   rendered outputs. A port can be validated against those without reading a line of C#.
   That is the single most important de-risking factor, and it applies equally to both languages.

---

## 3. Rust — feasibility

**Verdict: feasible, and the only one of the two with a genuinely good story.**

**Enablers**
- **WASM is a first-class target.** `wasm-bindgen` + `wasm-pack`, `web-sys`/`js-sys` for DOM
  interop, and Vite integration via `vite-plugin-wasm`. This is the most mature non-JS browser
  toolchain that exists.
- **The numeric/parsing ecosystem maps onto this problem well:** `nalgebra` (linear algebra),
  `num-complex`, `dashu`/`rug` (arbitrary precision), `pest`/`nom`/`chumsky`/`logos` (parsing),
  `plotters` (plots), `docx-rs` + `quick-xml` + `zip` (OOXML), `axum`/`actix-web` (API),
  `headless_chrome` (PDF).
- **Rust is already a project dependency.** `calcpad-desktop/src-tauri` is 1,604 lines of Rust
  with a committed `Cargo.toml`/`Cargo.lock`. Toolchain, CI wiring and some team familiarity
  already exist — a real, concrete advantage Nim does not have.
- **Incremental adoption is possible.** One WASM module behind a feature flag, or a Rust CLI
  validated against the `.cpd`/`.stub` corpus, before anything is replaced.

**Blockers / friction**
- `Calcpad.Core` depends on **SkiaSharp** (native graphics) and `System.IO.Packaging`, and via
  `Calcpad.OpenXml` also **DocumentFormat.OpenXml** + `HtmlAgilityPack`. Each has a Rust
  counterpart, but the *output must match byte-for-byte* if the `.stub` corpus is the oracle —
  that is the real cost, not the arithmetic.
- `Plotter`, `PathRoots`, `DataExchange` are IO/filesystem-bound and need re-architecting.
- PDF currently goes through Chromium (PuppeteerSharp) + PDFsharp; a Rust stack would differ.
- Still a ~77k LOC port with no incremental user-visible value.

---

## 4. Nim — feasibility

**Verdict: technically possible, but materially weaker on every axis that matters here.**

**Enablers**
- Nim compiles to C/C++/JS, and to WASM via Emscripten or a standalone `wasm32` target.
- `nim js` is a practical path for browser code, and Nim's C interop is excellent.
- Genuine strengths: very readable syntax, fast compile times, small binaries, easy FFI.

**Blockers**
- **Browser/WASM maturity.** The WASM target is far less travelled than Rust's; JS interop
  ergonomics are weaker and the toolchain is more fragile. For a project that must run in three
  different webview hosts, this is the single biggest risk.
- **Thin ecosystem for exactly this domain.** There is no Nim equivalent of `nalgebra`,
  `plotters`, or `docx-rs`. `arraymancer` (tensors) has slowed; plotting is wrapper-level
  (`nim-plotly`, `ggplotnim`). OOXML/Word and PDF have essentially nothing.
- **No existing footprint.** No Nim anywhere in the repo, no Nimble setup, no CI, no team
  familiarity — so it is a greenfield toolchain added purely for this.
- **Small talent pool**, which raises the long-term maintenance risk on a 77k-line port.
- Nim's advantages (compile speed, syntax, binary size) are **not** the binding constraints for
  a server-side math engine or a browser widget.

---

## 5. Trade-off comparison

Scores 1–5, relative to this project's constraints.

| Criterion | Rust | Nim |
|---|:--:|:--:|
| Browser / WASM maturity | **5** | 2 |
| Numeric + units ecosystem | **5** | 2 |
| Parsing / grammar ecosystem | **5** | 3 |
| Plotting | **4** | 2 |
| OOXML / Word export | **3** | 1 |
| PDF pipeline | **3** | 1 |
| Web / API framework maturity | **5** | 3 |
| Toolchain already in the repo | **4** | 1 |
| Talent pool / hiring | **5** | 2 |
| Incremental migration path | **4** | 2 |
| Compile-time / iteration speed | 2 | **5** |
| Runtime performance | 5 | 5 |
| Memory safety | 5 | 3 |
| Binary size | 4 | **5** |

Nim wins only on compile speed, binary size and syntax. None of those are constraints for this
feature; every axis that *is* a constraint favours Rust.

---

## 6. The decisive argument: this is probably the wrong question

Even a perfect Rust or Nim engine would leave the live editor's two real problems untouched:

1. **The editor widget is JS and always will be.** MathLive is the only practical 2D math
   editor available, it is LaTeX-native, and neither Rust nor Nim can replace it. So neither
   language removes LaTeX from the editor, and neither delivers the MathCAD-like 2D entry.
2. **Performance is not why the live editor is hard.** The current design is slow and fragile
   because it *duplicates* the engine in TypeScript — not because TypeScript is slow. A Rust
   engine would still be duplicated unless you also delete `math/calcpad.ts` and route through
   it.

**Where Rust genuinely earns its place:** a **narrow WASM math core** — compile the parser and
evaluator to `wasm32`, validate against the `.cpd`/`.stub` corpus, and use it client-side. That
kills *both* the TypeScript duplication *and* the per-edit server round-trip in one artifact,
and it is dramatically more practical than the Blazor-WASM variant considered earlier (no
SkiaSharp, no OpenXML, no second UI framework, a fraction of the payload). That is a real,
bounded win.

**Nim has no comparable sweet spot.** It offers no advantage over C# for the engine and no
advantage over Rust for WASM, so it would add a third language to the project for no structural
gain.

**If "this" means a native desktop app** (egui/iced in Rust; niGUI/nimx in Nim), both are
viable, and Rust's GUI ecosystem is stronger. But it abandons the web and VS Code hosts, and
you would still have to build the 2D math editor from scratch — the exact problem MathLive
exists to solve.

---

## 7. Recommendation

1. **Do not port the engine.** Keep `Calcpad.Core` as the single source of truth. It is ~43k
   lines backed by ~55k lines of tests, and the live editor's problems are duplication and the
   widget — neither of which a language change fixes.
2. **Fix the real problems first** (as set out in `LIVE-EDITOR-APPROACHES.md`): route the
   client through the engine for rendering, and stop growing `math/calcpad.ts`.
3. **If a non-.NET language is a hard requirement, choose Rust — not Nim.** Rationale: mature
   WASM, an ecosystem that actually covers numerics/parsing/plotting/OOXML, a toolchain already
   present via Tauri, a large talent pool, and an incremental adoption path.
4. **Scope Rust narrowly if you do adopt it:** a WASM parser/evaluator for the client, validated
   against `Tests/**/*.cdp` + `*.stub`, shipped behind a feature flag. Not a backend rewrite.
5. **Choose Nim only if** the motivation is team preference for the language itself and the
   scope is a greenfield tool — not this codebase. It has no technical edge here.

**Decision triggers**
- Offline in-browser evaluation becomes a hard requirement → a **Rust WASM core** is the best
  answer (preferable to Blazor WASM).
- A full de-.NET migration is mandated by policy → Rust, ported incrementally behind the golden
  corpus, starting with the parser.
- The product becomes desktop-only → Rust native (egui/iced/Tauri), accepting the loss of the
  web and VS Code hosts.
