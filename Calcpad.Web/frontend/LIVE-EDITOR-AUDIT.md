# Live Editor — Bloat Audit & Refactor

Scope: `Calcpad.Web/frontend` (the shared library `calcpad-frontend` and the web editor
`calcpad-web`), with emphasis on the live (WYSIWYG) editor subsystem on the
`Experimental-Live-Editor` branch.

Baseline before any change: **13 test files, 1436 tests passing**; `tsc --noEmit` clean;
`vite build` clean.

Verification after every change: `tsc --noEmit` clean, **1436/1436 tests passing**,
`vite build` clean.

> Note: four files already had uncommitted work on this branch before the audit began
> (`CalcpadEquationTab.vue`, `CalcpadLiveEditor.vue`, `CalcpadMathToolbar.vue`,
> `tests/mathField.test.ts`). Those edits were left untouched and are **not** part of
> this changelog.

---

## 1. Changes applied

### 1.1 Extracted the context-menu lifecycle into one composable

**Problem.** Three sidebar tabs each carried a byte-for-byte copy of the same
right-click-menu lifecycle: a `contextMenu` ref, a `closeContextMenu`, an
`onDocumentInteraction` handler with the same `Escape` guard, and the same
`onMounted` / `onBeforeUnmount` document-listener wiring. Only the payload differed
(`{ error }`, `{ node }`, `{ name, definition }`).

Detected by a duplicate-block scan (contiguous ≥12-line identical runs across files):

| File | Duplicated block |
|---|---|
| `vue/components/CalcpadErrorsTab.vue` | `closeContextMenu` / `onDocumentInteraction` / mount wiring |
| `vue/components/CalcpadFilesTab.vue` | same |
| `vue/components/CalcpadVariablesTab.vue` | same |

**Change.** Added `src/vue/composables/context-menu.ts` exporting
`useContextMenu<T>()`, which owns the ref, the open/close pair and the document
listeners. The generic `T` is the menu's payload; the anchor (`x`,`y`) is added by the
composable, so templates keep reading `contextMenu.error`, `contextMenu.node`,
`contextMenu.name` unchanged.

Each tab now keeps only its own payload-building wrapper (the part that genuinely
differs) and delegates the rest:

```ts
const { contextMenu, openContextMenu: openAt, closeContextMenu } =
  useContextMenu<{ error: CalcpadError | null }>()

const openContextMenu = (e: MouseEvent, error: CalcpadError | null) => openAt(e, { error })
```

**Removed/merged.** ~54 lines of triplicated listener lifecycle deleted; the
`VariableContextMenu` / `ContextMenuState` interfaces (and the now-unused `ref`,
`onMounted`, `onBeforeUnmount` imports) dropped from the three tabs. The menu *markup*
stays in each component on purpose — its `@mousedown.stop` is what stops a click on a
menu item from reaching the document listener and closing the menu before the item's own
click handler runs.

### 1.2 Extracted the localStorage-backed collapse state into one composable

**Problem.** `CalcpadExportTab.vue` and `CalcpadSettingsTab.vue` each contained the same
~15-line cycle: read a `STORAGE_KEY` from `localStorage`, `reactive` parse into a record,
deep-`watch` it back to storage, then expose `isCollapsed` / `toggle`. Only the storage
key differed (`calcpad.export.collapsed` vs `calcpad.settings.collapsed`).

**Change.** Added `src/vue/composables/persistent-collapse.ts` exporting
`usePersistentCollapse(storageKey)`. Both tabs now read:

```ts
const { collapsed, isCollapsed, toggle } = usePersistentCollapse('calcpad.export.collapsed')
```

**Removed/merged.** ~30 lines of duplicated persistence logic removed; the now-unused
`reactive` import dropped from `CalcpadExportTab.vue` (Settings still uses `reactive`
elsewhere, so its import is unchanged). Behaviour is identical, including the
corrupt/unavailable-storage fallbacks.

### 1.3 Removed three dead narrowing helpers from the math AST module

**Problem.** `src/math/mathjson.ts` exported `isNumber`, `isIdentifier` and `isText`.
A repository-wide reference scan (frontend library, web editor, VS Code extension, tests
and scripts) found **zero** references — not even inside `mathjson.ts` itself. They were
never adopted; the module's own comment called them optional ("`node.type` alone is
enough").

**Change.** Deleted all three (13 lines). `isOperator` and `childrenOf` are genuinely
used and were kept; the `MathNumber` / `MathIdentifier` / `MathText` **types** remain
part of the `MathJSON` union.

### 1.4 Removed two unused npm dependencies

**Problem.** `calcpad-web/package.json` declared `@tauri-apps/plugin-log` and
`@tauri-apps/plugin-process` as runtime dependencies, but no `.ts` / `.vue` / `.mjs` /
`.js` file in the monorepo imports either package. The desktop shell uses the
corresponding **Rust** crates (`tauri-plugin-log`, `tauri-plugin-process` in
`src-tauri/Cargo.toml`); the JS binding packages were never wired up.

**Change.** Removed both from `dependencies` in `package.json` **and** the matching
`packages` + `node_modules/@tauri-apps/*` entries from `package-lock.json` (kept in
sync so `npm ci` stays valid; both files re-validated as JSON).

---

## 2. Findings identified but **not** changed (recommended, prioritised)

These are real, but each is either a product decision or carries a visual/API risk that
should not be taken without the maintainer's sign-off.

### P1 — Unreachable OMML/XML subsystem (~700 source lines + ~280 test lines)

`src/math/omml.ts` (445 lines) and `src/math/xml.ts` (252 lines) have **no runtime
consumer anywhere**. The only references are:

- `src/index.ts` (barrel re-export), and
- `tests/ommlCompat.test.ts` (its own test).

`xml.ts` is imported only by `omml.ts`; `omml.ts` is imported only by `index.ts` and the
test. The OMML writer deliberately mirrors the **backend's**
`Calcpad.Core/Output/XmlWriter.cs`, so Word/`.docx` export is already served server-side
via `Calcpad.OpenXml` — the frontend copy is a parallel implementation with no caller.

It is tree-shaken out of every runtime bundle, so it costs **no** bytes at runtime; it
costs source-tree weight and a false sense that OMML generation lives in the frontend.

*Recommended action (not applied — deleting a documented, unit-tested capability is a
product call):* remove `src/math/omml.ts`, `src/math/xml.ts`, `tests/ommlCompat.test.ts`,
and the OMML/XML export blocks in `src/index.ts` (lines 377–400). With `omml.ts` gone,
`normalize()` in `mathjson.ts` also becomes dead.

### P2 — `.search-input` CSS duplicated three times

Identical ~14-line rule in `CalcpadInsertTab.vue`, `CalcpadVariablesTab.vue` and
`CalcpadSettingsTab.vue` (Settings differs only by `flex: 1` instead of `width: 100%`).
`base.css` already has a "Common input styles" section (`.input`) that is the natural
home.

*Why not applied:* these are `<style scoped>` blocks, and consolidating them into the
global `base.css` changes selector scope. Without a visual-regression pass, the
`width: 100%` vs `flex: 1` difference on the Settings field is a layout risk not worth
taking blind. Suggested: add `.search-input` to `base.css` next to `.input`, drop it
from Insert and Variables, and leave only `flex: 1` scoped in Settings.

### P3 — Public barrel exports with no consumer

`src/index.ts` re-exports ~30 non-type symbols that no consumer in the monorepo
references (examples: `tokenize`, `isUnitName`, `parseDialect`, `classify`,
`decodeEntities`, `isElement`, `XmlParseError`, `readUiOverrides`,
`formatCrashReportPayload`, `hasPathRootToken`, `scanSourceDefinitions`,
`buildParameterSnippet`, `buildParameterizedDoc`, `settingsDirectiveOnLine`,
`analyzeMetadataLine`). Several are also exported with an unnecessary `export` while
being used only inside their own module (`isUnitName`, `tokenize`, `CommitVerdict`).

`parseDialect` in particular is **never called at all** — not internally, not by any
consumer — yet is part of the public API.

*Why not applied:* `calcpad-frontend` is a published-style shared library consumed by
three frontends; trimming its public surface is an API decision, not a cleanup. Worth a
dedicated pass with `ts-prune`/`knip` in CI.

### P4 — Main bundle size (observation)

`vite build` reports the main chunk at ~4.57 MB (~1.20 MB gzip), and Vite warns about
chunks > 500 kB. This is dominated by `monaco-editor` and `mathlive`, both eagerly
imported in `main.ts`. The live editor only needs `mathlive` once the canvas is used.

*Suggested:* lazy-load `mathlive` (dynamic `import()`) behind the live-editor toggle and
split Monaco language workers further. This is a load-time win, not a code-bloat win, so
it was left as a recommendation.

---

## 3. What was deliberately left alone

- **`calcpad-web/src` duplicate-block scan: 0 hits.** The editor shell
  (`main.ts`, `App.vue`, `services/*`, `editor/*`) was refactored into managers in a
  recent commit and shows no large duplicated blocks. Nothing to consolidate there.
- **Shared-lib / app "duplicate" file names are not duplication.**
  `calcpad-frontend/src/text/auto-indent.ts` (pure logic) vs
  `calcpad-web/src/editor/auto-indent.ts` (Monaco adapter), and the same for
  `quick-type` / `operators`, are a deliberate two-layer split — pure logic in the shared
  library, editor-specific wiring in the app. Left as is.
- **The live-editor math/Vue subsystem is genuinely tight.** `CalcpadMathField.vue`,
  `CalcpadLiveEditor.vue` and `CalcpadMathToolbar.vue` already centralise state sensibly
  (one docked toolbar driven by a `shallowRef` handle; `isTarget` watch ordering handled
  explicitly). No redundant state paths were found to remove.

---

## 4. Net effect

| Change | Effect |
|---|---|
| Context-menu composable | 1 source of truth; ~54 duplicated lines removed |
| Persistent-collapse composable | 1 source of truth; ~30 duplicated lines removed |
| Dead narrowing helpers | 3 dead exports / 13 lines removed |
| Unused npm deps | 2 runtime deps removed (package.json + lockfile) |

No hot-path work was added: both composables run once at component setup, and the
context-menu listeners are registered once per tab mount exactly as before. No feature
was removed — every refactor is behaviour-preserving, confirmed by the unchanged
1436-test suite, a clean `tsc`, and a clean production build.
