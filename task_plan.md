# Task Plan: Integrate the drawning tool (matrix dialog) into the Calcpad sidebar Insert tab

**Goal:** Make the standalone drawning/matrix dialog a real, wired-in insertion path in the Calcpad editor, surfaced from the existing Insert sidebar tab.

**Scope boundaries (from the code I read):**
- The drawning "tool" in this repo is a brainstorm prototype — three HTML mockups plus a `server-stopped` marker — not a running service. The matrix dialog lives only in the browser mockups. No code citations found for "drawning" in the codebase, and `InsertTab` / `insertImage` / `pickImage` searches confirm the existing insertion paths.
- Calcpad already has a real Insert sidebar tab (`CalcpadInsertTab.vue`) with a symbol palette, an "Insert Image" button, and Quick Pick plumbing in the message bridge (`BaseMessageBridge`). So the integration target is that existing tab, not a brand-new app.
- There is no matrix insertion at all yet. The integration therefore adds matrix insertion as a new entry in the Insert tab — either as a new Insert Tab item (consistent with how Snippets/insert items work) or as a new dedicated button/dialog in the Insert tab's image-insert region.

**What "integrate" means here (decision, TBD with user):**
- The matrix dialog is a size-picker: pick rows × cols, see a live grid/preview, then insert. The question is whether it becomes (a) a new `InsertMatrixDialog.vue` modal launched from the Insert tab, (b) a new Insert Tab item type that opens the same dialog, or (c) a new section in `CalcpadInsertTab.vue` alongside the image-insert button. Option (a) is the narrowest first cut; option (b) is the most consistent with the existing insert-item model.
- Insertion target: the active editor at the cursor. The message bridge already has `_onInsertText` and the `insertText` event that `CalcpadInsertTab.vue` emits, so matrix insertion reuses that same channel — the dialog emits a matrix comment line, exactly like `buildImageCommentLine` does for images.

**Existing surfaces I will touch (so far, no code written yet):**
- `Calcpad.Web/frontend/calcpad-frontend/src/vue/components/CalcpadInsertTab.vue` — the sidebar tab that owns the insert UI.
- `Calcpad.Web/frontend/calcpad-frontend/src/services/message-bridge/base.ts` — owns `_onInsertText`, `handleInsertImage`, Quick Pick, and the `insertImage` / `insertText` message cases; the matrix path should reuse `_onInsertText`.
- `Calcpad.Web/frontend/calcpad-frontend/src/types/*` — new types for the matrix insert item, if we go the insert-item route.
- `Calcpad.Web/frontend/calcpad-frontend/src/vue/components/*` — new `InsertMatrixDialog.vue` (or equivalent) if we go the modal route.
- `Calcpad.Web/frontend/calcpad-web/src/App.vue` or the tab registry — only if the matrix dialog needs to be registered as a new tab/view rather than a modal.

**Non-goals (for the first integration):**
- The drawning server/backend. The brainstorm state says `server-stopped`; this integration is a frontend insertion path, not standing up the drawning service.
- Porting the mockups verbatim. The HTML mockups are design direction, not code to copy. The real implementation uses Calcpad's existing styling (`--vscode-*` vars, Calcpad font-size vars) and insertion conventions.
- A new toolbar or menu. The surface is the Insert sidebar tab only.

**Decisions made (with user):**
- Insertion route: new 'Insert Matrix…' button in the Insert tab that launches a modal dialog (`InsertMatrixDialog.vue`).
- Matrix markup form confirmed from `Setup/AI/Work/CALCPAD_LANGUAGE_REFERENCE_FOR_CLAUDE.md`:
  - Empty matrix: `matrix(m; n)` creates an empty m×n matrix. The dialog's primary insert is an assignment like `M = matrix(3; 4)`, user fills via `M.(i; j) = …`.
  - Literal matrix syntax also exists (`[M11; M12; … | M21; M22; … | …]`); available as a future option, not the first cut.
  - Matrix element access is `A.(i; j)`.
- Dialog emits through the existing `insertText` channel (same as every other Insert tab item) — no new message-bridge case for the first cut.
- Row/col bounds and presets: 1–8 grid, ± steppers, presets (2×2, 3×3, 4×4, 1×3), matching the drawning mockups. Variable name editable, default `M`.

**Phase plan:**
1. Add `InsertMatrixDialog.vue` — 8×8 grid picker, ± row/col steppers, presets (2×2/3×3/4×4/1×3), live preview, variable-name input (default `M`), Insert (emits `insertText`) + Cancel. **complete**
2. Wire the dialog into `CalcpadInsertTab.vue` — new 'Insert Matrix…' button next to 'Insert Image'; dialog as local modal state; `insertMatrix` event. **complete**
3. Wire `handleInsertMatrix` in `CalcpadApp.vue` to post `insertText`. **complete**
4. Style to match Calcpad (`--vscode-*` and `--calcpad-font-size-*` vars, not raw mockup colors). **complete**
5. Verify in the running desktop/web app: open Insert tab → 'Insert Matrix…' → pick a preset → Insert lands `M = matrix(3; 3)` at the cursor. **in_progress**

## Progress tracking:
- Phases and decisions get recorded here as they land.
- Errors go in the Errors table below.

## Errors encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| (none yet) | — | — |
