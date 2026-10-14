# Live Editor Architecture Analysis

## Scope

The live editor feature spans **8 files, ~2,300 lines**:

| File | Lines | Role |
|------|-------|------|
| `src/vue/components/CalcpadLiveEditorTab.vue` | 1,334 | Main component — document list, editing, slot editing, messaging |
| `src/vue/components/CalcpadMatrixWizard.vue` | ~370 | Matrix insertion dialog |
| `src/vue/components/CalcpadMathKeyboard.vue` | ~520 | On-screen math keyboard |
| `src/services/live-document.ts` | 264 | Source splitting, render extraction, matrix parsing |
| `src/services/html-sanitize.ts` | 185 | HTML sanitizer for rendered output |
| `src/services/scroll-anchor.ts` | 449 | Scroll position preservation |
| `src/vue/services/math-slots.ts` | 307 | Rendered-to-source token mapping |
| `src/vue/services/messaging.ts` | 95 | Platform-aware message bridge |

## Critical Issues

### 1. God Component (1334 lines)

`CalcpadLiveEditorTab.vue` mixes:
- Template rendering and DOM ref management
- Document state synchronization via messages
- Draft text editing with debouncing
- In-place slot editing with DOM measurement
- Write status tracking (pending/saved/error)
- Keyboard open/close coordination
- Wizard integration
- Scroll management
- Caching (sanitize + slot)

**Impact**: Changes to any subsystem require understanding the whole file. Testing requires mounting the full component. Reuse is impossible.

### 2. No Composables Extraction

All reactive logic lives inline. Patterns that should be composables:
- Document sync → `useLiveDocument`
- Draft editing + debouncing → `useLineEditing`
- Slot editing + positioning → `useSlotEditing`
- Write status tracking → `useWriteStatus`
- Cache management → `useRenderCache`

### 3. Mixed-Concern Service

`live-document.ts` bundles:
- Source line splitting (`splitSourceLines`)
- Rendered HTML extraction (`extractRenderedLines`)
- Matrix literal parsing (`parseMatrixLiteral`, `buildMatrixLiteral`)
- Live document assembly (`buildLiveDocument`)

These have no natural coupling. Extracting them into a module with focused files improves testability and discoverability.

### 4. Untyped Message Protocol

Message handlers use `any`:
```ts
function applyLiveDocument(message: any): void
function onLineWritten(message: any): void
```

No compile-time safety for the host-panel contract. Adding a message type definition would catch mismatches at build time.

### 5. Performance Bottlenecks

- `visibleLines` computed filters the entire array on every reactive change
- `slotMapFor(line)` is called from template, click handler, and keyboard navigation — no per-line memoization
- `backdropFor(line)` called on every render for every visible line
- `renderedFor(line)` sanitizes HTML on first access but the cache is global, not per-line
- No virtualization: a 500-line document renders 500 DOM nodes

### 6. Error Handling Gaps

- `applyLiveDocument` validates only `Array.isArray(message?.lines)`
- DOM queries (`querySelector('[data-ms-slot="..."]')`) fail silently
- No error boundary around the component
- `sanitizeRenderedHtml` could throw on malformed HTML — no try/catch

### 7. State Scattered Across Independent Refs

14 separate reactive values manage what should be a coherent editing state:
`lines`, `totalLines`, `editableCount`, `activeLine`, `focusedLine`, `drafts`, `lastSent`, `editingLine`, `slotEdit`, `slotBox`, `lineStates`, `status`, `statusIsError`, `wholeDocument`

These can drift out of sync because there is no single source of truth.

### 8. Zero Test Coverage

No test framework installed. No unit tests for `extractRenderedLines`, `annotateSlots`, `buildLiveDocument`, or the component.

## Refactor Strategy

### Phase A — Modularize `live-document.ts`

Split into:
- `live-document/types.ts` — `LiveLine`, `LiveDocument`, `RenderedLine`
- `live-document/source.ts` — `splitSourceLines`, `isLiveEditableLine`
- `live-document/render.ts` — `extractRenderedLines`, `findClosingTag`
- `live-document/matrix.ts` — `parseMatrixLiteral`, `matrixLiteralRange`, `buildMatrixLiteral`
- `live-document/document.ts` — `buildLiveDocument`
- `live-document/index.ts` — backward-compatible re-exports

### Phase B — Extract Composables

Create `src/vue/composables/`:
- `useLiveDocument.ts` — message handling, document sync, `applyLiveDocument`
- `useLineEditing.ts` — drafts, debouncing, `writeLine`, `flushLine`
- `useSlotEditing.ts` — slot edit state, positioning, commit/cancel/move
- `useWriteStatus.ts` — line state tracking (pending/saved/error), timers
- `useLiveEditor.ts` — orchestrator that wires the above together

### Phase C — Type the Message Protocol

Add `src/vue/types/live-editor-messages.ts`:
- `LiveDocumentMessage`
- `LiveLineWrittenMessage`
- `LiveEditLineMessage`
- `GetLiveDocumentMessage`
- `GoToLineMessage`

### Phase D — Component Refactor

Reduce `CalcpadLiveEditorTab.vue` to ~300 lines:
- Template (unchanged structure)
- Import composables
- Wire UI events to composable actions
- Minimal local state for UI-only concerns (keyboard open, wizard open)

### Phase E — Tests and Documentation

Add Vitest as dev dependency. Write tests for:
- `extractRenderedLines` (void tags, nested tags, error boxes)
- `annotateSlots` (token matching, wrapping)
- `buildLiveDocument` (line splitting, editable detection)
- `parseMatrixLiteral` / `buildMatrixLiteral`
- `sanitizeRenderedHtml`

Add comprehensive JSDoc to all public APIs.
