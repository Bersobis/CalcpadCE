# A LaTeX-free MathML math editor for CalcpadCE

> **Status: design brief.** This document analyses [MathLive](https://github.com/arnog/mathlive)
> and specifies a LaTeX-free math input/editing component for CalcpadCE, together with a phased
> implementation plan. It is a design + plan; the phases below are not yet built.
>
> The component it describes is **not a greenfield build**. A MathML-native, LaTeX-free editor
> core already exists in `calcpad-frontend/src/mathml/` and is wired into the live pane on
> branch `Experimental-Live-Editor`. MathLive has already been removed from the tree. So the
> work this document scopes is **hardening, completing and de-risking an existing component**,
> and the analysis of MathLive exists to justify which of its behaviours are worth reproducing
> and which are not.

---

## 1. The question, and the answer in one paragraph

MathLive is the reference implementation of an interactive math field on the web. It is a
mature, MIT-licensed, dependency-free web component — and it is **built on LaTeX**, both as its
input language and as its serialization format. Calcpad does not use LaTeX anywhere: its
documents are plain text in an operator-based expression language, and `Calcpad.Core` is the
authority on what that text means. This document asks what a MathLive-class editing component
looks like when the LaTeX layer is removed entirely, and answers: **Calcpad's input language and
its storage language are the same, so the LaTeX⇄model translation layer can be deleted rather
than replaced, and the box-layout engine can be replaced by the browser's native MathML
typesetting.** The result is a component with no layout engine, no font-metrics table, no
serialization dialect, and one editor instance per pane instead of one per equation.

---

## 2. MathLive: architecture and core capabilities

Analysed at `mathlive@0.111.0`.

### 2.1 Layering and data flow

```
LaTeX string
  → tokenize()                      src/core/tokenizer.ts
  → Parser + Context                src/core/parser.ts   (macros, registers, math style)
  → Atom tree                       src/core/atom-class.ts + src/atoms/
  → Box tree                        src/core/box.ts, v-box.ts, svg-box.ts
  → HTML markup                     Box.toMarkup()
  → DOM                             src/editor-mathfield/render.ts
```

| Layer | Contents |
| --- | --- |
| Public | `MathfieldElement` (`<math-field>`), `<math-span>`/`<math-div>`, `mathVirtualKeyboard` |
| `editor-mathfield` | keyboard/pointer input, mode editors, render orchestration, a11y, speech |
| `editor-model` | `_Model`: atom tree + selection + mutation commands + `UndoManager` |
| `core` | tokenizer/parser, atoms, box layout, fonts + metrics, registers, math styles |
| `formats` | serializers: LaTeX, MathML, ASCIIMath, MathJSON, Typst, spoken text |

Two widely repeated claims about MathLive are wrong, and both matter to a build-vs-borrow
decision:

- **There is no `@cortexjs/core` package.** The npm scope is `@cortex-js` (hyphen); the relevant
  package is `@cortex-js/compute-engine`. It was a *runtime* dependency only in older versions
  (e.g. 0.69.x) and is now optional — a `ComputeEngine` instance is supplied by the consumer
  only if the `expression`/MathJSON path is used. **Current MathLive has zero runtime
  dependencies.**
- **The fonts are KaTeX (`KaTeX_Main`, `KaTeX_Math`, …), not Latin Modern Math.** Glyph metrics
  are a **baked-in table** (`src/core/font-metrics-data.ts`, ~92 KB) generated offline from TeX
  TFM metrics via `tftopl cmsy10 / cmsy7 / cmsy5`, following OpenType MATH semantics but **not
  read from the font's MATH table at runtime**. The file header documents this explicitly, and a
  commented-out `rebuildMetrics()` shows a runtime-measurement experiment that was deliberately
  abandoned.

### 2.2 Rendering

- **LaTeX is never the rendering mechanism.** It is the input and the serialization format. The
  pipeline is `LaTeX → atom tree → box tree → HTML markup`, and the box tree is a TeX-style
  layout model.
- **The box model** (`src/core/box.ts`): every `Box` carries `height` (baseline→top), `depth`
  (baseline→bottom), `width`, `skew` and `italic` correction, all in ems. Parents accumulate
  from children; vertical stacking uses a separate `VBox`. TeX constants — `axisHeight`,
  `num1/2/3`, `denom1/2`, `sup1/2/3`, `sub1/2`, `sqrtRuleThickness`, `bigOpSpacing1..5`,
  `delim1/2` — live in `FONT_METRICS` per math style.
- **The output is HTML + CSS**, with `.ML__*` classes; `.ML__vlist` uses CSS-table display
  properties for vertical stacking of fractions and scripts. **Stretchy and irregular glyphs use
  SVG** (`makeSVGBox`, `svg-box.ts`). There is **no Canvas** in the production path.
- **MathML is an output format only** (`convertLatexToMathMl`, `src/formats/atom-to-math-ml.ts`).
  MathLive never renders *from* MathML.
- Constructs: `genfrac` (fractions), `surd` (radicals, SVG glyph + rule), `mop` (big operators,
  sized via `KaTeX_Size1..4`), `array` (matrices), `leftright` (delimiters).

### 2.3 The model

The internal representation is a tree of `Atom` objects, independent of presentation. Atom
properties are `type`, `value`, `command` (the originating LaTeX command), `mode`
(`math`/`text`), `parent`/`parentBranch`, `style`, and `branches`.

- **Atom types:** `mord`, `mbin`, `mrel`, `mop`, `leftright`, `genfrac`, `surd`, `subsup`,
  `placeholder`, `array`, `text`, `group`, `root`, `first`.
- **Branches:** an atom may have several named branches — `body`, `superscript`, `subscript`,
  `above`, `below` — and **each branch begins with a special `first` marker atom** that anchors
  navigation. A `genfrac` has `above`/`below`; a `subsup` has `body` + `superscript` +
  `subscript`.
- **Selection** is expressed as offsets/ranges into the atom tree, and the caret is a collapsed
  selection. `_Model` (`src/editor-model/model-private.ts`) exposes `at`, `offsetOf`,
  `setSelection`, `insertAtoms`, `deleteAtoms`, `extendSelectionTo`, `collapseSelection`, and
  `getState`/`setState` — the last pair feeding undo.

### 2.4 Input and editing

- **`onKeystroke()`** maintains an *inline-shortcut buffer*: model state + accumulated
  keystrokes + left-sibling context, used for pattern detection. Modes are `math`, `text` and
  `latex`; `smartMode()` switches automatically, and `Escape` enters LaTeX mode.
- **Smart fences:** typing `(` auto-pairs to `\left(…\right?`, wraps a selection, and
  auto-closes. ~400 lines in `keyboard-input.ts`.
- **Operators build structure:** `/` produces a fraction with implicit arguments; `^` and `_`
  produce scripts.
- **Inline shortcuts** (`src/editor/shortcuts-definitions.ts`, ~460 entries): `pi`→`\pi`,
  `xx`→`\times`, `<=`→`\le`, `sqrt`→`\sqrt{#?}`. The `#?` markers are caret placeholders, and
  entries may carry an `after` predicate making them context-aware.
- **Keybindings** are platform-aware (`ifPlatform: 'macos'`) and mode-aware (`ifMode`), with a
  `REVERSE_KEYBINDINGS` map used for tooltips.
- **Undo is snapshot-based.** `UndoManager` (`src/editor/undo.ts`) keeps
  `maximumDepth = 1000`, a `stack: ModelState[]` holding **content and selection**, an `index`
  pointer, and **coalesces consecutive operations sharing the same tag** (via `lastOp`).
  `canUndo`/`canRedo` derive from the index; `startRecording`/`stopRecording` gate snapshotting.
- **Virtual keyboard:** a singleton controller with layouts, layers, keycaps and variant panels,
  plus a `postMessage` proxy for iframes. Keycap fields include `label`, `latex`, `command`,
  `insert`, `variants`, `width`, `tooltip`.

### 2.5 Accessibility, i18n, extensibility

- **A11y:** `defaultAnnounceHook` announces actions and movements, using `relationName` to name
  positions in human terms ("start of numerator", "end of denominator"). Speech has `local`
  (`SpeechSynthesis`) and `amazon` engines with scopes `all`/`selection`/`left`/`right`/`group`/
  `parent`, SSML output, and **read-aloud with synchronized highlighting**.
- **i18n:** 15 bundled locales plus 19 loaded on demand; RTL handling for `ar`/`he`; CJK, Hangul
  and Kana fall back to **approximate** 'M' metrics (explicitly approximate).
- **Extensibility:** macros (up to eight arguments, with a `captureSelection` option), and a
  **commands registry** whose entries carry metadata (`target`, `canUndo`, `changeContent`,
  `changeSelection`, `fn`) and are dispatched by selector via `executeCommand()`.
- **Public API:** `value`, `getValue(format)`, `setValue`, `insert`, `expression`, `position`,
  `selection`, `applyStyle`, `macros`, `registers`, `keybindings`, `menuItems`; events `input`,
  `change`, `selection-change`, `mode-change`, `undo-state-change`, `mount`/`unmount`.

### 2.6 Performance characteristics

Optimisations present in the library:

- **Box coalescing** — adjacent compatible boxes are merged (`tryCoalesceWith`) to cut DOM nodes.
- **Selective rendering** — a selection-only change updates just the selection/caret elements.
- **`requestAnimationFrame` scheduling** and deferred font loading.
- **Static components** — `<math-span>`/`<math-div>` lazy-load shared fonts once and defer
  rendering until visible via **IntersectionObserver**. By contrast `renderMathInDocument()` is
  documented as *"a very expensive call, as it needs to parse the entire DOM tree"*.

Costs:

- **One full editor pipeline per `<math-field>` instance** — model, undo manager, keyboard
  delegate and listeners are constructed in `connectedCallback()`. A hundred-equation document
  means a hundred editors.
- A **shadow DOM per instance** (the `::part()` API implies `attachShadow()`).
- A **~92 KB metrics table** plus the KaTeX woff2 font set in the bundle.

Reported issues worth knowing: #2106 (deleting at a sum's upper limit took ~5 s), #3047
(Firefox `mathVirtualKeyboard.show()` blocked for ~1.2 s+ even when the keyboard DOM already
existed).

### 2.7 The LaTeX coupling, and what removing it costs

LaTeX is used in two places: as the **input** string parsed into atoms, and as the
**serialization** emitted by `Atom._serialize()`. The `\command` layer is the tokenizer plus
`Parser` plus the ~800 command definitions in `src/latex-commands/`, driven by macro lookup
through `Context`.

Removing LaTeX entirely would mean replacing the parser/grammar (commands, environments,
`\left…\right`, mode shifts, registers, math styles) and the serialization vocabulary, plus the
public API surface that exposes LaTeX (`value`, `setValue`, `insert`, `macros`, `registers`, the
`latex` mode) and the shortcut/autocomplete vocabulary.

**The Atom, Box and rendering layers are already LaTeX-independent.** That is the seam a
LaTeX-free implementation exploits — and it is the reason the design below does not need to
re-invent layout.

### 2.8 Two corrections that shape the design

1. **MathLive does not render MathML.** It *emits* MathML. Rendering is its own box engine. So
   "use MathML like MathLive does" is not a thing that exists; choosing native MathML rendering
   is a genuinely different rendering strategy with different trade-offs (§5.1).
2. **MathLive's LaTeX is not optional in practice.** The library's own MathML is *derived from*
   LaTeX, so a consumer cannot remove LaTeX by choosing a different output format. Confining
   LaTeX to an adapter still leaves LaTeX inside the library — which is why the design below
   does not use MathLive at all.

---

## 3. The design

### 3.1 The thesis: input language = storage language

Calcpad is a **flat, operator-based expression language**, not a 2D typesetting language. Its
2D structures are **derived from operators**, not from commands:

| Structure | Calcpad spelling | MathML |
| --- | --- | --- |
| fraction | `/` or `÷` | `mfrac` |
| power | `^` | `msup` |
| subscript | `_` | `msub` |
| square root | `sqrt(x)` | `msqrt` |
| n-th root | `root(x; n)` | `mroot` |

Three consequences follow, and together they are the whole efficiency argument:

1. **No LaTeX tokenizer, parser or command vocabulary.** There is nothing to translate: typing
   `a/b` *builds* a fraction directly, because `/` already means division in the source language.
2. **No serialization dialect, therefore no round-trip fidelity problem.** Calcpad text *is* the
   storage format. MathLive must maintain `LaTeX ⇄ atom ⇄ box`; Calcpad needs only
   `text ⇄ tree`.
3. **No modes, no environments, no macro layer, no registers.** One language, not three.

This is the sense in which the component is "more efficient": the LaTeX layer is not optimised,
it is **deleted**, and with it the entire class of bugs that comes from two representations
disagreeing.

### 3.2 Rendering: semantic MathML, typeset by the browser

Emit real MathML — `mfrac`, `msqrt`, `mroot`, `msup`, `msub`, `mo`, `mi`, `mn`, `mtext` — and
let the **browser's native MathML engine** perform layout.

| | MathLive | Calcpad |
| --- | --- | --- |
| Layout | custom TeX-style box engine | browser MathML layout |
| Metrics | ~92 KB baked table | none |
| Fonts | KaTeX woff2 set | platform math font (+ one bundled woff2, §5.1) |
| Markup | HTML/CSS + SVG | semantic MathML |
| Editors | one pipeline per `<math-field>` | **one surface per pane** |

What this deletes: the layout subsystem, the metrics payload, the font payload, and the
per-instance editor cost. What it gains besides: markup that is natively semantic, so
accessibility comes from the platform rather than from a bespoke speech subsystem.

### 3.3 Input: operators build structure

- **Keystrokes are Calcpad text.** A single dispatch decides what a character does: `/` builds a
  fraction, `^` a power, `_` a subscript, `(` an auto-paired bracket, anything else inserts text.
  There is no mode to be in.
- **No virtual keyboard.** The existing `CalcpadMathPalette.vue` button grid already covers
  structures, functions, operators, relations and Greek. MathLive's virtual keyboard is a large
  subsystem solving a problem the palette already solves.
- **Structural caret.** Left/Right walk the canonical anchor sequence; Up/Down move *between
  structural slots* (numerator ↔ denominator, base ↔ exponent) and step out of a structure when
  there is no slot in that direction. This mirrors MathLive's structural movement rather than a
  visual line-based one, and it is what makes editing `a/b` feel like editing a fraction.
- **Decline rather than corrupt.** A line opens graphically only when it is a **fixed point** of
  `parse → print → parse`: the two trees must be identical. A construct the bridge models
  imperfectly produces a different tree and the line falls back to source editing. Empty slots
  (`b/`, `1()`) have no Calcpad spelling, so the line is held open and cannot be committed.

### 3.4 The model

The representation is a small, explicit **MathML AST** — plain data, no DOM:

- Node kinds: `text` (literal) and `element` (name + attributes + children).
- Element names: `math`, `mrow`, `mi`, `mn`, `mo`, `mtext`, `mspace`, `mfrac`, `msqrt`,
  `mroot`, `msup`, `msub`, `msubsup`, `mfenced`, `mover`, `munder`, `munderover`, `mtable`,
  `mtr`, `mtd`, `mstyle`.
- The root is always `<math>` wrapping one `<mrow>`, so every expression path is exactly two
  elements deep — which makes "insert at the caret" one uniform operation.
- Addressing is a **child-index path** (`number[]`), and every serialized element carries a
  `data-path` attribute so a DOM click maps back to the tree.
- The caret is an **Anchor**: either `{ kind: 'char', path, offset }` (a position inside a
  token) or `{ kind: 'gap', path, index }` (a position between children, the only way to sit in
  an empty slot). Anchors are **canonicalized** so that a gap visually coinciding with the end of
  the preceding child has exactly one spelling — without that, Left/Right stalls on duplicates.

Every editing operation is a **pure function over this data**: move the caret, insert a
character, build a structure, delete a unit. That is what makes the whole core testable without
a browser and without a math library, and what makes memoisation possible.

### 3.5 What already exists

The design above is implemented, not proposed, for the core:

| Concern | Module |
| --- | --- |
| AST + path addressing + canonical anchors | `src/mathml/ast.ts` |
| AST → MathML (`serializeWithPaths` tags `data-path`) | `src/mathml/serialize.ts` |
| MathML → AST (DOMParser) | `src/mathml/parse.ts` |
| Calcpad ⇄ MathML bridge + the editability gate | `src/mathml/calcpad.ts` |
| Caret, selection, structural editing, deletion | `src/mathml/caret.ts` |
| DOM pointer → Anchor | `src/mathml/hit-test.ts` |
| Per-line memo + partial typeset | `src/mathml/line-model.ts` |
| Palette catalog | `src/text/math-palette.ts` |
| Editing surface | `calcpad-web/src/live-display/CalcpadMathMlEditor.vue` |
| The pane | `calcpad-web/src/live-display/CalcpadLiveDisplay.vue` |

The gap this document addresses is therefore **capability and robustness**, not architecture:
the core is sound, and §4 and §5 say what is missing and what it must be careful about.

---

## 4. Features to reproduce

MathLive is a full document-editing component. The table below is the triage: what is worth
reproducing, and what is deliberately refused.

### 4.1 Reproduce

| Capability | State | Notes |
| --- | --- | --- |
| Typed tree + structural slots | exists | MathML AST + `SLOT_NAMES` |
| `/`→fraction, `^`/`_`→scripts | exists | character dispatch |
| Smart fences / auto-pairing | exists | `insertPair` |
| Structural caret movement | exists | `moveHorizontal` / `moveVertical` |
| Decline-what-cannot-round-trip | exists | the fixed-point gate |
| Empty-slot protection | exists | `hasEmptySlot` blocks commit |
| Palette for structures/functions/symbols | exists | `CalcpadMathPalette.vue` |
| **Pointer→offset with midpoint bias** | **add** | bias to the nearer side of a leaf's midpoint; fall back to the *nearest* anchor, not the first |
| **Snapshot undo with coalescing** | **add — missing entirely** | see §4.3 |
| **Clipboard (copy/cut/paste)** | **add — missing** | see §4.3 |
| **IME / composition input** | **add — missing** | see §4.3 |
| **Engine-verified inline shortcuts** | **add** | see §4.3 |
| Matrix / array literal editing | **landed** | `[a; b\|c; d]` now round-trips as a table; 2D caret movement still open |
| Accessibility beyond native MathML | **add** | see §6, Phase 7 |

### 4.2 Deliberately not reproduced

| MathLive capability | Why not |
| --- | --- |
| Box-layout engine, baked metrics, KaTeX fonts | replaced by native MathML typesetting |
| HTML/CSS/SVG renderer | replaced by semantic MathML |
| Shadow DOM per instance | one surface per pane |
| Modes (math / text / LaTeX) | one language |
| Virtual keyboard | the palette already covers it |
| Speech engines, read-aloud, SSML | native MathML is exposed to assistive tech; a bespoke speech stack is a large surface with little marginal value here |
| Locales / RTL | out of scope for v1 |
| LaTeX / ASCIIMath / MathJSON / Typst serializers | Calcpad text is the only target |
| Math-level macros | Calcpad macros are document-level, not math-level |
| Static render components | inert rows already serve this purpose |
| `expression` / Compute Engine integration | Calcpad has a better engine, in C# |

### 4.3 The three real gaps

**Undo/redo.** The surface has no undo of its own. Note the two layers: a *committed* edit
becomes a Monaco model edit and is covered by Monaco's undo stack, but **while the surface has
focus `Ctrl+Z` does nothing** — the surface is a non-editable element and Monaco does not have
focus. So a widget-level undo is needed, scoped to the uncommitted edit, and it must not fight
Monaco's stack. The shape to copy from MathLive is snapshot-with-tag-coalescing: store
`{ tree, selection, tag }`, cap the depth, and merge consecutive operations that share a tag so
a run of typing is one undo step.

**Clipboard.** The key handler returns early whenever `Ctrl`/`Meta`/`Alt` is held, so
copy/cut/paste are dead. This is unusually cheap to fix here, because **Calcpad text is the
storage format**: a copy writes the selected Calcpad text (the selection→text operation already
exists), and a paste parses Calcpad text into a tree and splices it. No interchange format is
needed.

**IME / composition.** The key handler only accepts keys whose `key` is a single character and
never checks `isComposing` or listens for `compositionstart`/`update`/`end`, so composed input —
Greek letters, dead-key accents, any CJK IME — does not work. Since Calcpad documents routinely
use Greek variable names, this is a real functional gap, not a nicety.

A fourth, smaller gap belongs here because it is a *correctness* bug rather than a missing
feature — see §5.6.

---

## 5. Performance and integration constraints

### 5.1 Native MathML support varies by host — the highest risk

This is the assumption the whole rendering approach rests on, and **nothing in the repository
probes it today**.

| Host | Engine | MathML |
| --- | --- | --- |
| Web browser | Chromium / Firefox / Safari | MathML Core in Chrome 109+, long-standing in Firefox, Safari 16.4+ |
| VS Code extension webview | Chromium (Electron) | fine on recent versions |
| Desktop — Windows | WebView2 (Chromium) | fine |
| Desktop — Linux | WebKitGTK | MathML Core since **WebKitGTK 2.40** — Ubuntu 22.04-era webviews are exposed |
| Desktop — macOS | WKWebView | `tauri.conf.json` sets **`minimumSystemVersion: "11.0"`** → macOS 11 ships Safari 14 → **only partial MathML** |

Mitigation, and it must come **first**:

- A **measured DOM probe** — typeset a `<math><mfrac>` in a detached container and check that
  the numerator stacks above the denominator — rather than user-agent sniffing.
- Gate the opt-in Graphical mode on the probe; when it fails, force source mode and say why.
- Render an explicit "not supported here, using source" state instead of broken math.
- **Bundle one math woff2** (e.g. Latin Modern Math or STIX Two Math) with
  `@font-face { … } math { font-family: … }` to remove the separate "no system math font"
  failure mode on Linux. This is a small fraction of MathLive's KaTeX payload.

### 5.2 The resting → editing transition

The resting row shows the engine's **CSS-based HTML** (`<span class="dvc">` fractions,
`<span class="o0">` radicals); the editing row shows **native MathML**. Clicking a row therefore
changes how the expression is drawn.

It is tempting to frame this as "split the expression from the result", because the engine emits
one `<span class="eq">` wrapping the whole rendered equation with `= result` appended into the
same string — so expression and result are **fused** and a client cannot cleanly separate them.

**That framing is wrong, and the correction matters.** The editor never needs the server markup
to edit: it already owns the expression as text and typesets its own tree. The real issues are:

1. **The evaluated result disappears while editing** and returns when the debounced preview
   lands. This is an affordance problem, not a parsing problem.
2. **The expression changes font** on click, because the two renders use different fonts.

Mitigation: match the resting `.eq` typography in the surface's styles (font family, variable
and unit colours, sizes, math style, spacing) so the expression itself does not visibly move,
and design the swap so the vanishing result reads as intentional rather than as a glitch.

### 5.3 Deep-nesting and `FormatEquations` divergence

`HtmlWriter.FormatDivision` returns a stacked `<span class="dvc">` only when the nesting level is
**< 4**, and falls back to inline `" ÷ "` at level ≥ 4; `MathParser.Output` computes
`level = a.Level + b.Level + 1` and branches at `>= 4`. Native `mfrac` **always** stacks.

There is a **second, more common trigger**: `formatEquation` is
`_formatEquations && content == "/" || !_formatEquations && content == "÷"`. With
`FormatEquations` **off**, even a shallow `/` renders inline at rest while the editor stacks it.

Recommendation: **document it, and optionally warn in the editor. Do not mirror it.** Un-stacking
`mfrac` to match would defeat the point of the approach.

### 5.4 Unit target `|` is not absolute value

`x|MPa` is a **unit conversion target**, not an absolute value. The bridge splits at the first
top-level `|` and renders the right side as an upright `mtext`; a bare `|` inside brackets is
explicitly rejected. The palette correctly **omits `|…|`** — the `abs` button is *labelled*
`|x|` but emits `abs(x)`, because an inserted `|…|` cannot be told apart from a unit target.

Rule: **the widget must never offer `|…|`.** (The `|x|` label is a small UX trap worth relabelling
to `abs(x)`.)

### 5.5 Empty slots hold the line open

An empty slot has no Calcpad spelling: `b/` would re-parse as division by whatever follows, and
`1()` does not parse. So the line is held open, the surface reports itself incomplete, and commit
is refused. This is the "no silent data loss" guarantee and must be preserved through every
change.

### 5.6 Latency budget and the authoritative result

The pane renders the whole document in one `/convert` request, debounced at **140 ms**, with a
separate **220 ms** preview request for the row being edited. Both use per-key request
supersession, and a superseded request resolves to `null` rather than erroring
(`OperationCanceledException` → HTTP 499). The local typeset bridges the gap so a row never
blanks. The engine remains the **only** evaluator — the client never computes a result.

### 5.7 Multi-character operators break the gate after typing

The bridge's tokenizer normalises `!=`, `<=`, `>=`, `==` to single glyphs (`≠`, `≤`, `≥`, `≡`),
but the editor inserts **one character at a time**. Typing `>` then `=` therefore produces two
`mo` tokens whose printed form re-parses as `≥` — a **tree mismatch on reopen, so the gate can
decline a line the user has just edited**. This is the concrete reason the shortcut table in §4.1
is a correctness fix and not a convenience.

### 5.8 The typeable set and the parser's operator set have diverged

The surface's printable-character pattern includes `∠` and `,` but **omits `←` and `÷`**; the
bridge's operator set includes `←` and `÷` but **not `∠`**. Consequences: `∠` types as an
identifier, `←` and `÷` cannot be typed at all (palette only), and a typed `,` becomes a name
character that will not round-trip.

These two sets must be **derived from one source** so they cannot drift again.

### 5.9 Click-to-caret accuracy across the transition

A click captures a viewport point on the **resting** row — different markup, different font, and
it includes the result — and that point is replayed against the **editing** surface once it
renders. Expect mis-hits, especially where the result's presence shifts the layout. This is
mitigated by §5.2's typography match and needs a dedicated test (click the middle of a fraction
at rest).

### 5.10 Macro and loop line alignment

The per-line splitter keeps the first output line per source line and folds macro/loop extras,
so a source line inside a `#for` body may show iteration 1's render. Editing stays safe — source
text is authoritative — but the preview can mislead.

### 5.11 Palette buttons that silently did nothing — **fixed**

This was the one genuinely dead control in the editor, and the audit that found it is worth
recording because it was invisible to the obvious check. Every `<button>` in the frontend has a
bound handler and every handler resolves to a defined function; the failure was a handler that
**silently did nothing**. The palette routes all 84 buttons through one dispatch, which ended
with `if (action.group === 'Structures') return` — and `vector` (`[ ]`) and `matrix2x2` (`2×2`)
are in that group with no mapping, so clicking them had no effect at all.

Fixing it needed real capability rather than a guard: the two buttons build `[a; b|c; d]`
literals, which the bridge declined outright. The bridge now models them as an
`mtable > mtr > mtd` tree (`insertTable`), with an empty cell being an `mrow` with no children
so `hasEmptySlot` holds the line open exactly as a bare `b/` does.

Four neighbouring defects surfaced from the same audit and are also fixed:

| Defect | Fix |
| --- | --- |
| `cbrt` built `root(x; )` — an empty degree the button's own tooltip had already promised | a `cbrt` structure with degree `3` |
| The Operators buttons `/ ÷ ^ _` inserted a **flat glyph** where *typing* the same character builds a structure | the character groups now go through `applyCharacter` |
| `insertPair`/`insertCall` emitted flat brackets while the parser wraps a group in an `mrow` | both wrap, so a typed line and a reloaded one are the same tree |
| `mergeable('1','x')` was `true`, so typing `2x` built `mo('1x')` — a token the parser never produces | `mergeable` now matches the tokenizer exactly |
| `∠` was a *name character* in the bridge, but the engine's `Validator` has no `∠` at all — it is an operator in `#complex` mode and an **error** otherwise | modelled as a binary operator |

**The invariant that made these findable**, and which the test suite now pins: the tree the
editor holds must equal the tree its own parser builds from the text it prints —
`equalNodes(tree, calcpadLineToMathMl(mathMlToCalcpadLine(tree)))`. Round-tripping the *text* is
not enough, because the gate only ever compares parser-trees and so can never see the editor
drifting from its own parser. Two of the defects above were invisible to a text-only check.
Pressing all 84 buttons through the real dispatch went from **27 violations to 0**.

### 5.12 The gate's blind spot

The tree-equality test used by the gate compares element **names and children but not
attributes**. Today this is latent, because the only attributes in play are the root namespace
and an unproduced `mfenced` pair. It becomes a real hole the moment any attribute carries
meaning (matrix alignment, stretchy flags). Fix it while it is cheap.

---

## 6. Phased implementation plan

Ordered by value and risk. Graphical mode is already behind a persisted opt-in, so every phase
can land behind the existing flag.

### Phase 0 — De-risk the runtime (do this first)

The point of this phase is that it can invalidate the rendering choice, so it must precede
everything else.

- **New** `calcpad-frontend/src/mathml/capability.ts` — `supportsMathMlCore()`, a measured DOM
  probe (not UA sniffing). Export from `mathml/index.ts`.
- **Edit** `calcpad-web/src/live-display/CalcpadLiveDisplay.vue` — gate the Graphical checkbox on
  the probe; when it fails, force source mode with a visible reason.
- **Edit** `calcpad-web/src/live-display/CalcpadMathMlEditor.vue` — an explicit "not supported,
  using source" state instead of broken math.
- **Bundle one math woff2** and add the `@font-face … math` rule.
- **Test** `calcpad-frontend/tests/mathmlCapability.test.ts`, plus a **manual smoke matrix** on
  Windows WebView2, the VS Code webview, macOS 11 and 13.3+, and Ubuntu 22.04 WebKitGTK.

### Phase 1 — Close the gate holes

- **Edit** `mathml/ast.ts` — tree equality also compares attributes (shallow, key-sorted).
- **Decide** `lineEditorModel` / `plainMarkup`: they are exported but unused by the app — either
  wire them into the preview path or delete them. Do not leave dead exports.
- **Tests** for attribute-only differences.

### Phase 2 — Remove the double parse and the hot-path walks

- **Edit** `CalcpadLiveDisplay.vue` — replace `partialTypesetMarkup(editable)` with the editor's
  own serialised tree; keep `partialTypesetMarkup` for source mode only.
- **Edit** `mathml/line-model.ts` — add a tree-based partial typeset (trim trailing empty
  structures) instead of re-parsing text.
- **Edit** `mathml/caret.ts` — memoise the canonical anchor sequence per tree, shared by
  `anchorIndex`, `moveHorizontal`, `lastAnchor` and `hasEmptySlot`. Several full-tree walks
  currently run per keystroke.
- **Edit** `CalcpadMathMlEditor.vue` — take the status line's position/total from the shared memo.
- **Defer** subtree-level DOM patching until profiling justifies it: equations are short, so the
  full re-typeset may be acceptable. Measure before optimising.

### Phase 3 — Missing editing capabilities

**Palette and typing correctness — landed.** The dead `vector` / `matrix2x2` buttons, the
`cbrt` degree, the Operators dispatch, the bracket shape and the `mergeable`/`∠` tokenizer
disagreements are all fixed and pinned by tests (§5.11). Still open:

- **New** `mathml/history.ts` — snapshot undo with tag coalescing, scoped to the uncommitted
  edit. Wire `Ctrl+Z` / `Ctrl+Y` / `Ctrl+Shift+Z`.
- **New** `mathml/clipboard.ts` — the pure text↔tree half of copy/cut/paste.
- **Edit** `CalcpadMathMlEditor.vue` — composition events and `isComposing`; stop returning early
  on modifier keys for clipboard and undo.
- **New** `mathml/shortcuts.ts` — engine-verified shortcuts including `>= <= != ==`; derive the
  typeable set and the parser's operator set from **one** source (§5.8).
- **Edit** `mathml/hit-test.ts` — midpoint bias and nearest-anchor fallback.

### Phase 4 — Visual fidelity across the transition

- **Edit** `CalcpadMathMlEditor.vue` styles to match the resting `.eq` typography (§5.2).
- Design the affordance so the vanishing result reads as intentional.
- Verify and repair click-to-caret accuracy across the transition (§5.9).

### Phase 5 — Document the nesting and `FormatEquations` divergence

- An optional in-editor note when a line will render inline at rest (§5.3).

### Phase 6 — Matrix / array editing

**The literal landed.** `[a; b|c; d]` parses to an `mtable`, prints back exactly, and gives every
cell its own slot — which is what the palette's `vector` and `2×2` buttons needed to stop being
dead (§5.11). `[`/`]` are no longer in the declined set, and `splitUnitTarget` tracks bracket
depth so the row divisor inside brackets is not mistaken for the unit target.

**Still open:** 2D caret movement. Up/Down currently step out of the table rather than moving
between rows, because `mtd` is not a slot the vertical walker understands. Left/Right already
traverse the cells in document order, and source mode still offers the cell-by-cell grid, so
this is a refinement rather than a gap.

### Phase 7 — Accessibility

Strengthen the surface's roles and ARIA semantics, announce the current node and selection
through the existing live region, and consider a visually hidden text mirror. Speech and SSML
stay out of scope (§4.2).

---

## 7. Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| **No MathML engine on a target host** | High — the rendering approach fails there | Phase 0 probe + fallback + bundled font, before any other work |
| **Resting → editing jump reads as "broken"** | Medium — product perception | Typography match, deliberate affordance, caret test (§5.2, §5.9) |
| The client bridge drifts from `Calcpad.Core` | Medium — silent loss of coverage | The fixed-point gate declines rather than corrupts; keep the corpus-measured coverage honest; do **not** grow the bridge without a test |
| Gate blind spot on attributes | Medium — a construct could pass the gate and be rewritten | Phase 1 |
| Deep-nesting / `FormatEquations` divergence | Low — cosmetic | Document and optionally warn; do not mirror (§5.3) |
| Matrix support pulls the gate's safety margin | Low (deferred) | Keep deferred until demanded (§6) |

The drift risk deserves emphasis, because it is the one the design accepts rather than removes.
This component deliberately keeps a **second implementation of the Calcpad grammar** on the
client. That is a conscious trade — it buys offline editing, zero round-trip latency, and no
backend change — and the mitigation is the gate plus tests, not optimism. If the bridge is ever
extended, the extension must come with corpus measurement, or the gate silently narrows.

---

## 8. Editing HTML and Markdown graphically

A Calcpad worksheet is not all arithmetic. `#html` and `#markdown` switch a region
into content, and until now the live pane could only edit those lines as raw
source. They now open in a rich-text surface.

### 8.1 The two modes are edited differently, because they are different things

| | `#html` | `#markdown` |
| --- | --- | --- |
| Unit | one line | the whole region |
| Why | each line is written to the output verbatim, so a line stands alone | consecutive lines are rendered together, so a table or list spans several |
| Markup source | the author's own source line — nothing is rendered or reconstructed | the elements the engine rendered |
| Write-back | the edited markup, verbatim | Markdown converted from the edited markup |

`#html` needs no rendering at all: the source line *is* the markup. `#markdown`
does, because the author wrote prose only the engine can render — and the
conversion back is the part that has to be careful.

### 8.2 The gate, again

`htmlToMarkdown` handles a known subset — headings, paragraphs, emphasis, code,
lists, task lists, quotes, rules, links, images, pipe tables — and returns `null`
for anything else. `null` means **do not commit**, the same rule the math editor's
gate follows. A block is checked before it is opened, so an unrepresentable one
falls back to the source editor with a reason instead of being opened and then
refused after the user had done the work.

The subset is also the security boundary. It contains no `script`, `style`,
`iframe` or `form`, and no event-handler attribute is allowed, so a fragment that
passes has nothing dangerous to strip — validating *is* sanitizing. That
equivalence matters here because the desktop CSP allows inline scripts.

Two rules keep the surface inside the subset by construction: **paste is plain
text**, and **nothing is written back unless the user actually edited it**. The
second is not an optimisation — the browser normalises markup the moment it parses
it, so rewriting an untouched block would reformat the author's source for no
reason.

### 8.3 Three things that were not obvious

1. **`DOMParser` moves `<script>` and `<style>` into `<head>`.** A checker that
   looked at `body` would pass a fragment containing a script — and with a CSP
   that allows inline scripts, that is not theoretical. Everything that inspects
   author markup goes through a `<template>` element instead, which parses a
   fragment in place and never executes anything.
2. **`splitRenderedLines` returns inner HTML, so the block element is lost.** For
   a heading, the anchored element *is* the `<h2>`, so reading its contents turns
   it back into a paragraph. A sibling `splitRenderedBlocks` returns the element
   itself, and the pane carries it alongside the inner HTML.
3. **Markdig's task list is `<input> done`** — a space after the checkbox — so a
   naive conversion wrote `- [x]  done` and changed the block on commit. HTML
   collapses whitespace when it renders, so the converter does too.

### 8.4 What is declined

- **A line of a multi-line element.** `<style>` … `</style>` is three source
  lines and no one of them is a fragment; opening one would detach it from the
  element it belongs to. Every line is declined, and the source editor keeps it.
- **Markdown holding raw HTML.** A `#markdown` block may contain raw HTML — that
  is documented and supported by the engine — but Markdown has no spelling for
  most of it, so such a block is declined rather than quietly flattened.
- **A `class` or `style` the engine would not write.** Markdig tags a task list
  and a code fence's language, so exactly those classes are accepted; any other
  carries meaning Markdown cannot spell.

### 8.5 Verification

The property that matters is not that the Markdown *looks* right but that the
document renders the same: open a block, commit without editing, re-render, and
require the markup to be identical. Measured against the running engine over
headings, paragraphs, tables, bulleted and numbered lists, blockquotes, rules,
links, images, task lists, fenced code and a mixed document — **all pass**. Two
cases (`pipe table`, `mixed document`) come back respelled — `|------|` becomes
`| --- |` — with the rendering unchanged, which is inherent to HTML→Markdown and
only reachable when the user has actually edited the block.

## 9. The insertion control

### 9.1 The bug that hid behind a passing test

Every palette button did nothing in graphical mode, and the cause had nothing to do with the
palette. The math surface is bound as `ref="mathEditor"` **inside** the row loop, and Vue collects
a ref inside `v-for` into an **array** — it cannot know that a `v-if` means only one row is ever
being edited. So `mathEditor.value` was `[instance]`: truthy, so it passed the guard, and with
neither `applyPalette` nor `focus`. Every graphical-mode call site threw:

```
TypeError: mathEditor.value.applyPalette is not a function
```

Five call sites were affected — the palette insert, the graphical-mode toggle's focus, and
click-to-caret — and all had been broken since the surface was introduced. The type system cannot
see it: `ref<T>` is declared `T | null` whatever Vue assigns. The fix is to bind a function ref
(`:ref="setMathEditor"`) and normalise through `singleTemplateRef`.

**The lesson is about the test, not the bug.** The buttons had been "verified" by testing
`applyPaletteAction` — the pure dispatch — and the palette catalog, and both passed. A
pure-function test cannot see a component-wiring failure, and this one only appeared on a click
with graphical mode on. It was found by driving the built app in a real browser and reading the
console. **When the complaint is "the button does nothing", the pure layer is not where the answer
is.**

`tests/template-refs.test.ts` now guards the shape: a plain `ref="x"` inside a `v-for` fails the
suite, checked with Vue's own compiler over every `.vue` in the workspace.

### 9.2 Replacing the grid with a menu

Eighty-four buttons is a good *reference* and a poor *control*: you scan a grid, look away from the
caret, and reach for the mouse. The primary insertion control is now a command menu opened where
you are typing:

| | Button grid | Command menu |
| --- | --- | --- |
| Cost to use | scan 84, then aim and click | `Ctrl/Cmd+K`, a few letters, Enter |
| Where it is | below the surface, away from the caret | over the surface, at the caret |
| Reaches by | sight | name, glyph, title or syntax |
| First thing shown | the catalog order | what this author used last |

It filters as you type, navigates with the arrow keys, inserts on Enter and closes on Escape. It
opens on **recency**, which is what makes it fast for the constructs a document actually uses —
`rankPalette` orders by match quality first and recency only as a tie-breaker, so a familiar weak
match can never outrank an exact one.

Both controls insert through the same `applyPalette`, so they cannot drift apart, and the grid
survives behind a "Browse symbols" toggle for the case it is genuinely good at: looking something
up when you do not know what it is called.

### 9.3 Verified in the browser, not just in the types

`tsc`, `vue-tsc` and the suite are necessary and were not sufficient. Both editing modes were
driven in a real browser, with the console watched, **over every button rather than a sample**:

- **All 84 buttons insert, in both modes** — 84/84 source and 84/84 graphical, no console errors.
- **Menu, both modes**: `Ctrl+K` opens; a filter narrows; Enter inserts and closes; reopening leads
  with the action just used; ↑↓ moves; Escape closes; Browse reveals all 84 and still inserts.

Sampling three buttons was the earlier mistake, and the full sweep found two defects the sample had
missed — both in the menu added above:

| Defect | Fix |
| --- | --- |
| The menu stayed open when you clicked the editing surface, so the next keystroke filtered a menu you had forgotten about | close on a `mousedown` outside the menu |
| The palette's folded groups reset on every editor reopen, because the palette remounts with the editor | the folded set is owned by the pane, not the palette |

A probe lesson worth keeping: a `.catch(() => {})` around a locator click silently skipped the
graphical case and made the first fix look like it had worked. **A verification harness that
swallows its own failures is worse than none.**

## 10. References

- [MathLive](https://mathlive.io) · [API reference](https://mathlive.io/mathfield/api/) ·
  [GitHub](https://github.com/arnog/mathlive)
- CalcpadCE language reference — `docs/quick-reference.md`
- Engine HTML writer — `Calcpad.Core/Output/HtmWriter.cs`
- Engine expression renderer — `Calcpad.Core/Parsers/MathParser/MathParser.Output.cs`
- Per-line anchors and the equation wrapper —
  `Calcpad.Core/Parsers/ExpressionParser/ExpressionParser.cs`
- Backend API schema — `Calcpad.Web/backend/API_SCHEMA.md`
- Existing editor core — `Calcpad.Web/frontend/calcpad-frontend/src/mathml/`
- Related briefs — `docs/new-wysiwyg-equation-editor.md`,
  `Calcpad.Web/frontend/LIVE-EDITOR-APPROACHES.md`,
  `Calcpad.Web/frontend/LIVE-EDITOR-PROBLEM-STATEMENT.md`
