# The CalcpadCE Canvas — WYSIWYG Equation Editor

> **Status: partially implemented.** Phase 0 (parser, LaTeX/OMML bridges, corpus
> harness), Phase 1 (the field mounted in the app) and the Phase 2/3 **live editor**
> have landed; the in-editor overlay, Tauri parity and the free-positioned canvas are
> still design. It is written to the same shape as the other `docs/new-*.md` pages so
> the remaining work can be reviewed as a feature brief before any more code lands.

A MathCAD-like view where the worksheet is the interface: equations are edited *in place*
where they are drawn, results sit beside them, and nothing is hidden behind a source-code
pane. It ships as an **add-on** to the existing apps — the same Tauri shell, the same
`calcpad-frontend` library, the same `Calcpad.Server` backend — not a fourth application.

---

## 1. The one decision that shapes everything else

**The `.cpd` text document stays the single source of truth. The canvas is a view over it.**

Every alternative was considered and rejected for concrete reasons:

| Option | Verdict |
| --- | --- |
| New binary/JSON graphical document format | Rejected. Breaks `.cpdz` compiled worksheets, `fileAssociations`, `#include`, the linter, the DOCX/PDF/HTML exports, and every existing `.cpd` in the wild. It also forks the product away from its own differentiating feature — readable text scripts. |
| Canvas edits a shadow copy, flushed to text on save | Rejected. Two representations drift. The user would find edits that appear in the canvas and not in the text editor, which is the exact class of bug that destroys trust in a calculator. |
| **Canvas reads and writes the text document directly** | **Adopted.** Every existing subsystem keeps working untouched. |

The consequence is that the hard problem is not "draw math on a canvas" — libraries do that
well. The hard problem is **lossless round-tripping** between Calcpad's text syntax and a
visual AST, including the parts that have no visual form: `#format`, `#hide`, `#for`,
`#UI`, `$Plot{…}`, macros, comments. The plan below is weighted accordingly.

### What "in place" means here

A Calcpad document is a sequence of lines. The canvas renders each line as a *region*:

| Source construct | Region | Editable |
| --- | --- | --- |
| `x = 5`, `A = 0.01m^2`, `V = s_1/t_1\|km/h` | Equation region | Yes — becomes a math field |
| `'Comment text` / `"Title"` | Text region | Yes — inline text |
| `#format`, `#deg`, `#hide` | Directive chip | No — shown, opens the panel to change |
| `$Plot{…}`, `$Map{…}` | Plot region | No — re-rendered from the engine |
| `#for i = 1:10` … `#endfor` | Loop group | Header partially, via a small form |
| `#UI x = "…"` | Input control | Rendered as the engine's control |

A region that cannot be represented visually shows its raw text in a neutral monospace style
rather than being hidden. Silent loss is the one unforgivable failure mode.

---

## 2. What already exists (reuse map)

Mapped against the current tree — this feature is mostly assembly, not invention.

| Need | Existing asset | Path |
| --- | --- | --- |
| Rendering + calculation | `POST /api/calcpad/convert` → HTML, `X-Calcpad-Errors` | `Calcpad.Web/backend/Controllers/CalcpadController.cs` |
| Per-line anchors for in-preview navigation | `includeLineAnchors` + `id="eq-{N}"` per equation | `Calcpad.Core/Parsers/ExpressionParser/ExpressionParser.cs:667` |
| Equation ↔ source mapping | `OpenXmlExpressions` list, index-parallel with `eq-{N}` | same |
| OMML for Word export | `<m:oMath>` wrapper + `m:`/`w:` namespaces | `Calcpad.OpenXml/OpenXmlWriter.cs:488` |
| OMML element dialect (authoritative) | `XmlWriter` — `m:f`, `m:rad`, `m:sSup`, `m:sSub`, `m:d`, `m:r`, `m:nor` | `Calcpad.Core/Output/XmlWriter.cs` |
| Unit runs / `m:sty m:val="p"` styling | `FormatUnitsStatic`, `Unit.Xml` | `Calcpad.Core/BaseTypes/Unit.cs:141` |
| Shared UI + logic library | `calcpad-frontend` (built first, consumed by all three hosts) | `Calcpad.Web/frontend/calcpad-frontend/` |
| Vue 3 host app | `calcpad-web` (Monaco + Vue sidebar) | `Calcpad.Web/frontend/calcpad-web/` |
| Tauri shell, menus, windows, drafts | `calcpad-desktop` (`lib.rs`, `tauri.conf.json`) | `Calcpad.Web/frontend/calcpad-desktop/` |
| Lint / highlight / definitions | `POST /lint`, `/highlight`, `/definitions` | backend |
| Symbol + snippet palette | `CalcpadInsertTab.vue`, `CalcpadVariablesTab.vue` | `calcpad-frontend/src/vue/components/` |

**Net effect: the backend needs no changes at all in the first four phases.** The canvas
consumes `POST /convert` exactly as the preview pane already does.

### Starting point already on disk

`calcpad-frontend/src/math/` now holds a working prototype: `calcpad.ts` (tokenizer,
recursive-descent parser and printer), `mathjson.ts` (the AST node types), `latex.ts`
(the LaTeX bridge), `roundTrip.ts` (the corpus harness), `omml.ts` and `xml.ts`.
`tests/` covers the converters, and `tests/corpus.roundtrip.test.ts` measures fidelity
against the real `Examples/` tree. See [§7](#7-phased-delivery) for the measured results.

> **Correction to the original design.** This document first proposed MathJSON as the
> interchange with MathLive. Measuring against the shipped package disproved that: see
> [§3](#3-research-what-to-build-on). The interchange is **LaTeX**.

---

## 3. Research: what to build on

Evaluated against the constraint that **this is an offline-first Tauri app** — no hosted
rendering, no network calls, nothing that fails when the laptop is on a plane.

| Option | Fit | Verdict |
| --- | --- | --- |
| **[MathLive](https://mathlive.io) (`mathlive`, MIT)** | `<math-field>` web component with a virtual keyboard, LaTeX/MathML/ASCIIMath/**MathJSON** in and out, `math-live/ssr` for headless conversion in Node, `<math-span>`/`<math-div>` for static render, a11y and screen-reader support built in | **Adopted.** MIT, same licence as the repo. It is the only mature option that is a *field editor* (click, type, navigate) rather than a LaTeX renderer — which is exactly the MathCAD interaction model. |
| [MathQuill](https://github.com/mathquill/mathquill) | LaTeX-first, narrower, effectively unmaintained | Rejected. |
| KaTeX / MathJax | Renderers, not editors | Rejected for input; a candidate for read-only preview. |
| [Typora-style click-to-edit](https://typora.io) | Renders math, swaps in an editor on click | **Adopted as the interaction pattern** — see §5. |
| [SMath Studio](https://smath.com/) | Closest open MathCAD clone | **Adopted as the document model reference** (text/equation regions on a flowing page), not as code. Closed source. |
| Hand-rolled canvas (Konva/Fabric/tldraw) | Free-form node canvas | Rejected for v1. Calcpad is *line-oriented*; free placement would break the text round-trip that is the whole premise. Revisit only if users want MathCAD's genuinely free-positioned plots. |
| Compute Engine (`@cortex-js/compute-engine`) | Symbolic evaluation of MathJSON | Deferred. Calcpad already has a better engine in C#. Useful later for client-side live previews. |

A search of the developer-service catalog returned **no suitable hosted service** for equation
editing, which confirms the local-library choice: MathLive runs entirely in the webview.

### MathJSON and ASCIIMath were both measured and rejected

The first draft of this plan used MathJSON as the interchange. Probing the shipped
package (MathLive 0.111.0) showed neither of the two alternatives works:

| Proposal | What the package actually does |
| --- | --- |
| `getValue('math-json')` | `OutputFormat` in 0.111 is `'ascii-math' \| 'latex' \| 'latex-expanded' \| 'latex-unstyled' \| 'latex-without-placeholders' \| 'typst' \| 'math-ml' \| 'plain-text' \| 'spoken' \| …` — **there is no `math-json`**. MathJSON survives only as an *input* format for `<math-div format="math-json">`, with no exported converter. |
| ASCIIMath for units | `convertAsciiMathToLatex('text(kN/m^2)')` returns `text\left(kN/m^{2}\right)` — a variable named `text` followed by a group. Not upright text. |
| ASCIIMath for roots | `convertAsciiMathToLatex('root(x,3)')` returns `root\left(x,3\right)` — a variable named `root`. No `\sqrt[3]`. |

Both ASCIIMath failures degrade into a mis-rendered variable *of the same name*, which is
the worst kind of bug: it looks plausible and is silently wrong.

LaTeX handles both correctly, and it is MathLive's native format:

| Input | MathLive's MathML |
| --- | --- |
| `\text{kN/m^2}` | `<mtext>kN/m^2</mtext>` — upright, literal |
| `\sqrt[3]{x}` | `<mroot><mi>x</mi><mn>3</mn></mroot>` |

**LaTeX is the interchange.** `mathlive/ssr` exposes `validateLatex` and
`convertLatexToMathMl`, so the whole path is verifiable outside a browser — which is what
makes the corpus harness possible.

### Integrating MathLive with Vue 3 + Vite

```ts
// vite.config.ts — tell Vue these are custom elements, not components
vue({ template: { compilerOptions: { isCustomElement: (t) => t.startsWith('math-') } } })
```

```ts
// main.ts — register once, then `<math-field>` works in any SFC
import 'mathlive';
```

Third-party wrappers exist ([vue-mathlive](https://github.com/arnog/vue-mathlive)) but are
stale and thin, and MathLive's own `mathlive/vue` export is a **Vue 2 shim** — it tests
`vue.version` major at install time and exposes only a `value: String` prop (LaTeX) with
no event forwarding and no way to read back anything but a string. A local wrapper in
`calcpad-frontend` is cheaper to own and can bridge Calcpad source in both directions.

**Packaging notes for Tauri.** MathLive ships its own fonts; they must land in the bundle
(`vite build` emits them alongside the CSS, and the existing `bundle.resources` already
maps `Fonts/**`). MathLive's CDN loader must be bypassed — import the npm entry point so
nothing reaches for the network. The CSP in `tauri.conf.json` already permits `'self'`
scripts and fonts, so no CSP change is needed.

---

## 4. Architecture

```
calcpad-web/src/canvas/                 ← new host-side view
├── CanvasView.vue                      routes: <editor> ⇄ <canvas>
├── CanvasPane.vue                      the flowing worksheet surface
├── EquationRegion.vue                  one editable line  ← wraps <math-field>
├── TextRegion.vue                      comment lines
├── DirectiveRegion.vue                 #format / #hide chips
├── PlotRegion.vue                      engine-rendered SVG/canvas
├── LoopGroup.vue                       #for … #endfor collapse/expand
└── region-model.ts                     lines ⇄ regions ⇄ MathJSON

calcpad-frontend/src/math/              ← shared, host-agnostic
├── calcpadParser.ts                    Calcpad text  → AST   (lossless, line-aware)
├── mathjson.ts                         Shorthand MathJSON types
├── calcpadOmmlTranspiler.ts            the 4 public converters
├── omml.ts                             MathJSON ⇄ OMML
└── mathml.ts                           MathML  → OMML
```

`calcpad-frontend` is the right home: the canvas needs the same parser in the VS Code
extension and the desktop app, and that library is already built first and consumed by all
three.

### Data flow

```
        ┌──────────────── edit an equation ────────────────┐
        │                                                   │
   .cpd text ──▶ CalcpadParser ──▶ MathJSON ──▶ MathLive ──┘
        ▲              │                        │
        │              ▼                        ▼
        │          OMML                     rendered math
        │              │
        └──── docx/pdf export          POST /convert ──▶ results
               (unchanged path)
```

Results come from the **existing** `POST /convert` call, debounced, rendered into the same
region that owns the equation. There is no second calculation engine and no client-side
evaluator to disagree with the server.

---

## 5. Interaction design

Modelled on Typora's click-to-edit, which is the proven version of this interaction:

1. **Read mode.** The canvas shows typeset equations and results. No cursor anywhere.
2. **Click an equation.** Only that region swaps to an editable `<math-field>`. Everything
   else stays typeset. The mathfield autofocuses with the caret where the user clicked.
3. **Type.** MathLive's virtual keyboard is available (essential on tablets; optional on
   desktop). Live validation runs through the existing `POST /lint`.
4. **Commit** — blur, `Esc`, or clicking away. The region is re-rendered read-only, and a
   debounced `POST /convert` refreshes the results.
5. **Revert** — `Esc` restores the pre-edit text exactly.

Additional rules:

* **The mathfield is transparent about its text.** A "source" toggle on the focused region
  shows the Calcpad text it will write. Users who know Calcpad syntax can check the
  round-trip, and anyone confused by a bad conversion can see the cause.
* **Non-representable syntax is never silently dropped.** Anything the visual AST cannot
  carry is preserved verbatim in a hidden span and restored on write-back (see §6).
* **Undo/redo** is per-region and transactional — one undo step per committed edit, not per
  keystroke, matching how a document editor feels.

---

## 6. The round-trip problem, and how it is solved

This is the core engineering risk and gets the most attention.

### 6.1 Lossless parsing

The parser must not assume every line is an equation. `CalcpadParser` produces a
**line-aware** tree where each line is one of `equation | text | directive | block | blank`,
and any line whose parse is not provably equivalent is marked `lossy` with the original text
retained. Write-back then emits `ast → text` only for non-lossy lines and splices the
original text for the rest. A lossy round-trip is a bug, not a degradation.

### 6.2 Construct-by-construct mapping

| Calcpad | AST node | LaTeX | OMML | Notes |
| --- | --- | --- | --- | --- |
| `a/b` | `Operator /` | `\frac{a}{b}` | `<m:f><m:num/><m:den/>` | |
| `root(x; n)` | `Root` | `\sqrt[n]{x}` | `<m:rad><m:deg>` | |
| `sqrt(x)` | `Sqrt` | `\sqrt{x}` | `<m:rad><m:radPr><m:degHide m:val="1"/>` | matches `XmlWriter.FormatRoot` |
| `x^2` | `Sup` | `x^{2}` | `<m:sSup>` | |
| `x_1` | `Sub` | `x_{1}` | `<m:sSub>` | |
| `(x)` | `Group` | `(x)` | `<m:d>` + `begChr`/`endChr` | |
| `10\|kN/m^2` | `Operator \|` with `Units` | `10\quad\text{kN/m^2}` | run with `<m:rPr><m:sty m:val="p"/>` | **unit tracking** |
| `50m` | implicit `*` with `Text` unit | `50\text{m}` | run with `<m:sty m:val="p"/>` | |
| `[1; 2; 3]` | `Delimited` | `[1, 2, 3]` | `<m:d>` + `<m:m>` | matches `XmlWriter.FormatVector` |
| `[1; 2\|3; 4]` | `Matrix` | `\begin{bmatrix}1 & 2\\3 & 4\end{bmatrix}` | `<m:d>` + `<m:m>` | `\|` is `RowDivisor` inside brackets only |
| `sin(x)` | `Function` | `\mathrm{sin}(x)` | `<m:r>` + `<m:d>` | |
| `2x` | implicit `*` | `2x` | runs | Calcpad's implicit multiplication, preserved verbatim |
| `x = 1; y = 2` | `Statements` | `x = 1\qquad y = 2` | runs | multi-statement line |

`\quad` is the trick that makes the unit target survive: TeX treats it as ordinary
spacing, so it renders exactly like the juxtaposition it replaces, while the reader can
tell `10|kN` (a conversion target) from `50m` (an attached unit) and restore the `|`.

### 6.3 Units — the subtle case

`10|kN/m^2` is a *unit conversion target*, not multiplication. Two things must hold:

* Visually, the unit part renders upright, not italic — Calcpad's own convention.
* Textually, the `|` survives the round-trip, or the user loses the target units.

So the unit is modelled as a distinct `Units` wrapper, emitted as
`<m:r><m:rPr><m:sty m:val="p"/></m:rPr><w:rPr>…Cambria Math…</w:rPr><m:t>kN</m:t></m:r>`
with `∕` (`U+2215`) between terms — byte-for-byte the shape `XmlWriter.FormatUnitsStatic`
and `UnitDivision` already produce, so canvas-authored equations and engine-rendered ones
are indistinguishable in the exported `.docx`.

### 6.4 Formatting directives

`#format`, `#hide`, `#deg` affect *presentation*, not the AST. In the canvas they are
region-level chrome, not equation content. This keeps the AST clean and means
`mathJsonToCalcpad` never has to invent directive syntax.

---

## 6.5 OMML compatibility

**Calcpad does not use LaTeX, and that matters more than it looks.**

Two separate things are easy to confuse:

1. **The export path never touches the frontend.** `POST /api/calcpad/docx` runs
   `Calcpad.Core/Output/XmlWriter.cs` over the *Calcpad source text* and embeds the
   result in `<m:oMath>`. Whatever the canvas holds — LaTeX, MathJSON, an AST — is
   irrelevant to the `.docx`, because the canvas writes Calcpad text back and the engine
   re-renders from scratch. **LaTeX is an editing surface only.** It must never become a
   stored representation.
2. **The frontend's own OMML emitter is a second dialect**, used when the canvas emits
   math directly or reads an imported `.docx`. That one *must* match `XmlWriter.cs`, or a
   single document ends up with two different unit styles.

`tests/ommlCompat.test.ts` pins the second case to the C# templates. It caught four real
defects that no amount of shape-inspection had — six in the writer, two in the reader:

| Defect | Effect |
| --- | --- |
| `m:val` attributes serialized as `[object Object]` | Every `degHide` / `begChr` / `endChr` malformed — the OMML was invalid |
| `kN/m^2` emitted as `<m:f>` | A unit typeset as a stacked fraction, i.e. a different quantity |
| `<m:sty m:val="p"/>` instead of `<m:nor/>` | Two unit styles in one document |
| Implicit `2x` gaining a ` * ` run | An asterisk the author never wrote |
| Function arguments joined with **nothing** | `stress(P; A)` exported as `stress(PA)` — a different call |
| Statements joined with two spaces | `x = 1; y = 2` exported with the separator lost |
| Explicit `*` written as ` * ` instead of `·` | A different glyph from every other multiplication Calcpad writes |
| `<m:f>` operands bracketed unconditionally on read | `a/b → (a)/(b) → ((a))/((b))` — one bracket per round-trip, forever |

The last one is why the reader is tested by **exact string**, not by "looks non-empty". A
fraction in the source may or may not have been bracketed; OMML records neither, so the
reader must add brackets to rebuild the precedence — and must then recognise the bracketed
case it just produced, or the brackets accumulate. An operand that already renders as a
single `<m:d>` with round brackets is left alone.

The reader also restores the two characters Calcpad uses for display rather than source:

| In the document | In Calcpad source | C# origin |
| --- | --- | --- |
| `∕` (upright run) | `/` | `UnitDivision` |
| `·` (upright run) | `*` | `UnitProduct`, `FormatOperator('*')` |

Without that, `10|kN/m^2` round-tripped to `10|kN∕m^2`, which is not Calcpad.

On the `m:sty` vs `m:nor` question: both are valid OMML for upright text, and Word itself
writes `m:sty m:val="p"`. The default is now **`m:nor`**, because that is what
`XmlWriter.NormalText` emits, so canvas-authored and engine-rendered equations are
indistinguishable. `setUnitStyle('sty-p')` switches to the Word spelling for callers that
want it.

Verified element-for-element against `XmlWriter.cs`. Two sizes appear deliberately:
`FormatUnitsStatic` sets `w:sz 22` for a unit run, while `UnitDivision` sets `w:sz 20` for
the `∕` between them.

| Calcpad | Emitted | C# origin |
| --- | --- | --- |
| `a/b` | `<m:f><m:num/><m:den/>` | `FormatDivision` |
| `sqrt(x)` | `<m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/><m:e/>` | `FormatRoot("2")` |
| `root(x; 3)` | `<m:rad><m:deg>3</m:deg><m:e/>` | `FormatRoot("3")` |
| `x^2` / `x_1` | `<m:sSup>` / `<m:sSub>` | `FormatPower` / `FormatSubscript` |
| `(x)` | `<m:d><m:dPr><m:begChr/><m:endChr/></m:dPr>` | `Brackets` |
| `10\|kN/m^2` | `10` + ` \| ` + styled `kN` + styled `∕` + `<m:sSup>` | `FormatOperator('\|')`, `UnitDivision` |
| `a*b` | `a` + `<m:r><m:t>·</m:t></m:r>` + `b` | `opRuns[4]` |
| `stress(P; A)` | `stress` + `(P` + `<m:r><m:t>;</m:t></m:r>` + `A)` | `div` in `MathParser.Output.cs` |
| `-x` | upright, unspaced `<m:t>-</m:t>` | `opRuns[12]` |
| `sqrt` as a name | upright Cambria Math, `<w:b w:val="true"/>` | `FormatFunction` |

### Reading OMML back is not the inverse of writing it

Worth stating plainly, because it is the one place where "round-trip" needs a caveat.
Reading `<m:f>` yields `(a)/(b)`, not `a/b` — brackets are required for the parser to
recover the precedence the fraction encoded. Everything else re-reads to the AST it was
written from. The suite therefore asserts three separate properties:

1. **Exact strings** per construct, so any drift shows up in the diff.
2. **AST equality** for the constructs OMML records one-for-one (`50m`, `10|kN/m^2`,
   `x = 5`, `a*b`, `stress(P; A)`, `sqrt(x)`, `root(x; 3)`).
3. **Fixed point** for everything, including fractions: a second pass must not change the
   text. That is what catches the bracket accumulation above.

### What this does *not* cover

`.docx` import is the untested half of the reader. `OpenXmlWriter.cs` wraps equations in
`<m:oMath xmlns:m=… xmlns:w=…>` inside `w:p` runs, and a real document also carries
`m:oMathPara`, `m:nary` for `∑`/`∏`, `m:acc` for the vector combining arrow, `m:m` for
matrices, and `w:br`/`w:tab`. `childrenToCalcpad` skips unknown elements rather than
failing, so an unhandled construct degrades to silently missing output instead of an error.
Importing a real `.docx` needs either an explicit unsupported-element report or a fallback
to the existing HTML path.

One deliberate divergence: `XmlWriter.cs` embeds newlines and indentation inside its
interpolated templates. Whitespace between structural OMML elements is not significant, and
collapsing it avoids stray text nodes, so the tests normalise it away.

---

## 7. Phased delivery

Each phase lands behind a feature flag and is independently useful.

### Phase 0 — Foundation *(prototyped)*
- ✅ Tokenizer, recursive-descent parser and printer for the Calcpad grammar
  (`calcpad.ts`).
- ✅ LaTeX bridge in both directions (`latex.ts`), replacing the rejected MathJSON and
  ASCIIMath designs.
- ✅ Vitest suite (145 tests) covering the converters, the unit/variable disambiguation,
  the OMML generation and parsing paths, and the Vue wrapper's compiled structure.
- ✅ Corpus harness over the **249 `.cpd` files / 6794 equation lines** in `Examples/`.
- ✅ `CalcpadMathField.vue`, the Vue 3 wrapper, verified with `vue-tsc`.
- ✅ Vitest wired into `calcpad-frontend` (`npm run test`).

**Measured fidelity on the real corpus:**

| Property | Result |
| --- | --- |
| `calcpad → AST → calcpad` reproduces the line | **96.3%** (6541/6794) |
| AST survives re-parsing | **99.9%** (6786/6794) |
| Emitted LaTeX is accepted by MathLive | **99.7%** (6774/6794) |

The `|` matrix row separator is **solved** (see below). What remains is one construct, a
case where one character means two things and the disambiguation needs the *value* of the
left operand, not just its tokens:

| Construct | Lines | Why it is hard |
| --- | --- | --- |
| Comma-separated subscript `B_0,0` | ~140 | Calcpad's tokenizer gives `,` the type `Unit`, so it belongs to the subscript literal — but the same `,` separates statements in `x = 1, y = 2`. Collecting it greedily made things *worse* (96.2% → 92.9%), so it is left alone. |

### The `|` ambiguity is not real

The original note here claimed `|` inside `[…]` could not be told from the unit target
in `x\|MPa`. That is wrong, and the engine settles it: `MathParser.Input.cs` gives the
divider its own token type, `TokenTypes.RowDivisor`, produced *only* between
`SquareBracketLeft` and `SquareBracketRight`. Inside brackets `|` is always a row
divider; outside them it is always the unit target. There is no overlap to resolve.

`[a; b|c; d]` is therefore a first-class `Matrix` node, printed back with `|` between
rows and `;` between cells, and emitted as `\begin{bmatrix}…\\…&…\end{bmatrix}` —
the environment MathLive treats as an editable grid, where `&` and `\\` move between
cells and rows. A single-row `[a; b]` stays a `Delimited` vector. Measured: the ~40
matrix lines round-trip exactly, and the engine agrees — `M_TEST=[9; 4; 5|5; 6; 7]`
renders as a 2×3 matrix.

Two beliefs about this residue turned out to be wrong, and measuring replaced both:

- **`=>` is not Calcpad syntax.** The engine's assignment operator is `=` or `←`
  (`MathParser.Input.cs:322`); there is no `=>` anywhere in `Calcpad.Core`. All three
  corpus occurrences are English prose *inside* a quoted label —
  `k_2(n)' => 'A_1(m; n)`. Parsing `=>` as an operator would have corrupted exactly the
  lines the quoted-literal fix repaired.
- **SVG drawing calls never reach the parser.** `splitWorksheet` already routes 262 of
  them to `other`, so they contribute zero corpus drift.

The large win was recognising Calcpad's **quoted literals**. `'` and `"` delimit a text
literal, not a comment — `ExpressionParser.GetTokens` emits `TokenTypes.Text` for the span,
and `1' - for |Mx|` is the user-entered value `1` with a description. Treating them as an
unknown character parsed the label as mathematics, which accounted for roughly two thirds
of all drift (753 → 353 lines).

**Exit criteria for this phase — met.** The remaining work is raising the two lower
numbers, not proving the approach.

### Phase 1 — Inline math editing *(landed in the sidebar; in-editor overlay still open)*
- ✅ Add `mathlive` to `calcpad-web`; ✅ `isCustomElement` in `vite.config.ts`;
  ✅ `CalcpadMathField.vue` binds Calcpad source ⇄ a `<math-field>` in both directions.
- ✅ Mount the field: the sidebar's **Live editor** tab typesets the line under the cursor
  and writes a committed edit back to that line (`CalcpadEquationTab.vue`, with
  `getEquationContext` / `applyEquation` on the bridge). It is on web and desktop, and
  reachable from the editor as **Open Live Editor** (Ctrl+Alt+E). Deliberately
  gated out of the VS Code webview, which does not bundle MathLive — an unregistered
  `<math-field>` there would render as an empty box.
- ✅ Re-run `POST /convert` on commit and refresh the preview: the write-back is an
  ordinary model edit, so the existing debounced preview refresh already covers it.

**Exit — met, and verified in a browser rather than inferred from a build.** Click a
line, edit it in the field, blur: the `.cpd` line and the rendered result both change
(`a = 3` → `a = 5`), and the tab shows the source it wrote. Two guards make that safe:

* A line is only editable when its round-trip reproduces it — `classifyLineEdit` in
  `src/math/roundTrip.ts`, which reuses the corpus harness's own definition of "stable".
  Measured over `Examples/`: 96.2% editable, 16.8% never presented as maths (comments,
  directives, drawing calls). The rest are shown as source with a note, not rewritten.
* A commit that does not change what the line *means* is dropped. Printing canonicalises
  whitespace, so comparing text would have rewritten `A = 1` to `A=1` on a click with no
  edit — `CalcpadMathField.sameMeaning` compares the parse instead.

What is still open is the in-editor overlay this section originally described: a math
field replacing the line inside Monaco, cursor-following between the two, and per-region
undo.

### Phase 2/3 — The live editor *(landed, in the sidebar)*

`CalcpadLiveEditor.vue` renders the **whole document** as typeset maths. The tab is named
**Live editor**; a **Whole document** checkbox at the top switches between the single line
under the cursor and the full worksheet. With it on, every equation in the document is a
field you can click and edit where it stands.

The canvas is a *view* over the document, not a second copy of it:

- The region model is `splitWorksheet` plus `classifyLineEdit`. Equation lines become
  fields; comments, directives and drawing calls pass through as verbatim `<pre>`.
  Consecutive non-equation lines collapse into one block, so a run of comments reads as
  the paragraph the author wrote.
- **Every region keeps the Phase 1 gate.** A `lossy` line renders as source and is
  never rewritten, in the live canvas exactly as in the single-line tab. Measured on a
  test document: `M=[1;2|3;4]` and `x=5|MPa` became fields, while
  `B_0,1.(3; j) = B_3(j; 1; 1)` and `c = b - a|μm:N1` stayed as source.
- Writes go back one line at a time over the existing `applyEquation` path, so indent is
  preserved and the write is confirmed by the document echo — the same confirmation the
  single-line tab uses. Editing a matrix cell rewrote `M_TEST=[3;4;5|5;6;7]` to
  `M_TEST=[9; 4; 5|5; 6; 7]` in the editor.
- The bridge keeps the canvas in step: `setLiveEditor` / `getLiveContext` /
  `refreshLiveContext` push the document on cursor moves and edits, but only while the
  canvas is on screen, so nothing is sent for a panel nobody is looking at.

**Exit — met.** The whole worksheet previews as live maths, and an edit anywhere in it
lands in the document. Still open from these phases: results rendered per-region from
`POST /convert` beside each equation (the canvas shows the typeset input only),
per-region undo, and moving the surface out of the sidebar into the editor pane.

### The gate has to test the path a commit actually takes

The per-line gate originally validated the cheap round-trip `calcpad → AST → calcpad`.
A commit takes a different route — `calcpad → AST → **LaTeX** → calcpad`, because the
value written back is whatever MathLive produced. Two constructs passed the cheap gate
and corrupted the document on commit:

| Construct | Before | After commit |
|---|---|---|
| Greek letters | `δ = 0.5` | `0 = 0.5` — the symbol collapsed to the *number* zero |
| Labels | `M_a = M/l*a'kN·m` | `… * a kN·m` — the label silently became attached units |

Root causes were both in the LaTeX reader: its identifier rule was `[A-Za-z]`, so a
Unicode letter was skipped and parsed as `0`; and a label was emitted as a bare
`\text{}`, indistinguishable from a unit run. Three further gaps surfaced from the same
audit and are now fixed:

- **Greek macros.** MathLive emits `\sigma` the moment a user *types* `σ`, which arrived
  as a variable named `sigma` — editing any Greek equation silently renamed every symbol
  in it. `GREEK_MACROS` maps the 38 macros back to Unicode letters.
- **Unterminated literals.** The reader assumed every label was closed, so `A_s = 84'`
  came back as `84''` — an *escaped quote* to Calcpad, a different literal. A closed
  literal now carries its closing quote inside the group, doubled so it cannot be confused
  with a quote that belongs to the text.

`classifyLineEdit` now requires `commitStable` alongside `textStable` and `astStable`,
so a line that only survives the cheap path is marked `lossy` and rendered as source.

**Measured over all 249 examples (6794 equation lines).** Every line the gate admits was
committed at once and the document re-run through the engine, compared against the
unmodified baseline:

| | Files | Syntax errors introduced |
|---|---|---|
| Commit path (all editable lines) | 208 | **0** |
| Commit + matrix resize | 42 | 4 |

The four are **not** corruption — each is a matrix resize that changes a value the file
depends on, and each reproduces *exactly* when the same text is typed by hand: resizing
`n_T` in `Free Vibrations of Steel Pole Animated.cpd` feeds `#for k = 0 : n_T.i`, and
resizing `n` in `Polygon.cpd` feeds `#for i1 = 1 : n`. A user pressing `+Row` on a plot's
data vector gets the same result as typing it; the editor is not inventing the breakage.
Two of the largest files (`Special Math Functions`, `Soil Stress and Deformations`) exceed
30s per engine run and were checked separately: 0 gained errors on either.

### Language coverage — audited against `docs/quick-reference.md`

The construct list was rebuilt **from the documentation**, not from the code, so a gap
shows up as a gap rather than as whatever the parser happened to accept. It is pinned in
`tests/languageCoverage.test.ts` — 79 constructs, of which **22** are editable fields and 57
are deliberately source-only.

The audit found that several constructs Calcpad documents as *operators* were never
implemented as such, so the tokenizer read them as variable names:

| Construct | Was | Now |
|---|---|---|
| `n = 5!` | `!` dropped on commit | factorial preserved |
| `q = 7\2` | `\2` → `72` | integer division preserved |
| `r = 7⦼2` | `⦼` dropped | modulo preserved |
| `q = 7÷2` | became a stacked `\frac` | inline division preserved |
| `a ← 5` | parsed as `a * ← * 5` | outer assignment, operator with precedence |
| `z = 3∠45°` | `∠` read as a variable | phasor preserved |
| `x₁ = 5` | `₁` read as a separate factor | a single name |
| `h_ = 1`, `V_Rd_c_` | `_` invented as subscript `0` | name preserved verbatim |
| `<b>bold</b>` | offered as an editable field | `notMath` — see below |

`⦼`, `÷`, `←` and `∠` have **no TeX spelling at all**. Each travels inside a `\text{}`
group, which MathLive renders upright and the reader recovers — measured, not guessed:
`\factorial{}` and `\bmod` are rejected by MathLive as unknown commands, while
`\text{⦼}` validates and reads back exactly.

What `normalize` folds is decided by **asking the engine**, never by preference. It
accepts both `x₁` and `x_1`, and both `÷` and `/`, so those are interchangeable. It
**rejects** `∖` as a spelling of the integer-division `\`, so that glyph survives verbatim
rather than being normalised to a tidier equivalent.

`∠`, `°` and the trailing `_` were each a *separate* bug found by isolation rather than
inspection: adding `°` to the operator table made the reader swallow the degree, and
`\mathrm{h\_}` came back with a stray backslash until the reader unescaped `\_`.

HTML was the last one, and it came from pinning the taxonomy as a test. A bare
`<b>bold</b>` was classified as an equation, so the canvas offered a field over text the
engine **rejects** (`Invalid syntax: "< /"`). HTML is only meaningful inside a
`$Plot{…}` or `$Map{…}` body, so `isEquationLine` now declines any line starting with a tag.

**Result on the corpus:** text fidelity 96.3% → **97.9%**, LaTeX acceptance 99.7% →
**100%**, and 59.6% of equation lines editable (4035 of 6770) — reproduce with
`npx tsx scripts/report-gate.ts`.

Still held back as `lossy`, correctly: the comma-separated subscript (`B_0,0`, 155 lines),
units targets whose meaning depends on the left operand (73), embedded HTML/SVG (24), and
unicode superscripts (11).

### Buttons in the live editor

Three groups, all on the field being worked on. They are **docked once above the canvas**
(`CalcpadMathToolbar.vue`), not repeated inside each field: at sidebar width 21 inline
buttons per line wrapped into a single column beside every equation. The toolbar appears
only while a line is being edited and targets that line, and it follows the Symbol Palette
the Insert tab already uses — a bordered collapsible section with a grid of square glyph
buttons. The field keeps the operations and hands over a handle
(`src/math/mathFieldTools.ts`); the toolbar only says which field.

The groups:

- **Row/column resize** — `+Row −Row +Col −Col` with a live `m × n` label. Already covered
  above; these act on Calcpad source rather than on MathLive's `array`, which is a different
  type from a Calcpad matrix literal.
- **Insert palette** — 19 templates (`√ ∛ ⁿ√ xⁿ x² x⁻¹ a⁄b ( ) sin cos tan ln log exp abs
  sign min max if`), defined in `src/math/insertTemplates.ts`.
- **Undo / redo** — dispatched to MathLive, which owns the field's history.

Every template was verified twice: MathLive was asked whether it accepts the LaTeX, and the
engine was asked whether the Calcpad it reads back is valid — **19 of 19 accepted**.
Re-run the engine half with `npx tsx scripts/report-templates.mts` (needs the backend).

Two design points came out of that verification:

**An unfilled template must never be committed.** `\sqrt{\placeholder{}}` reads back as
`sqrt(())`, and the engine answers `Invalid syntax: "( )"`. So inserting leaves the field in
edit mode with the slot selected, and `endEdit` refuses to write while a `\placeholder{}`
is still present. Inserting reports this as a `hint`, not an `invalid`: nothing has failed,
a slot is simply waiting for a value.

**There is deliberately no absolute-value button.** `|x|` cannot be told apart from
Calcpad's unit target in `x|MPa`, so an inserted `|…|` came back as `0(x|0)` — a button that
silently changed what the line meant. `abs(x)` is offered instead.

Four further bugs surfaced only because the templates were exercised for real:

| Input | Was | Now |
|---|---|---|
| `\placeholder{…}` | a variable named `placeholder` | an empty group |
| `\operatorname{abs}(x)` | `operatorname abs(x)` | `abs(x)` |
| `\sqrt9` | `sqrt(0)9` | `sqrt(9)` |
| `\frac12` | `12 / 0` | `1 / 2` |

The last two are the interesting ones. MathLive **rewrites the template as you type into
it** — `\frac{#0}{#1}` with one digit per slot comes back as `\frac12`, and `\sqrt9` loses
its braces. Testing the template strings alone would never have found this, so the exact
output was read out of a live field and pinned in `tests/insertTemplates.test.ts`. The
`\frac12` rule is safe because MathLive keeps braces for multi-digit values
(`\frac{12}{3}`), which was also measured rather than assumed.

### Phase 4 — Tauri parity
- View menu: `Canvas` / `Text` / `Split`.
- `Export` variants (`Report`, `Preview`, `Input form`, `Unwrapped`) unchanged and
  available from the canvas.
- Unsaved-changes prompt, `confirm_three_way`, drafts, file associations — all reused as-is.

**Exit:** the desktop app has a working canvas; packaging unaffected.

### Phase 5 — Visual constructs
- ✅ Vector/matrix regions (`[1; 2; 3]`, `[a; b|c; d]`) with MathLive matrices — landed
  with the `Matrix` node; see the note on `|` above.
- ✅ Add/remove row and column controls beside every editable matrix literal.
  `matrixOps.ts` reshapes the *first* bracketed literal in Calcpad source and prints it
  back, so a resize is indistinguishable from having typed it. New cells start at `0`,
  the neutral element; ragged literals are padded to the rectangle the engine expects,
  and a result down to one row prints as the vector it is. `−Row` / `−Col` disable
  themselves rather than producing something unrenderable. Measured through the real UI:
  `2×3 → 3×3 → 3×4 → 3×3 → 2×3 → 1×3`, each step reported by `POST /convert` with an
  empty `X-Calcpad-Errors`.
- Variable inspector in the canvas, reusing `CalcpadVariablesTab`.
- Drag-in plots via the existing `POST /pdf` plot extraction.

### Phase 6 — Optional, off by default
- Free-positioned canvas for plots (MathCAD's genuinely 2-D model), persisted as Calcpad
  `#plot` blocks with coordinates — still text, still diffable.
- Mobile/tablet layout with the virtual keyboard pinned.

---

## 8. Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| **Round-trip is lossy** for exotic syntax | High — silent data loss | Parse-time `lossy` flag + verbatim preservation (§6.1). Property tests over `Examples/`. |
| Visual AST fights Calcpad's real grammar | High | Start with `<math-field>`-based editing (Phase 1), not a bespoke canvas. Let MathLive own input. |
| MathLive bundle + fonts bloat the Tauri installer | Medium | Measure in Phase 0; fonts are the bulk. Consider a trimmed font subset. |
| Two views drift out of sync | Medium | One document model, one change-notification path. Never cache a parsed copy in the canvas. |
| Existing `.cpd` users find it alien | Medium | Canvas is opt-in, off by default; text editor remains first-class and unchanged. |
| CSP / sandboxed iframe blocks MathLive | Low | MathLive runs in the main webview, not the sandboxed preview iframe. CSP already allows `'self'` fonts and scripts. |
| Vue/custom-element friction | Low | `isCustomElement` + a thin local wrapper. |

---

## 9. Effort

Rough, one experienced engineer, excluding review and QA:

| Phase | Estimate |
| --- | --- |
| 0 — Foundation + tests | 1 week |
| 1 — Inline math editing | 1 week |
| 2 — Canvas surface | 2 weeks |
| 3 — Editing + undo | 2 weeks |
| 4 — Tauri parity | 1 week |
| 5 — Vectors, plots, inspector | 2–3 weeks |

Phases 0 + 1 are the highest-value, lowest-risk slice: they deliver a genuinely useful
WYSIWYG capability and de-risk everything after them.

---

## 10. Open questions

1. **Implicit multiplication in the visual model.** Calcpad's `2x` and `10m` are the most
   common shortcuts in real documents. Do we show `2·x`, or keep Calcpad's own compact form
   when reading and only canonicalise on explicit edit? *Recommendation: preserve the
   authored form unless the user actually edits that node.*
2. **Comment lines as text regions.** Natural, but comments also document intent in a way
   reviewers may not want flattened. Should text regions stay monospace?
3. **`.cpdz` compiled worksheets.** Read-only there by definition. Confirm the canvas
   degrades cleanly.
4. **Shared placement.** The canvas belongs in `calcpad-frontend`, so it reaches VS Code
   automatically. Is that desirable, or should it be desktop-only for v1?

---

## References

- CalcpadCE language reference — `Setup/AI/Work/CALCPAD_LANGUAGE_REFERENCE_FOR_CLAUDE.md`
- OMML emitter (authoritative dialect) — `Calcpad.Core/Output/XmlWriter.cs`
- DOCX integration — `Calcpad.OpenXml/OpenXmlWriter.cs`
- Backend API — `Calcpad.Web/backend/API_SCHEMA.md`
- [MathLive documentation](https://mathlive.io/mathfield/) · [API reference](https://mathlive.io/mathfield/api/) · [GitHub](https://github.com/arnog/mathlive)
- [SMath Studio](https://smath.com/) — MathCAD-like document model
- [Typora](https://typora.io) — click-to-edit rendered math
- [vue-mathlive](https://github.com/arnog/vue-mathlive) — Vue wrapper (stale; not used)