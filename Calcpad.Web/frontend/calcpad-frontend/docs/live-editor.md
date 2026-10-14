# Live Editor

The live editor lets users edit Calcpad calculations directly from the rendered output rather than typing raw source. Click a symbol in a typeset equation and change it there; click outside the maths to edit the whole line's source.

## Architecture

### Data Flow

```
Host (Monaco/VS Code)          Panel (Vue)
     │                              │
     │◄──── getLiveDocument ────────┤  panel asks on mount
     │───── liveDocument ──────────►│  host sends lines + renders
     │                              │
     │◄──── liveEditLine ───────────┤  panel sends edited line
     │───── liveLineWritten ───────►│  host confirms or rejects
```

### Module Map

```
src/
├── services/
│   ├── live-document/           ← Pure logic, no framework
│   │   ├── types.ts             LiveLine, LiveDocument, RenderedLine
│   │   ├── source.ts            splitSourceLines, isLiveEditableLine
│   │   ├── render.ts            extractRenderedLines, findClosingTag
│   │   ├── matrix.ts            parseMatrixLiteral, buildMatrixLiteral
│   │   ├── document.ts          buildLiveDocument
│   │   └── index.ts             Backward-compatible barrel
│   ├── html-sanitize.ts         sanitizeRenderedHtml
│   └── scroll-anchor.ts         Scroll position preservation
│
├── vue/
│   ├── types/
│   │   └── live-editor-messages.ts   Typed message protocol
│   ├── services/
│   │   ├── math-slots.ts        Map rendered maths → source tokens
│   │   └── messaging.ts         Platform-aware message bridge
│   ├── composables/
│   │   ├── useLiveEditor.ts     Orchestrator (document + editing + slots)
│   │   ├── useLiveDocument.ts   Document sync, visible lines, active line
│   │   ├── useLineEditing.ts    Drafts, debouncing, flushing writes
│   │   ├── useSlotEditing.ts    In-place symbol editing
│   │   ├── useWriteStatus.ts    Pending / saved / error tracking
│   │   └── useRenderCache.ts    Sanitize + slot-map memoisation
│   └── components/
│       ├── CalcpadLiveEditorTab.vue   Main panel (~619 lines, was 1334)
│       ├── CalcpadMatrixWizard.vue    Matrix insertion dialog
│       └── CalcpadMathKeyboard.vue    On-screen math keyboard
```

### Composable Responsibilities

| Composable | Owns | Exposes |
|---|---|---|
| `useLiveDocument` | `lines`, `totalLines`, `editableCount`, `activeLine`, `wholeDocument` | `visibleLines`, `applyMessage`, `setActive` |
| `useLineEditing` | `drafts`, `lastSent`, `focusedLine`, write timers | `onInput`, `flushLine`, `writeImmediate` |
| `useSlotEditing` | `slotEdit`, `slotBox`, blanked piece | `open`, `commit`, `cancel`, `close` |
| `useWriteStatus` | `lineStates`, saved timers | `setState`, `resolveState` |
| `useRenderCache` | sanitize cache, slot-map cache | `getSanitized`, `getSlotMap` |
| `useLiveEditor` | Orchestrates the above + status | Unified API for the component |

### Key Design Decisions

1. **Pure services** — `live-document/` has no Vue or DOM dependency so the VS Code extension host can use it without bundling Vue.

2. **Typed messages** — The host-panel protocol is fully typed with runtime guards (`isLiveDocumentMessage`, `isLiveLineWrittenMessage`). Adding a new message type is a compile-time change.

3. **Composable separation** — Each concern (document sync, draft editing, slot editing, status, caching) has its own unit of state. The component only wires UI events to composable actions.

4. **DOM stays in the component** — Template refs, focus management, and scroll-into-view are UI concerns that remain in the Vue component rather than leaking into composables.

5. **Backward compatibility** — `src/services/live-document.ts` is replaced by a barrel file that re-exports from the new module. All existing imports continue to work.

## Message Protocol

### Host → Panel

| Type | Fields | Purpose |
|---|---|---|
| `liveDocument` | `lines: LiveLine[]`, `totalLines: number`, `editableCount: number` | Full document refresh |
| `liveLineWritten` | `line: number`, `ok: boolean`, `error?: string` | Write outcome |

### Panel → Host

| Type | Fields | Purpose |
|---|---|---|
| `getLiveDocument` | — | Request current document |
| `liveEditLine` | `line: number`, `text: string` | Replace one line |
| `goToLine` | `line: number` | Scroll editor to line |

## Testing

```bash
npm test        # Run once
npm run test:watch   # Run in watch mode
```

Tests cover:
- Source line splitting and editable detection
- Rendered HTML extraction (including void tags, nested tags, error boxes)
- Matrix literal parsing and building
- Document assembly from source + HTML
- HTML sanitisation (tags, attributes, URLs)
- Math slot tokenisation and mapping

## Bugs Fixed During Refactor

1. **`findClosingTag` depth tracking** — When nested same-tag structures were encountered, the close-tag regex advanced past unprocessed close tags, causing the parser to return `-1`. The fix resets both regex `lastIndex` values on each loop iteration.

2. **`http:` URLs treated as safe** — The `SAFE_URL` regex used `https?:` which matched both `http:` and `https:`. It now requires `https:`.

3. **`img` tag missing from sanitizer allow-list** — Plot renders use `<img>` tags, but the sanitizer dropped them. `img`, `a`, `href`, `src`, `alt`, and `title` are now allowed.

4. **Void/self-closing tag render extraction** — The original `extractRenderedLines` skipped void tags before reading `data-source-line`, so plots and tables anchored on `<img>` or `<br>` were lost. The fix reads the attribute first and captures the tag itself when it is void.

5. **Comment lines overriding block renders** — `renderedFor` forced comment lines back to raw text even when the renderer produced block content (e.g. a table). The comment special-case is removed; any line with renderer output uses it.
