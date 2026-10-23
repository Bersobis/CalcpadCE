# Findings: drawning / matrix integration

## What the drawning "tool" actually is in this repo
- It is a brainstorm prototype, not a running service. The brainstorm folder is `.superpowers/brainstorm/982-1792341773/` and contains:
  - `content/combination.html` — the A/B mockup dialog: an 8×8 grid with ± steppers for rows/cols, preset buttons (2×2, 3×3, 4×4, 1×3), and a live preview grid.
  - `content/matrix-dialog.html` — the fuller matrix dialog mockup.
  - `content/waiting.html` — a "direction picked, continuing in terminal" placeholder.
  - `state/server-stopped` — a JSON marker whose `reason` is `stop-server.sh`, confirming the drawning server is not running here.
- No code citations for "drawning" were found in the codebase. The matrix dialog exists only in the browser mockups.

## What Calcpad already has on the insertion side
- A real Insert sidebar tab: `Calcpad.Web/frontend/calcpad-frontend/src/vue/components/CalcpadInsertTab.vue`.
  - Symbol palette, tree view, search, and an "Insert Image" button.
  - Emits `insertText(text)` and `insertImage`.
  - `insertImage` fires `emit('insertImage')`, which the parent routes through the message bridge's `insertImage` case.
- A message-bridge insertion channel: `BaseMessageBridge` (`base.ts`) owns `_onInsertText`, handles `insertText` and `insertImage` messages, and has `pickImageSrc` / `insertImageData` for the image path.
- Image insertion uses `buildImageCommentLine(src)` → `'<img src="...">`.

## What does NOT exist yet
- Any matrix insertion path. No matrix dialog, no matrix insert item, no matrix markup convention is present in the files I read.
- Any "drawning" code in the Calcpad frontend.

## Matrix markup (RESOLVED from Setup/AI/Work/CALCPAD_LANGUAGE_REFERENCE_FOR_CLAUDE.md)
- Empty matrix creation: `matrix(m; n)` creates an empty m×n matrix.
- Literal matrix syntax: `[M11; M12; … | M21; M22; … | … | Mm1; Mm2; …; Mmn]` — elements separated by `;`, rows separated by `|`.
- Matrix element access / assignment: `A.(i; j)` — e.g. `A.(1; 1) = 5`.
- The drawning dialog's primary insert is the empty-matrix assignment form: `M = matrix(3; 4)`. Literal form is available as a future option.
- Insertion reuses the existing `insertText` channel — same as every other Insert tab item. No new message-bridge case needed for the first cut.

## Key integration question (resolved)
- The matrix dialog emits a CalcPad expression (`M = matrix(m; n)`), not an image-style comment line. Confirmed before building.

## Styling conventions to follow
- The existing Insert tab uses `--vscode-*` CSS variables and `--calcpad-font-size-*` vars. Any new dialog should match that, not the raw mockup colors.

## Surfaces likely to touch
- `CalcpadInsertTab.vue` (new button / new insert item / new section).
- `BaseMessageBridge` / the insert channel (reuse `_onInsertText`; possibly a new message case if matrix insertion needs special handling).
- New `InsertMatrixDialog.vue` (or equivalent) if we go the modal route.
- New matrix types if we go the insert-item route.
