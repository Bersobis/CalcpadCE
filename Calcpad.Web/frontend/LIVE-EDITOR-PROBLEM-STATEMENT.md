# Live Editor — Problem Framing

## 1. The statement being corrected

The original phrasing was:

> "Performance is not the bottleneck. The engine converts a worksheet in milliseconds; the
> cost is DOM/MathLive rendering."

That is accurate as far as it goes, but it is framed as a *defence of the current design* —
as if the conclusion were "therefore the slowness does not matter." It also leaves an
unhelpful gap: if performance is not the issue, why does the live editor feel slow and
break so easily?

The corrected framing is the opposite of a defence. The editor **is** slow and fragile. What
is wrong is not the *magnitude* of the problem but the *diagnosis*: the cause is architectural,
not linguistic.

## 2. The reframed problem statement

> **The live editor is slow and fragile because the calculation engine is implemented twice.**
>
> The document is parsed and rendered once by `Calcpad.Core` (C#, serving the preview, PDF and
> Word output) and again by a parallel TypeScript implementation — `math/calcpad.ts` (~920
> lines) and `math/latex.ts` (~950 lines) — that exists only to drive the canvas.
>
> That duplication is the root cause. It doubles the work, forces the client to re-verify its
> own correctness on every line, multiplies the number of rendering widgets, and lets the two
> copies drift apart with nothing to catch it.
>
> The symptoms are *slowness* and *fragility*. The cause is *design duplication*. Making the
> duplicate engine faster — in TypeScript, Rust, Nim, or anything else — treats the symptom.
> Removing the duplication treats the cause.

## 3. Root cause and symptoms

| Layer | Item |
|---|---|
| **Root cause** | The engine exists twice: a client TypeScript copy and the server's C# implementation |
| **Symptom 1** | Slow — work is duplicated, per-line, and scales with document size |
| **Symptom 2** | Fragile — the two copies can disagree, and disagreement fails silently |
| **Not a cause** | TypeScript's execution speed. Ruled out below. |

## 4. Why duplication *produces* slowness

The slowness is a **consequence of the design**, not of the runtime's throughput. Four
mechanisms, all visible in the code:

1. **The work is done twice.** Every change to the document is parsed by the client for the
   canvas and by the server for the preview. The same input, two parsers, two renders.
2. **The client must verify itself, per line.** Because the TypeScript parser is not
   authoritative, `classifyLineEdit` → `checkLine` runs a full
   `parse → print → re-parse → to-LaTeX → back-to-Calcpad` cycle for **every line**, to decide
   whether that line is safe to offer for editing. This cost exists *only because* the client
   cannot trust its own parser. It is pure overhead introduced by the duplication.
3. **It runs in a `computed`, over the whole document.** `CalcpadLiveEditor.vue` builds its
   `regions` list by classifying every line. So the per-line round-trip above re-runs across
   the entire document on each change — cost that grows with the worksheet, not with what the
   user touched.
4. **One heavy widget per equation.** Each equation region instantiates its own MathLive
   `<math-field>`. A hundred-equation worksheet means a hundred editor instances. That is a
   rendering cost, but it is a *design* consequence: the client owns the editing model for
   every line, so every line must be an editor.

A faster language addresses none of these. It would make the **redundant** work faster, which
is the wrong target: mechanisms 1–3 are algorithmic, not throughput-bound.

## 5. Why duplication *produces* fragility

Fragility is the more serious symptom, because it fails quietly:

1. **Two parsers must agree, and nothing enforces it.** `math/calcpad.ts` and
   `Calcpad.Core`'s `MathParser` are independent implementations of the same language. Any
   change to one — a new function, a precedence tweak, a unit rule — must be mirrored in the
   other, by hand, or they diverge.
2. **Disagreement shows up as lost capability, not as an error.** When the copies disagree,
   nothing throws. `classifyLineEdit` simply reclassifies the line as `lossy` and the canvas
   falls back to showing raw source. The user sees a line that has quietly stopped being
   editable, with no indication that anything is wrong. This is the worst possible failure
   mode: silent, partial, and attributed to the feature rather than to a bug.
3. **Two test suites can both pass while disagreeing.** The C# engine is covered by ~54,800
   lines of tests; the TypeScript copy has its own, different suite. Green in both does not
   mean the two agree — it means each is self-consistent.

## 6. What is *not* the problem

**TypeScript is not slow, and its speed is irrelevant to this diagnosis.**

- The work being measured is parsing and printing worksheet text — small inputs, done in
  microseconds per line. V8's JIT handles this comfortably. There is no throughput problem to
  solve.
- The observed cost comes from **how many times** the work is done and **how it scales**, not
  from how fast each iteration runs. Repeating an operation twice and re-verifying it per line
  is slow in any language.
- Consequently, "port the engine to a faster language" cannot fix it. A Rust or Nim copy of a
  duplicated engine is still a duplicated engine — it would simply be a *faster duplicate*,
  while adding a third implementation to keep in sync.

This is why the language question (TypeScript vs. C# vs. Rust vs. Nim) is the wrong axis. The
axis that matters is **one engine or two**.

## 7. What this framing implies for the fix

**Correct direction — remove the duplication:**
- Make `Calcpad.Core` the single source of truth for parsing, evaluation and rendering.
- Have the canvas consume the engine's output rather than re-deriving it, so the per-line
  self-verification disappears (mechanism 2) and the classification comes from the authority
  rather than from a self-check.
- Freeze and then retire `math/calcpad.ts` and `math/latex.ts`.

**Wrong direction — speed up the duplicate:**
- Porting `math/calcpad.ts` to Rust/Nim, or optimising it in TypeScript, leaves the
  duplication intact and the drift risk intact. It optimises the redundant work instead of
  deleting it.

## 8. How to confirm the framing

The framing is falsifiable, and cheap to check:

1. **Count the round-trips.** Instrument `classifyLineEdit`/`checkLine` and confirm it runs
   once per line per document change. If that holds, mechanism 2 is real.
2. **Measure the gate's share.** Time a large worksheet with the per-line gate active and with
   it stubbed out. If a material share of the cost is the self-verification, the overhead is
   attributable to duplication rather than to rendering.
3. **Count the widgets.** Confirm one MathLive instance per equation region.
4. **Test the drift hypothesis.** Change a parsing rule in `Calcpad.Core` only, and check
   whether any test fails. If nothing fails and the canvas silently loses coverage on the
   affected lines, mechanism 5.2 is demonstrated.

If (1) and (2) show the gate is negligible and rendering dominates, the framing still holds —
the duplication remains the cause of fragility, and the slowness argument narrows to mechanism
4. The framing would only be wrong if the client parser were authoritative and no self-check
existed, which is not the case.
