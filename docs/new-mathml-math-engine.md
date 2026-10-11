# The CalcpadCE math engine — MathML in, Calcpad out

> **Status: implemented.** The engine, the editing surface, the sidebar panel and the test suite  
> are in the tree. This page is the feature brief that explains the architecture and records  
> what was measured, so the remaining work can be reviewed before more code lands.

A rendering and editing layer for Calcpad that is built from scratch, has **no LaTeX anywhere**,  
and depends on **no third-party math library**. Expressions are modelled as **MathML**, typeset  
by the browser's own MathML engine, and interchanged with Word as **OMML**.

---

## 1. Why this replaces the previous attempt

Two earlier attempts are recorded on `Experimental-Live-Editor`. Both are instructive, and both  
failed for the same underlying reason.

| Attempt | Approach                                                                       | Why it did not hold                                                                                                                                                                                                                                              |
| ------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1       | MathLive, with **LaTeX** as the interchange between Calcpad text and the field | LaTeX is a *second* representation of the same expression, and every construct that has no faithful TeX spelling drifted on commit. Greek letters collapsed to the number zero; a label silently became attached units; brackets accumulated one per round-trip. |
| 2       | A LaTeX-free editor that replaced MathLive entirely                            | The right instinct — but it re-implemented a box-layout engine, a metrics table and a bespoke caret, which is a large surface to own and a large surface to get wrong.                                                                                           |

This attempt keeps the second attempt's conclusion and drops its cost:

- **The interchange is MathML, not LaTeX.** MathML is a tree of *structure* (`mfrac`, `msqrt`,  
  `msup`, `mtable`), so a construct that has no linear spelling still survives. OMML is the same  
  shape with Word's element names, and `Calcpad.Core` already emits it — so the dialect is not  
  invented here, it is matched to `XmlWriter.cs`.
- **There is no layout engine.** The browser typesets MathML natively. No font-metrics table, no  
  SVG glyphs, no box model, no per-equation editor instance.
- **Calcpad's input language is its storage language.** Operators *are* structures: `/` builds a  
  fraction because `/` already means division. There is nothing to translate.

---

## 2. Architecture

```
   Calcpad text  ──parse──▶  MathML AST  ──serialize──▶  native MathML   (the browser draws it)
        ▲                        │
        │                        ├──omml──▶  OMML   (Word export / import)
        └────────print───────────┘
```

Every layer is a **pure function over plain data**. There is no DOM in the model, no class  
hierarchy, and no state outside the editor component — which is what makes the whole engine  
runnable headless in Node for the test suite and the corpus harness.

### Modules — `Calcpad.Web/frontend/calcpad-frontend/src/math/`

| Concern                                                                        | Module          |
| ------------------------------------------------------------------------------ | --------------- |
| MathML AST: nodes, constructors, structural equality, paths                    | `model.ts`      |
| Operators, precedence, name characters, functions, units — one source of truth | `grammar.ts`    |
| Calcpad text → tokens (bracket-aware, shortcut-aware, `$` drawing calls)       | `tokenizer.ts`  |
| Tokens → AST, precedence climbing                                              | `parser.ts`     |
| AST → Calcpad text, minimal brackets                                           | `printer.ts`    |
| AST → native MathML (string and DOM)                                           | `serialize.ts`  |
| AST ⇄ OMML, matched to `XmlWriter.cs`                                          | `omml.ts`       |
| A dependency-free XML reader/writer for the MathML and OMML subset             | `xml.ts`        |
| Structural caret: canonical anchors, horizontal/vertical movement, empty slots | `caret.ts`      |
| Keystrokes and palette structures as tree transformations                      | `insert.ts`     |
| Pointer → anchor, anchor → screen rectangle                                    | `hit-test.ts`   |
| Snapshot undo with tag coalescing                                              | `history.ts`    |
| The document as regions, with a memoised per-line parse                        | `line-model.ts` |
| The editability gate                                                           | `gate.ts`       |
| Measured MathML Core probe                                                     | `capability.ts` |

### The model is MathML, and that is the whole point

```ts
type MathNode = MathElement | MathText;
interface MathElement { name: ElementName; attrs: Record<string,string>; children: MathNode[] }
```

Two decisions inside that shape carry most of the weight:

- **The AST stores canonical Calcpad glyphs, never a presentation form.** `*` is stored as `*`,  
  not as `·`; `⦼` is stored as `⦼`, not as `mod`. Presentation lives in `serialize.ts` and  
  `omml.ts`. This is what makes the printer an exact inverse instead of a heuristic.
- **Names are split at the first `_` into a subscript**, because that is exactly how Calcpad  
  renders a variable: `s_1` and `A_s` are single names that *display* with a subscript. So  
  `msub` comes from names, and `^` comes from `msup` — there is no `_` operator to model.

### Round-tripping, and why the gate exists

The client keeps a second implementation of the Calcpad grammar. That is a deliberate trade —  
it buys offline editing and zero round-trip latency — and it is made safe by a **gate** rather  
than by optimism.

A line opens as a math field only when it is a **fixed point** of `parse → print → parse`: the  
two trees must be identical. Anything else is shown as source and is never rewritten.

```ts
// gate.ts
const printed  = printCalcpad(parsed.node);
const reparsed = parseCalcpad(printed);
if (!sameTree(parsed.node, reparsed.node)) return { kind: 'lossy' };
```

Three further guards follow from the same principle:

- **An empty slot has no Calcpad spelling.** `b/` re-parses as a division by whatever follows, so
  a tree containing an unfilled slot is held open and `commit` is refused. This covers an *emptied
  leaf* as well as an empty container: deleting the last character of a numerator leaves `mn('')`,
  which prints as nothing, and missing it once let a commit write `a = /2` into the document.
- **A commit must pass the gate.** `commit()` runs `isCommittableText` on the text it is about to
  write, so the write path uses the engine's own rule rather than a weaker local one. An empty
  line is allowed — clearing a line is a legitimate edit.
- **A commit that does not change what the line *means* is dropped.** Printing canonicalises
  whitespace, so comparing text would rewrite `A = 1` to `A=1` on a click with no edit. The
  comparison is `sameMeaning`, which compares the parse.

### The editor/parser invariant

The one invariant the test suite pins hardest:

```
sameTree(tree, parseCalcpad(printCalcpad(tree)))
```

after **every** edit, for every palette structure.

Two things enforce it. The first is a guard inside `applyCharacter`: the result of a keystroke is
checked against its own printed text and refused if it re-parses to a different tree. Enumerating
every way an operator can land in the wrong place is the kind of analysis that leaves a hole, so
the rule is checked rather than argued. Text that does not parse at all is left alone — `a + ` on
the way to `a + b` is a legitimate intermediate, and the commit gate keeps it out of the document.

The second is a **sweep**: the suite applies every typeable character at every caret position of a
dozen source shapes — roughly 1,700 cases — and requires each one to either keep the invariant or
be declined. The first version tested three characters at one hard-coded offset, which is how
`1a2`, `a_b` and `a!b` drifted unnoticed.

A text-only check cannot see the editor drifting from its own parser — the previous attempt
shipped palette buttons that silently did nothing because the pure dispatch layer was tested and
the component wiring was not.

---

## 3. Rendering

`serialize.ts` is the only place that decides how a node looks, and both the string form and the  
DOM form are built from the *same* `XmlElement` tree, so they cannot drift.

| Calcpad        | MathML                                       |
| -------------- | -------------------------------------------- |
| `a/b`          | `<mfrac>`                                    |
| `x^2`          | `<msup>`                                     |
| `x_1`          | `<msub>`                                     |
| `sqrt(x)`      | `<msqrt>`                                    |
| `root(x; n)`   | `<mroot>`                                    |
| `[a; b\|c; d]` | `<mrow><mo>[</mo><mtable>…<mo>]</mo></mrow>` |
| `abs(x)`       | `<mrow><mo>\|</mo>…<mo>\|</mo></mrow>`       |
| `a*b`          | `<mo>·</mo>` (display only)                  |

**Units are not guessed.** It is tempting to render every unit *symbol* upright, but `V`, `s`,  
`t` and `h` are variables far more often than they are units, and the client cannot know which  
without the engine's variable table. The one case the AST does carry is a unit *target*: in  
`x|kN/m^2` everything to the right of `|` renders upright, and everything else does not.

### Capability is measured, not sniffed

The approach rests on the host having a MathML engine, and not every target does: the desktop  
shell pins `minimumSystemVersion` to macOS 11, whose Safari has only partial MathML, and older  
WebKitGTK lacks MathML Core. So `capability.ts` typesets a fraction in a detached container and  
checks that the numerator stacks above the denominator. When the probe fails the panel says so  
and shows source instead of broken maths.

---

## 4. OMML

The writer reproduces `Calcpad.Core/Output/XmlWriter.cs` element for element, so an equation  
authored in the editor and one rendered by the engine are indistinguishable inside a `.docx`.

| Calcpad         | Emitted                                                    | C# origin                         |
| --------------- | ---------------------------------------------------------- | --------------------------------- |
| `a/b`           | `<m:f><m:num/><m:den/>`                                    | `FormatDivision`                  |
| `sqrt(x)`       | `<m:rad><m:radPr><m:degHide m:val="1"/></m:radPr>…`        | `FormatRoot("2")`                 |
| `x^2` / `x_1`   | `<m:sSup>` / `<m:sSub>`                                    | `FormatPower` / `FormatSubscript` |
| `10\|kN/m^2`    | upright run, `m:nor`, Cambria Math, `w:sz 22`              | `FormatUnitsStatic`               |
| `stress(P; A)`  | bold upright run + `(` `;` `)` runs                        | `FormatFunction`                  |
| `a*b`           | `<m:t>·</m:t>`                                             | `opRuns[4]`                       |
| `⦼` `∧` `∨` `⊕` | `mod` / `and` / `or` / `xor`, `m:nor`                      | `FormatOperator`                  |
| `[a; b\|c; d]`  | `<m:d begChr="[" endChr="]">` wrapping `<m:m>` of `<m:mr>` | `FormatMatrix`                    |

**Reading is not the inverse of writing, and the design says so.** OMML records structure, not  
the author's punctuation: a fraction is a fraction, and the precedence that produced it is gone.  
So the reader collects a container's runs back into Calcpad **text** and re-parses them, which  
re-associates them exactly the way the engine would. `a/b` therefore re-reads as `a/b`, not as  
`(a)/(b)`, and the round-trip is a fixed point rather than a bracket-accumulation.

Two reader rules exist because OMML is genuinely ambiguous:

- A `|…|` delimiter re-reads as `abs(x)`, the spelling Calcpad actually accepts — a bare `|x|`  
  is a unit target, which is why the palette never offers `|…|`.
- `∕` (U+2215) and `·` re-read as `/` and `*`, the two characters Calcpad writes for display  
  rather than for source.

---

## 5. What was measured

Run against the **249 `.cpd` files / 7,729 expression lines** in `Examples/`, with
`npx tsx scripts/report-math-corpus.ts`:

| Property                              | Result            |
| ------------------------------------- | ----------------- |
| Expression lines that parse to a tree | **76.5%** (5,912) |
| …and open as an editable field        | **76.5%**         |
| …and render to MathML                 | **76.5%**         |
| …and survive an OMML round-trip       | **69.9%**         |
| Text reproduced byte-for-byte         | 41.6%             |

The first implementation measured 71.2%. The gain came from making juxtaposition a **flat row**
rather than a left-nested one: the parser now builds the same shape the editor does, so `2x y`,
`1a2` and similar products stopped being declined.

Text fidelity is deliberately lower than tree fidelity. The printer canonicalises whitespace
(`2*x` prints as `2 * x`), and the commit path compares the parse, so a no-op commit writes
nothing. Byte equality is not the property that matters.

### What the remaining 23.5% is, and why declining is correct

| Bucket                          | Lines | Example                                         |
| ------------------------------- | ----- | ----------------------------------------------- |
| Custom unit definitions         | 963   | `.EUR = 1`                                      |
| SVG drawing calls               | 508   | `line$(-x_1; -100; -x_1; H + 100; axis_style$)` |
| Several assignments on one line | 235   | `.KB = 1000byte','.KiB = 1024byte`              |
| Input-form controls             | 111   | `a = ? {2}`                                     |

None of these is silently corrupted — each is shown as source and the source editor keeps it.
Custom-unit definitions are the largest remaining opportunity: a `.Name = expression` line is a
declaration rather than an expression, so supporting it means teaching the tokenizer a leading
dot, which is a feature rather than a bug fix. The multi-assignment bucket is the honest limit:
Calcpad records the statement boundary only in prose, so recovering it client-side would mean
guessing.

### Test suite

```
npm test                                  # 73 tests
```

| File                      | Covers                                                                                          |
| ------------------------- | ----------------------------------------------------------------------------------------------- |
| `roundtrip.test.ts`       | Every construct round-trips; precedence and brackets; the gate; shortcuts                       |
| `omml.test.ts`            | Exact strings against `XmlWriter.cs`; reader fixed point; `\|x\|` → `abs(x)`                    |
| `editing.test.ts`         | Anchors, movement, insert/delete, undo granularity, and a sweep of **every typeable character at every caret position** |
| `line-model.test.ts`      | Line classification, region grouping, the parse cache                                            |
| `vue/template-refs.test.ts` | Fails the build on a string ref inside `v-for` or an inline arrow ref                           |

---

## 6. The surface

### `CalcpadMathField.vue` — one expression

Renders the AST as native MathML, draws the caret from `anchorRect`, and maps keystrokes to tree  
transformations: arrows move structurally (numerator ↔ denominator, base ↔ exponent, matrix row  
↔ row), `/` and `^` build structures, `Ctrl+Z`/`Ctrl+Y` drive a widget-scoped history that  
coalesces a run of typing into one step. The palette inserts the same structures the keyboard  
does, through the same function.

Undo steps are tagged by operation (`type`, `structure`, `delete`, `paste`), so typing a name and
then wrapping it in a fraction are two steps rather than one, and moving the caret ends a run
without becoming a step of its own.

Clipboard is `Ctrl+C`/`X`/`V` on the whole line. It is unusually cheap here because **Calcpad text
is the storage format** — a copy writes the printed expression and a paste parses one, with no
interchange format in between. Composition events (`isComposing`) are ignored, so an IME (dead
keys for Greek, CJK) does not insert both the intermediate and the committed character.

### Click to edit

With **Click to edit** on, a formula is typeset output until it is clicked — the Mathcad and
MathType model. An idle field takes no caret, ignores the keyboard, and is not a tab stop
(`tabindex="-1"`, so a worksheet of thirty equations is not thirty tab stops). Clicking promotes
it, and the previously active one commits on blur. Turning the option off makes every equation
directly editable, which is what you want when working through a whole sheet.

### The palette

The palette is docked **once** above the worksheet and always visible, rather than repeated
beside every equation. That is not a preference: at sidebar width, thirteen structure buttons and
twenty-four symbols per equation wrap into a column beside every line and bury the maths — the
mistake the previous attempt made and documented. It sticks to the top so it stays reachable
while the worksheet scrolls, and it targets whichever equation is being edited, saying
"Click an equation to edit it" when none is.

The buttons drive the field through its exposed `applyPalette` / `insertSymbol` — the same
functions its own keyboard and palette use, so the two cannot diverge. They are `disabled` until
an equation is being edited, and the hint says so, rather than being live-looking and inert.

The palette's styles live in `base.css`, not in each component. Both the field and the panel
render these buttons, and duplicating the rule is how both copies came to share the same defect:
`color: inherit` on a `--vscode-button-secondaryBackground` fill. The inherited colour is the
sidebar's `--vscode-foreground`, which in the light theme is #616161 on #5f6a79 — **1.13:1**, so
the labels were invisible. The dark theme inherited #d4d4d4 on #3a3d41 (7.36:1), which is why the
bug only ever appeared in light and read as a missing-glyph problem rather than a colour one.
`tests/vue/component-css.test.ts` now fails on an unpaired button background.

The field instances are registered with a **stable function ref per line**, not `ref="field"` and
not an inline arrow. Both alternatives fail in ways the type checker cannot see: a string ref
inside `v-for` is collected into an array (truthy, then "is not a function" at the call site), and
an inline arrow is a new function every render, so Vue unsets it — which unregisters the field on
every commit and leaves the toolbar pointing at nothing. `tests/vue/template-refs.test.ts` fails
the build on either.

### `CalcpadLiveMath.vue` — the worksheet

Renders the document as regions: equation lines become fields, consecutive non-editable lines  
collapse into a source block. A committed edit is written back **one line at a time** through  
`onReplaceLine`, so it lands in the host's own document and on the host's own undo stack — there  
is no parallel copy to keep in step. The panel is reachable from the sidebar as **Live math**.

---

## 7. Risks

| Risk                                         | Impact                         | Mitigation                                                                                                           |
| -------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| The client bridge drifts from `Calcpad.Core` | Silent loss of coverage        | The gate declines rather than corrupts; coverage is measured on every change; the bridge is not grown without a test |
| No MathML engine on a target host            | The graphical view fails there | Measured probe, source fallback, and a visible reason — never broken maths                                           |
| A new construct passes the gate but is wrong | A rewritten line               | The gate compares trees, attributes included, and the editor/parser invariant is pinned per palette structure        |
| Two views drift                              | Document corruption            | One document model; the panel writes through the host and re-reads from it                                           |

---

## 8. References

- Calcpad language reference — `docs/quick-reference.md`, `docs/operators.md`
- OMML emitter (authoritative dialect) — `Calcpad.Core/Output/XmlWriter.cs`
- Name-character rules — `Calcpad.Core/Validator.cs`
- Operator precedence — `Calcpad.Core/Calculator/Calculator.cs` (`OperatorOrder`)
- Token classification — `Calcpad.Core/Parsers/MathParser/MathParser.Input.cs`
