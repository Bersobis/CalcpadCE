# Live editor interaction — the rules taken from the reference editor

> **Status: measured, written down as acceptance criteria, and implemented where section 4 says
> so.** This page records what the reference equation editor (iMathEQ) does with a click, a caret,
> a selection and a structure, and what that obliges our live math panel to do. Section 3 is the
> reference; section 4 is our side of it, with what is met and what is still missing.

## 1. Why a reference

The rendering engine is ours from scratch, but the *interaction* model is where a math editor is
actually judged, and it is the part that is easiest to get subtly wrong — the panel shipped a
palette that looked live and was inert, and caret movement that silently dropped keystrokes.
iMathEQ was chosen as the reference because it is the model the reviewers asked for and it is
freely inspectable.

## 2. How the rules were measured

The reference renders into a canvas (`bg_canvas` / `fore_canvas`) and reads the keyboard from a
hidden `textarea.efmase_focus_textarea`. It exposes its state through `window.editor`, which is
what made measurement possible at all:

| Call | Gives |
| ---- | ----- |
| `window.editor.getMathML()` | the whole equation, as MathML |
| `window.editor.setMathML(xml)` | install an exact fixture, so every probe starts from a known tree |
| `window.editor.hasFocus()` | whether the editor holds the keyboard |

Each probe is then: install a fixture, perform **one** interaction, type a distinctive marker
(`9`), and read the MathML back. Where the marker lands *is* the caret, so the caret needs no
screen coordinates.

Two artefacts invalidated the first rounds of probes, and both would have produced confident,
wrong rules:

- **Synthetic mouse events carry `offsetX`/`offsetY` of 0.** The editor reads those, so every
  scripted click looked like a click at the far left and reported "the caret is always at the
  start". They have to be defined onto the event (`Object.defineProperty`) before dispatch.
- **A second click inside the multi-click window selects a token.** Probing faster than the
  library's click window turned a caret placement into a selection, and typing then *replaced a
  token* — which reads exactly like "the editor rewrites your equation when you click it". Probes
  are therefore spaced by at least 200 ms, which also produced the multi-click rules in section 3.

## 3. The rules

### R1 — a click snaps to the boundary it is nearest

Fixture `abc`, clicking at a range of horizontal offsets and typing `9`:

| Click offset (px from the canvas's left edge) | Result | Caret |
| --------------------------------------------- | ------ | ----- |
| 2 … 26 | `9abc` | before `a` |
| 30 … 38 | `a9bc` | after `a`, before `b` |
| 40 … 48 | `ab9c` | after `b` |
| 52 and beyond | `abc9` | after `c` |

The left half of a glyph is *before* it, the right half *after* it, and clicks well to the left of
the first glyph clamp to the start. **Acceptance:** a click places the caret at the nearest
character boundary; the halves of a glyph are distinguished.

### R2 — a click past the content appends at the top level

Fixture `x^2`. Clicking at offset 60, 120 (baseline) or 40 px below, then typing `+`, gives

```
<msup><mi>x</mi><mn>2</mn></msup><mo>+</mo>
```

The operator is a **sibling of the power**, not content of its exponent. Clicking "after the
formula" therefore means "after the last thing on the line", even when the line ends in a
structure. **Acceptance:** the end of a line is a real position, and typing there appends to the
line's own row.

### R3 — a click inside a slot targets that slot

Fixture `1/2`, typing `9` after a click: offset `34` at `y = 8 … 22` lands in the **numerator**
(`<mfrac><mrow><mn>1</mn><mn>9</mn></mrow><mn>2</mn></mfrac>`), at `y = 45` in the
**denominator**. **Acceptance:** the click's row decides the slot.

### R4 — a slot accepts a compound expression

With the caret in the exponent of `x^2`, typing `+` then `1` gives

```
<msup><mi>x</mi><mrow><mn>2</mn><mo>+</mo><mn>1</mn></mrow></msup>
```

The same holds for a fraction's numerator, where typing `+` then `1` gives
`<mfrac><mrow><mo>+</mo><mn>1</mn></mrow><mn>2</mn></mfrac>`, and a denominator accepts
multi-token content as `<mfrac><mn>1</mn><mrow><mn>2</mn><mn>9</mn></mrow></mfrac>`. Note what is
*absent*: no bracket element, no `(`, no `)`. The slot's own wrapper (`<mrow>`) is the grouping,
because the reference's interchange is structured MathML. **Acceptance:** any slot accepts any
expression, including operators; entering an operator in a slot never blocks the next keystroke.

### R5 — an empty slot is an empty container, and survives

The palette inserts a structure whose slots are `<mrow/>` — the same representation our engine uses
for an unfilled slot. Backspace strips a slot to that state and then **stops**: a second and third
backspace leave `<mfrac><mn>1</mn><mrow/></mfrac>` unchanged. The structure is not removed by
emptying it. **Acceptance:** emptying a slot leaves a holding state; nothing is auto-deleted.

### R6 — palette insertion puts the caret in the first empty slot

A palette press inserts the empty structure and places the caret inside it, so the next keystroke
fills the first slot. Palette buttons respond to a pointer press sequence: a scripted `.click()` is
ignored, so an automated test must send `mousedown`, `mouseup` and `click`.

### R7 — navigation is structural, and Tab is part of it

From a fraction's numerator, ArrowDown types into the denominator and ArrowUp returns to the
numerator; ArrowRight and **Tab** both leave the numerator for the denominator, and the marker
lands before its content. Vertical movement keeps the horizontal position; horizontal movement and
Tab walk the slots in reading order. **Acceptance:** Up/Down move between a structure's rows,
Left/Right and Tab move to the next slot.

### R8 — selection replaces

Dragging from one character boundary to another selects that range (`abc` → drag across `bc`), and
typing replaces it outright (`abc` → `a9`). Multi-click is distinguished: a click inside the
library's multi-click window selects the token under the pointer, and the next keystroke replaces
it. **Acceptance:** a range can be selected and typing or Delete replaces it; a double-click has a
different meaning from a single click.

### R9 — grouping is never spelled with brackets

A linear chain exported from the reference stays a flat token row:

```
<mi>x</mi><mn>2</mn><mo>+</mo><mn>1</mn><mo>+</mo><mn>3</mn>
```

Structure appears only where a structure exists (`msup`, `mfrac`). This is a property of the
reference's storage, and it is the reason R4 costs it nothing.

## 4. What that obliged us to do

Our storage is Calcpad *text*, not MathML, so R2 and R4 were not free: both were unmet, and both
needed the same missing piece — a position, or a node, that the printer and the parser agree on.

| Rule | Today | Mechanism |
| ---- | ----- | --------- |
| R1 | met | the caret snaps to the nearest boundary, the halves of a glyph are distinguished (`nearestAnchor`) |
| R2 | met | a row ending in a structure has an explicit trailing position (`trailingAnchor`), the click past the content reaches it (`withRowEnd`), and insertion there nests what it follows the way the parser reads it (`appendAtRowEnd`) |
| R3 | met | a click inside a slot lands on the leaf that was clicked |
| R4 | met | an insertion that makes a slot compound gives it the group the printer already prints — `mo('(')`, the parser's own reading of the content, `mo(')')` — so the text and the tree agree and the gate accepts it (`bracketSlots`) |
| R5 | met | an unfilled slot is an empty container or an empty leaf, and `isCommittableText` refuses to write it into the document |
| R6 | met | palette presses go through the field's own `applyPalette`, and the caret follows the new structure |
| R7 | met | Up/Down are structural (`moveVertical`), Left/Right cross slots (`moveHorizontal`), and Tab/Shift+Tab walk the slots (`slotAnchors`, `nextSlot`) — at the last one the key is not intercepted, so focus leaves instead of the field trapping it (§4.3) |
| R8 | met | a range is two anchors (`orderedRange`); drag, double click, triple click and Ctrl+A select it, and typing, Backspace and Delete replace it (`deleteRange`, `replaceRange`); the browser paints it (§4.3) |
| R9 | not applicable | our interchange is linear text, so a group has to be spelled out — which is exactly what R4 now does |

Two mechanisms carry R2 and R4. **An end-of-row anchor** is a gap at `children.length` on a row
whose last child is not a leaf; `anchorRect` places it at the previous sibling's right edge, and an
insertion there groups what precedes the caret the way the parser does (`a + b + 1` nests to
`mrow[mrow[a,+,b],+,1]`, `1 + 2*3` to `mrow[1,+,mrow[2,*,3]]`), because a flat splice is refused as
a drift. **Brackets as nodes**: when an insertion makes a slot compound, the slot is given the group
the printer was already printing, and the caret is re-based into it by counting anchors — the group
adds four (`(` and `)` contribute two each) and keeps the content's order and text, so the caret's
ordinal survives the reparse that produced it.

### 4.1 Two rules our storage adds, which the reference does not need

Neither is a measurement of the reference; both follow from Calcpad text and were established
against our own parser, so each is listed with the reading that forces it.

**An operand at the row end continues the last token.** In a structured interchange, appending a
digit after a group is a new token. In text, the appended text is all there is: `a = x^2` then `1`
prints `a = x^21`, and the parser reads that exponent as `21` — so `mrow[msup[x,2], mn(1)]` would be
a tree its own printer disagrees with. The row end therefore descends to the last leaf for an
operand (`a = x^21`, `a = b^2c1`, `a = sqrt(92)`) and stays at the top level for an operator, which
is the R2 rule.

**An operator typed in a subscript belongs to the row outside it.** A subscript is one token in the
language: `q_(1+2)` parses as the name `q_` beside a group, so there is no spelling for a compound
subscript. Splitting the operator into the subscript left a tree whose printed text claimed the
operator was at the top level — `q_1 + `, with the `+` actually inside `msub`. It now leaves the
ownership and lands in the enclosing row: `q_1 + 2`, `a = q_1 * 2`, `(q_1 + 2)/2`, `x^(q_1 + 2)`.

### 4.2 Making the caret and the waiting slots visible

Three defects made parts of an equation impossible to edit, and none of them was a rule:

- **An unfilled slot was a dead zone.** Its click box was built by spreading a DOMRect, and a
  DOMRect keeps its fields on the prototype — so every coordinate was `NaN`, the candidate could
  never win, and clicking a slot placed the caret at the end of the line instead. The box is now
  copied field by field (`boxOf`).
- **The caret swallowed clicks.** It is created imperatively, so it carried no scope id and the
  component's scoped rules never matched it: it stayed an in-flow transparent block over the
  maths, `pointer-events: none` and all. Its rules go through `:deep` now, which is also why it
  finally paints as a 1.5px cursor instead of nothing.
- **The row end borrowed the whole field's height**, so it outscored every glyph for clicks that
  were not exactly on one and the caret jumped to the end of the line. Its band is the line's own
  boxes now.

A slot waiting for a value is drawn as a dashed box (`emptySlotPaths` → `.cp-math-slot`), which is
what makes R3 and R5 visible instead of a rule the editor knows and the user does not. Clicking the
box targets that slot, because its box is a candidate again.

### 4.3 Selection, and Tab as a slot walk

Both remaining rules needed a range the *tree* decides, not the DOM.

**A selection is two anchors.** `orderedRange` puts them in the caret's canonical order, so a drag
that ends before it started is the same range, and `rangeLength` counts the characters between
them. Deleting walks forward from the start with a budget: each live character removes exactly one,
and an emptied leaf is dropped without spending budget. Deleting *backward* looked simpler and was
wrong — the collapse of a slot takes the character beside it, so the loop stopped one short and
typing after the delete merged into the leftover (`q_1` replaced by `9` became `9q`).

**A selection delete keeps the operator.** Removing `b^2` from `sqrt(a^2 + b^2)` leaves
`sqrt(a^2 + )`, not `sqrt(a^2)`: the place after `+` is where the replacement goes, and without the
operator the next keystroke was refused as an unreadable row end. The same reason keeps `=` when
the whole right side of a definition is deleted.

**Tab walks slots, then gets out of the way.** `slotAnchors` collects the first position of every
structural slot — a fraction's branches, a power's base and exponent, a matrix cell — entering a
delimited group inside its bracket. Tab moves to the next, Shift+Tab to the previous, and at the
last slot `nextSlot` returns `null`, the key is left alone and focus leaves the equation. The
backwards walk steps *out of* the slot the caret is in, not to the nearest slot start behind it, or
Shift+Tab in a denominator would land on that denominator's own start.

**The browser paints the range.** It is handed to `document.getSelection` through `domPointAt` (the
inverse of `hitTest`), so the engine draws the highlight and the caret is hidden while one is up.
Drag (with a 3px threshold), double click (the token under the pointer, a scripted name whole),
triple click (the expression) and Ctrl+A choose a range; Ctrl+C/X still act on the line, because the
clipboard is Calcpad text.

The browser run caught two defects the unit tests could not. A press called `clearSelection`, which
also forgot the drag origin, so every drag collapsed to a click. And `=` was pruned like any dangling
operator, so deleting a definition's right side left `a`, where no keystroke could rebuild it.

## 5. Not verified

Kept separate so that nothing here is mistaken for a measurement:

- **Tab beyond a structure** — verified from a numerator to its denominator, back again, and out of
  the field at the last slot; a slot inside a delimited denominator is covered by unit tests only.
- **Deleting a whole structure** — Backspace was tested to the empty slot only; how the reference
  removes a structure (Delete, the palette's "Back Space", or selecting it) was not established.
- **Undo granularity** — the editor has Undo/Redo buttons (`efmase_palettebtn_disabled` when the
  stack is empty) but what constitutes one step was not probed.
- **Paste, and the multi-click token scope** — a double click selected the token under the pointer,
  but which tokens count (a number, a whole name, a bracket pair) was not determined.
- **The palette's insertion mode.** Pressing Superscript then typing `2`, `+` produced a new
  `msup` per token (`<mi>x</mi><mn>2</mn><msup><mo>+</mo><mrow/></msup>`), which reads as a
  "superscript for the next token" mode. It was not reproduced under real input, and the effect is
  consistent with the synthetic-key artefacts in section 2, so it is **not** a rule here.
