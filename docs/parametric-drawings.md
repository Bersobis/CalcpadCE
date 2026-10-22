# Parametric Drawings

A drawing is an engineering diagram — a truss, a frame, a footing — whose geometry is computed from
values instead of being typed in as fixed coordinates. It lives in a `.cdrw` sidecar next to the
worksheet, and the worksheet pulls it into the report with the `$Drawing` directive. Change a value,
recalculate, and the drawing redraws with new member lengths and dimension text.

## The directive

```calcpad
$Drawing{ "Truss Drawing/truss-example.cdrw"; L = L_w; h = h_w; n = n_panels }
```

- The first argument is the sidecar path, relative to the worksheet's own directory (or absolute,
  or using the `{project}` / `{library}` roots).
- Every further argument binds a sidecar input to a worksheet expression. Bindings are optional: a
  sidecar with sensible defaults renders on its own.
- Units are checked, not guessed. A binding in `rad` for an input declared in `m` is an error, and
  the error names the input.
- A missing sidecar or a malformed one renders a visible error in place of the drawing instead of
  aborting the whole worksheet.

The output is static inline SVG: no scripts, no external files, so it survives PDF and Word export
and the HTML export path.

## The sidecar format

One record per line, `#`-prefixed, stable ids. The reader accepts records in any order; the writer
always emits the canonical order `#drawing → #input* → #node* → #member* → #annotation* →
#dimension* → #style* → #view`.

```text
#drawing truss-example
#input L = ? {12} m
#input h = ? {3} m
#input n = ? {6} -
#node n1 (0, 0)
#node n2 (L/n, 0)
#node n3 (2*L/n, 0)
#member b1 n1 n2 group=bot
#member b2 n2 n3 group=bot
#annotation group=bot label="Bottom chord" state="In tension"
#dimension n1→n2 align=below text="a = {[L/n]:.3f} m"
#style bot stroke=#d9683f width=10
#view title="Truss Members" subtitle="Gravity load" supports=pin,roller
```

| Record | Holds |
| --- | --- |
| `#input` | A named value: `?` marks it overridable, `{...}` is the default, the trailing token is the unit. |
| `#node` | A point id and its `(x, y)` expressions. Literal numbers pin the node; expressions let it follow the inputs. |
| `#member` | A line between two nodes, placed in a style group. Length is always computed, never stored. |
| `#annotation` | A callout for a group: label plus an optional state such as "In tension". |
| `#dimension` | A measured dimension between two nodes. `text` uses `{[expr]:.3f}` placeholders, formatted with an invariant culture. |
| `#style` | Stroke colour and width per group. |
| `#view` | Title, subtitle, and support glyphs (`pin`, `roller`). |

Coordinates are in the unit the input declares — the example above is in metres. Dimensions are
always computed from the evaluated geometry, so they cannot drift out of sync with the drawing.

Supported expressions are numbers (with optional unit suffixes such as `12mm` or `90deg`),
`+ - * / ^`, brackets, unary minus, and `sin cos tan sqrt abs min max`.

## Editing by dragging

Open the worksheet in the desktop app and run it. When the rendered report contains a drawing, the
toolbar shows an **Edit** button for each sidecar. The editor loads the same SVG the report shows and
turns its node markers into draggable handles:

- Solid handles are fixed coordinates; amber handles follow an expression.
- Drag a handle to move a node. Members, dimensions, and callouts attached to it follow on the next
  redraw.
- Drag on empty canvas to rubber-band a selection; Shift+click adds a single node; Ctrl+A selects all.
- Dragging any selected node moves the whole selection and saves every moved node in one request.
- Ctrl while dragging locks the axis with the larger movement.
- Shift while dragging snaps the node to the nearest other node within about 8 screen pixels.
- Arrow keys nudge the selection by a screen pixel; Shift+arrow nudges by ten.
- The sidecar is written on every drop. The worksheet is never modified by the editor.

Dragging an expression-driven node replaces its expression with the literal you dropped it on — that
is how a computed joint is pinned. The change is immediate and has no undo: the previous expression
is gone once the drop lands, so keep the sidecar under version control.

## DXF exchange

The editor header carries **Export DXF** and **Import DXF…**.

- **Export** writes R2018 ASCII DXF in millimetres, with layers for geometry groups, callouts, and
  dimensions. Supports become polylines; dimensions and callouts are exploded into lines and text, so
  any CAD package can read the result. `$INSUNITS` is set to millimetres.
- **Import** reads `LINE`, `LWPOLYLINE`, `CIRCLE`, `ARC`, and `TEXT` entities and returns a `.cdrw`
  file with literal coordinates. It is a starting point for editing, not a live link: nothing is
  inferred about constraints, and a DXF without `$INSUNITS` is assumed to be in millimetres (the
  reader reports that assumption as a warning).

## Known limitations

- There is no constraint solver. Expressions are evaluated in declaration order, so a node cannot
  refer to another node; only to inputs and numbers.
- Dragging is destructive to expressions, and the editor has no undo stack.
- DXF import always produces literal geometry.
- A relative sidecar path needs a worksheet that exists on disk. The browser build has no document
  path, so only sidecars referenced by an absolute path can be edited there; the desktop app and the
  `$Drawing` directive itself have no such restriction.

## See also

- [Plotting](plotting.md) — the `$Plot` directive this one is modelled on.
- `Examples/Engineering/3D, Plotting, Drawing/Truss Drawing.cpd` in the repository ships with the
  sidecar shown above.
