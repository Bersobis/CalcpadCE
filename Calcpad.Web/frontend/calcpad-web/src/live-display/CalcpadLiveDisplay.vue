<script setup lang="ts">
import { computed, ref, watch, nextTick, onBeforeUnmount } from 'vue'
import type {
  CalcpadError,
  EditabilityCheck,
  LiveRender,
  MarkupBlock,
  PaletteAction,
  TextSelection,
} from 'calcpad-frontend'
import {
  checkGraphicallyEditable,
  checkMarkupEditable,
  commitMarkupBlock,
  markupBlockAt,
  markupBlocks,
  partialTypesetMarkup,
  singleTemplateRef,
} from 'calcpad-frontend'
import CalcpadMathPalette from './CalcpadMathPalette.vue'
import CalcpadCommandMenu from './CalcpadCommandMenu.vue'
import CalcpadMathMlEditor from './CalcpadMathMlEditor.vue'
import CalcpadRichTextEditor from './CalcpadRichTextEditor.vue'
import { findMatrixLiteral, findCallArguments, applySpans, spanText } from './live-edit'
import type { MatrixLiteral, CallArguments, Span } from './live-edit'

/**
 * The Live Display pane: one rendered block per source line, typeset by the same
 * `/api/calcpad/convert` endpoint the preview uses. The pane holds no math logic
 * of its own — it asks the host to render the whole document and shows the
 * returned markup, one row per line.
 *
 * The whole document is rendered in a single request, so a line's output is
 * always drawn from the same pass as the lines it depends on: editing `a = 5` to
 * `a = 6` updates `b = a + 1` on the next row down, with no stale result left
 * behind. Rendering a line at a time (what this pane used to do) could not
 * guarantee that without re-rendering every later line anyway.
 *
 * Editing happens in place, in one of two modes:
 *
 * - **Source** (the default) — a field per matrix cell, one per function
 *   argument, and the whole line, beside a palette of symbols and structures.
 * - **Graphical** (opt-in) — the line as typeset maths, edited through the
 *   MathML surface in `CalcpadMathMlEditor.vue`. It is offered only for a line
 *   the Calcpad bridge can round-trip, so a construct it does not model falls
 *   back to the source fields rather than being rewritten.
 *
 * Either way typing re-renders the row live, so the typeset result is visible
 * before it is committed to the document.
 */

const props = defineProps<{
  source: string
  dark?: boolean
  /**
   * Renders `source` and returns the rendered markup per line (0-based, `null`
   * where the line produced no output) plus the engine's errors. `null` for the
   * whole result means the render failed. `key` scopes request supersession, so
   * the pane's document render and its live preview cancel only their own
   * predecessors and never each other.
   */
  convert: (source: string, key: string) => Promise<LiveRender | null>
}>()

const emit = defineEmits<{
  navigate: [line: number]
  /**
   * Replace source lines `line`..`endLine` (1-based, inclusive) with `text`; the
   * row re-renders from the result. A `#markdown` block spans lines, so a commit
   * replaces the whole region rather than one line.
   */
  editLine: [line: number, text: string, endLine?: number]
}>()

// ---- rows -------------------------------------------------------------------

type RowState = 'empty' | 'pending' | 'ready' | 'source' | 'failed'

interface Row {
  text: string
  html: string
  /**
   * The rendered element itself, anchors included. The rich-text editor needs it
   * for a `#markdown` block, whose element *is* the block — reading only its
   * contents would turn a heading back into a paragraph.
   */
  block: string
  state: RowState
  /** The engine's errors for this source line, from the same render pass. */
  errors: CalcpadError[]
}

const rows = ref<Row[]>([])

function makeRow(text: string): Row {
  if (!text.trim()) return { text, html: '', block: '', state: 'empty', errors: [] }
  return { text, html: '', block: '', state: 'pending', errors: [] }
}

/** A line the engine rendered nothing for: show its source rather than a silent gap. */
function toRow(text: string, html: string | null, block: string | null, errors: CalcpadError[]): Row {
  if (!text.trim()) return { text, html: '', block: '', state: 'empty', errors }
  if (html) return { text, html, block: block ?? '', state: 'ready', errors }
  return { text, html: '', block: block ?? '', state: 'source', errors }
}

// Edits coalesce for a moment, so a burst of keystrokes costs one render.
const RENDER_DELAY_MS = 140
let renderTimer: ReturnType<typeof setTimeout> | null = null
// Incremented per request; a reply whose token is stale is dropped, so a slow
// render can never overwrite a newer one.
let renderToken = 0

function scheduleRender(): void {
  if (renderTimer) clearTimeout(renderTimer)
  renderTimer = setTimeout(() => void render(), RENDER_DELAY_MS)
}

async function render(): Promise<void> {
  renderTimer = null
  const source = props.source
  const lines = source.split('\n')
  // Keep the previous markup on screen while the new render is in flight, so
  // typing does not blank the pane; only the row texts are refreshed.
  if (rows.value.length === lines.length) {
    for (let i = 0; i < lines.length; i++) {
      if (rows.value[i].text !== lines[i]) rows.value[i] = makeRow(lines[i])
    }
  } else {
    rows.value = lines.map(makeRow)
  }
  const token = ++renderToken
  const result = await props.convert(source, 'live:document')
  if (token !== renderToken) return
  if (result === null) {
    for (const row of rows.value) if (row.state === 'pending') row.state = 'failed'
    return
  }
  // The engine reports errors against source lines, so each row can show its own.
  rows.value = lines.map((text, i) => toRow(
    text,
    result.lines[i] ?? null,
    result.blocks[i] ?? null,
    result.errors.filter(error => error.sourceLine === i + 1),
  ))
}

watch(() => props.source, () => scheduleRender(), { immediate: true })

// ---- in-place editing -------------------------------------------------------

/**
 * A viewport point a click landed on, replayed against the editing surface once
 * it renders.
 *
 * The resting row shows the server's markup — the evaluated result and all — which
 * carries no `data-path` tags, so its click position cannot be mapped to the tree
 * directly. Instead the raw point is kept and the surface is asked to resolve it
 * after mount, using the same `caretRangeFromPoint` + `data-path` mapping it uses
 * for its own clicks. That both preserves the result on the resting row and lands
 * the caret under the pointer.
 */
interface ClickPoint {
  x: number
  y: number
}

const paneEl = ref<HTMLElement | null>(null)
const editing = ref<number | null>(null)
/** The whole line as it stands in the editor; every field writes back into it. */
const editable = ref('')
/** The line the structure spans below are relative to; re-based by `refreshStructure`. */
const baseLine = ref('')
const literal = ref<MatrixLiteral | null>(null)
const call = ref<CallArguments | null>(null)
const cellValues = ref<string[][]>([])
const argValues = ref<string[]>([])
/** Where a click inside the rendered row landed, so the surface can open with the caret there. Cleared once consumed. */
const pendingPoint = ref<ClickPoint | null>(null)
/**
 * The field a palette button should write into. Tracked rather than read from
 * `document.activeElement`, because the palette's own search box can hold focus
 * when a symbol is picked — the symbol still belongs in the line, not the search.
 */
const lastField = ref<HTMLInputElement | null>(null)

function rememberField(event: FocusEvent): void {
  const el = event.target
  if (el instanceof HTMLInputElement && el.dataset.field) lastField.value = el
}

// ---- graphical mode (opt-in) ------------------------------------------------

const GRAPHICAL_STORAGE_KEY = 'calcpad.live.graphical'

/** The user's preference. Off by default, so the pane behaves as it always has. */
const graphicalPreference = ref(readGraphicalPreference())
/** True while the graphical expression has an empty slot, so it must not be committed. */
const graphicalIncomplete = ref(false)
const mathEditor = ref<InstanceType<typeof CalcpadMathMlEditor> | null>(null)

/**
 * Bind the math surface, normalising the shape Vue gives a ref inside `v-for`.
 *
 * The surface lives inside the row loop, so Vue collects its ref into an array —
 * it cannot know that only one row is ever being edited. `mathEditor.value` was
 * therefore `[instance]`: truthy, but with neither `applyPalette` nor `focus`,
 * so every palette click in graphical mode threw a TypeError and did nothing,
 * and so did the focus and click-to-caret calls that use the same ref.
 *
 * A function ref receives the instance itself and is the supported way out of
 * the array; normalising keeps it correct whichever shape arrives.
 */
function setMathEditor(el: unknown): void {
  mathEditor.value = singleTemplateRef<InstanceType<typeof CalcpadMathMlEditor>>(el)
}

function readGraphicalPreference(): boolean {
  try {
    return localStorage.getItem(GRAPHICAL_STORAGE_KEY) === '1'
  } catch {
    // Storage unavailable (private mode): fall back to the default.
    return false
  }
}

function onToggleGraphical(event: Event): void {
  const value = (event.target as HTMLInputElement).checked
  graphicalPreference.value = value
  try {
    localStorage.setItem(GRAPHICAL_STORAGE_KEY, value ? '1' : '0')
  } catch {
    // The preference simply will not persist; editing still works.
  }
  // The mode owns which fields are on screen, so re-read the line and drop the
  // completeness flag the other mode set.
  graphicalIncomplete.value = false
  refreshStructure()
  if (value) void nextTick(() => mathEditor.value?.focus())
}

/**
 * Whether the line can be opened graphically, decided once when the editor opens.
 *
 * It is deliberately *not* a computed over `editable`: a graphical edit passes
 * through states with an empty slot (`b/`), which the bridge correctly declines,
 * and recomputing would unmount the editor mid-keystroke. What matters is
 * whether the line was representable when the user asked for the mode.
 */
const editability = ref<EditabilityCheck>({ ok: false })
const useGraphical = computed(() => graphicalPreference.value && editability.value.ok)

// ---- insertion ---------------------------------------------------------------

const RECENT_STORAGE_KEY = 'calcpad.live.recentPalette'

/**
 * The insertion control is a menu, not a grid.
 *
 * 84 buttons is a good reference and a poor control: you scan it, look away from
 * the caret, and reach for the mouse. The menu opens over the surface, filters as
 * you type and inserts on Enter, and it opens on whatever this author used last.
 * The grid stays behind a "Browse" toggle for looking things up.
 */
const recentActions = ref<string[]>(readRecentActions())
const commandOpen = ref(false)
const browseOpen = ref(false)
/** Folded palette groups, owned here so reopening the editor does not unfold them. */
const collapsedGroups = ref<string[]>(['Operators', 'Relations', 'Greek'])

function readRecentActions(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

function rememberAction(id: string): void {
  recentActions.value = [id, ...recentActions.value.filter(seen => seen !== id)].slice(0, 12)
  try {
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(recentActions.value))
  } catch {
    // The order simply will not persist; insertion still works.
  }
}

/** Insert from the menu: the same path the grid uses, plus recency. */
function pickFromMenu(action: PaletteAction): void {
  applyPalette(action)
  rememberAction(action.id)
  commandOpen.value = false
}

function onEditorKeydown(event: KeyboardEvent): void {
  // Ctrl/Cmd+K opens the insertion menu wherever the caret is. The math surface
  // ignores modifier combinations, so this reaches the pane from either mode.
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    commandOpen.value = !commandOpen.value
  }
}

// ---- html / markdown editing ------------------------------------------------

const richEditor = ref<InstanceType<typeof CalcpadRichTextEditor> | null>(null)

/** The same normalisation as {@link setMathEditor}, for the same reason. */
function setRichEditor(el: unknown): void {
  richEditor.value = singleTemplateRef<InstanceType<typeof CalcpadRichTextEditor>>(el)
}
/** The markup block being edited, or null when the row is Calcpad. */
const markupBlock = ref<MarkupBlock | null>(null)
/** The author markup opened in the surface. */
const markupHtml = ref('')
/** Whether the user actually changed it. An untouched block is never rewritten. */
const markupDirty = ref(false)
/** Why a markup row cannot be edited graphically, when it cannot. */
const markupReason = ref('')

const useMarkup = computed(() => markupBlock.value !== null)

function onMarkupChange(html: string, dirty: boolean): void {
  markupHtml.value = html
  markupDirty.value = dirty
}

function clearMarkup(): void {
  markupBlock.value = null
  markupHtml.value = ''
  markupDirty.value = false
  markupReason.value = ''
}

/**
 * The rendered elements, as the markup module takes them. Deliberately `block`
 * rather than `html`: a `#markdown` block's element carries which block it was.
 */
function renderedRowHtml(): (string | null)[] {
  return rows.value.map(row => row.block || null)
}

function rowDiagnostics(index: number): { message: string; severity: string }[] {
  const errors = editing.value === index && previewState.value !== 'idle'
    ? previewErrors.value
    : rows.value[index]?.errors ?? []
  return errors.map(error => ({ message: error.message, severity: 'error' }))
}

function openEditor(index: number, point: ClickPoint | null = null): void {
  const row = rows.value[index]
  if (!row || row.state === 'empty') return
  editable.value = row.text
  editing.value = index
  lastField.value = null
  graphicalIncomplete.value = false
  pendingPoint.value = point
  clearMarkup()
  refreshStructure()
  resetPreview()

  // A line inside `#html` or `#markdown` is content, not arithmetic: it gets the
  // rich-text surface when the block can survive the round trip, and the source
  // field with a reason when it cannot.
  const sourceLines = props.source.split('\n')
  const block = markupBlockAt(markupBlocks(sourceLines), index)
  if (block) {
    const check = checkMarkupEditable(block, sourceLines, renderedRowHtml())
    if (check.ok) {
      markupBlock.value = block
      markupHtml.value = check.html ?? ''
      editability.value = { ok: false }
      void nextTick(() => richEditor.value?.focus())
      return
    }
    markupReason.value = check.reason ?? ''
  }

  editability.value = checkGraphicallyEditable(row.text)
  if (useGraphical.value) {
    void nextTick(() => {
      // The surface resolves the click point itself, using the same mapping as its
      // own clicks, so the caret lands under the pointer on the first render.
      const target = pendingPoint.value
      pendingPoint.value = null
      if (target) mathEditor.value?.seekPoint(target.x, target.y)
      else mathEditor.value?.focus()
    })
    return
  }
  // Land in the line field with the caret at the end, so the palette has a target
  // and typing extends the line. A cell click re-focuses its own field afterwards.
  focusField({ kind: 'line' }, { start: editable.value.length, end: editable.value.length })
}

/** Re-read the line's structure, so a second field still maps to real spans. */
function refreshStructure(): void {
  baseLine.value = editable.value
  const line = editable.value
  literal.value = findMatrixLiteral(line)
  if (literal.value) {
    cellValues.value = literal.value.cells.map(cells => cells.map(cell => spanText(line, cell)))
    call.value = null
    argValues.value = []
    return
  }
  call.value = findCallArguments(line)
  argValues.value = call.value ? call.value.args.map(arg => spanText(line, arg)) : []
  cellValues.value = []
}

function closeEditor(): void {
  if (useMarkup.value) {
    closeMarkupEditor()
    return
  }
  // An incomplete expression has no Calcpad spelling, so committing it would write
  // something that means less than what is on screen. Leave the editor open instead.
  if (useGraphical.value && graphicalIncomplete.value) return
  commit(editable.value)
  editing.value = null
  lastField.value = null
  graphicalIncomplete.value = false
  resetPreview()
}

/**
 * Write a markup block back, or leave the document alone.
 *
 * An untouched block is never written back. The browser normalises markup the
 * moment it parses it, so round-tripping a block the user did not touch would
 * reformat their source — an edit they never asked for.
 */
function closeMarkupEditor(): void {
  const block = markupBlock.value
  if (block && markupDirty.value) {
    const result = commitMarkupBlock(block, markupHtml.value)
    if (result.ok) {
      emit('editLine', block.startLine + 1, result.lines.join('\n'), block.endLine + 1)
    }
  }
  clearMarkup()
  editing.value = null
  resetPreview()
}

/** Escape: put the line back the way it was and leave without writing anything. */
function cancelEditor(): void {
  const index = editing.value
  if (index !== null) editable.value = rows.value[index]?.text ?? editable.value
  editing.value = null
  lastField.value = null
  graphicalIncomplete.value = false
  clearMarkup()
  commandOpen.value = false
  resetPreview()
}

function commit(newLine: string): void {
  const index = editing.value
  if (index === null || newLine === rows.value[index]?.text) return
  editable.value = newLine
  emit('editLine', index + 1, newLine)
  refreshStructure()
  resetPreview()
}

/** Enter applies the field by leaving it, so a commit runs once per edit, not twice. */
function leaveField(event: KeyboardEvent): void {
  (event.target as HTMLElement | null)?.blur()
}

/**
 * Commit when focus leaves the whole editor panel — not when it moves between
 * its own fields, which are all views of the same line.
 */
function onEditorFocusOut(event: FocusEvent): void {
  const container = event.currentTarget as HTMLElement | null
  const next = event.relatedTarget as Node | null
  if (container && next && container.contains(next)) return
  commit(editable.value)
}

// ---- field synchronisation --------------------------------------------------

// `cellValues`/`argValues` are the editable views; `editable` is derived from
// them through spans relative to `baseLine`, which `refreshStructure` re-bases
// whenever the line's shape changes. Typing a value never changes the shape, so
// the spans stay valid for the whole run of keystrokes.
function syncCells(): void {
  const shape = literal.value
  if (!shape) return
  const edits: { span: Span; text: string }[] = []
  for (let r = 0; r < shape.cells.length; r++) {
    for (let c = 0; c < shape.cells[r].length; c++) {
      const value = cellValues.value[r]?.[c]
      if (value !== undefined) edits.push({ span: shape.cells[r][c], text: value })
    }
  }
  editable.value = applySpans(baseLine.value, edits)
}

function syncArgs(): void {
  const shape = call.value
  if (!shape) return
  const edits = shape.args.map((arg, i) => ({ span: arg, text: argValues.value[i] ?? '' }))
  editable.value = applySpans(baseLine.value, edits)
}

/** True when `editable` still has the same structure the spans were taken from. */
function sameCellShape(): boolean {
  const shape = literal.value
  const next = findMatrixLiteral(editable.value)
  if (!shape || !next || shape.cells.length !== next.cells.length) return false
  return shape.cells.every((row, r) => row.length === next.cells[r]?.length)
}

function sameArgShape(): boolean {
  const shape = call.value
  const next = findCallArguments(editable.value)
  return !!shape && !!next
    && shape.args.length === next.args.length
    && shape.nameSpan.start === next.nameSpan.start
    && shape.nameSpan.end === next.nameSpan.end
}

function onLineInput(event: Event): void {
  editable.value = (event.target as HTMLInputElement).value
  // The line field can add or remove a structure, so re-read it every time.
  refreshStructure()
  schedulePreview()
}

function onCellInput(row: number, col: number, event: Event): void {
  cellValues.value[row][col] = (event.target as HTMLInputElement).value
  syncCells()
  if (!sameCellShape()) refreshStructure()
  schedulePreview()
}

function onArgInput(index: number, event: Event): void {
  argValues.value[index] = (event.target as HTMLInputElement).value
  syncArgs()
  if (!sameArgShape()) refreshStructure()
  schedulePreview()
}

// ---- live preview -----------------------------------------------------------

// Rendered from the edited line, so the row shows the typeset result while the
// edit is still uncommitted. Slower than the row's own debounce: this is a
// second render of the document, and only the editing user is waiting on it.
const PREVIEW_DELAY_MS = 220
let previewTimer: ReturnType<typeof setTimeout> | null = null
let previewToken = 0
const previewHtml = ref('')
const previewState = ref<'idle' | 'pending' | 'ready' | 'source' | 'failed'>('idle')
/** The engine's errors for the edited line, so validation tracks the preview. */
const previewErrors = ref<CalcpadError[]>([])

function resetPreview(): void {
  if (previewTimer) clearTimeout(previewTimer)
  previewTimer = null
  previewToken++
  previewHtml.value = ''
  previewErrors.value = []
  previewState.value = 'idle'
}

function schedulePreview(): void {
  if (previewTimer) clearTimeout(previewTimer)
  previewTimer = setTimeout(() => void refreshPreview(), PREVIEW_DELAY_MS)
}

async function refreshPreview(): Promise<void> {
  previewTimer = null
  const index = editing.value
  if (index === null) return
  const lines = props.source.split('\n')
  if (index >= lines.length) return
  lines[index] = editable.value
  const token = ++previewToken
  previewState.value = 'pending'
  const result = await props.convert(lines.join('\n'), 'live:preview')
  if (token !== previewToken || editing.value !== index) return
  if (result === null) {
    previewHtml.value = ''
    previewErrors.value = []
    previewState.value = 'failed'
    return
  }
  previewHtml.value = result.lines[index] ?? ''
  previewErrors.value = result.errors.filter(error => error.sourceLine === index + 1)
  previewState.value = previewHtml.value ? 'ready' : 'source'
}

// ---- palette ----------------------------------------------------------------

type FieldId =
  | { kind: 'line' }
  | { kind: 'cell'; row: number; col: number }
  | { kind: 'arg'; index: number }

function fieldKey(id: FieldId): string {
  if (id.kind === 'line') return 'line'
  return id.kind === 'cell' ? `cell:${id.row}:${id.col}` : `arg:${id.index}`
}

function parseFieldKey(key: string | undefined): FieldId | null {
  if (!key) return null
  if (key === 'line') return { kind: 'line' }
  const [kind, a, b] = key.split(':')
  if (kind === 'cell') return { kind: 'cell', row: Number(a), col: Number(b) }
  if (kind === 'arg') return { kind: 'arg', index: Number(a) }
  return null
}

function focusField(id: FieldId, selection: TextSelection, selectAll = false): void {
  const key = fieldKey(id)
  void nextTick(() => {
    const el = paneEl.value?.querySelector<HTMLInputElement>(`[data-field="${key}"]`)
    if (!el) return
    el.focus()
    lastField.value = el
    if (selectAll) {
      el.select()
      return
    }
    const start = Math.min(Math.max(selection.start, 0), el.value.length)
    const end = Math.min(Math.max(selection.end, 0), el.value.length)
    el.setSelectionRange(start, end)
  })
}

/**
 * Apply a palette button to whatever is being edited.
 *
 * In graphical mode the palette builds structures in the MathML tree at the
 * caret; otherwise it writes into the field the user was last in. The palette
 * cancels `mousedown`, so that field keeps focus and its caret is readable here.
 * With nothing focused the button appends to the whole line.
 */
function applyPalette(action: PaletteAction): void {
  if (useGraphical.value && mathEditor.value) {
    mathEditor.value.applyPalette(action)
    // The palette button took focus; hand it back so the caret stays visible.
    mathEditor.value.focus()
    return
  }

  const remembered = lastField.value
  const el = remembered?.isConnected ? remembered : null
  const id = el ? parseFieldKey(el.dataset.field) : null

  if (!el || !id) {
    const result = action.apply(editable.value, {
      start: editable.value.length,
      end: editable.value.length,
    })
    editable.value = result.text
    refreshStructure()
    focusField({ kind: 'line' }, result.selection)
    schedulePreview()
    return
  }

  const value = el.value
  const result = action.apply(value, {
    start: el.selectionStart ?? value.length,
    end: el.selectionEnd ?? value.length,
  })

  if (id.kind === 'line') {
    editable.value = result.text
    refreshStructure()
    focusField({ kind: 'line' }, result.selection)
  } else if (id.kind === 'cell') {
    if (!literal.value?.cells[id.row]?.[id.col]) return
    cellValues.value[id.row][id.col] = result.text
    syncCells()
    refreshStructure()
    focusField(id, result.selection)
  } else {
    if (!call.value?.args[id.index]) return
    argValues.value[id.index] = result.text
    syncArgs()
    refreshStructure()
    focusField(id, result.selection)
  }
  schedulePreview()
}

// ---- rendered markup --------------------------------------------------------

/**
 * The edited line typeset instantly from the local MathML tree.
 *
 * The server render is the authority — it evaluates the expression and carries
 * the result — but it is a round trip away, and waiting for it leaves the row
 * blank as you type. The tree is already local, so the *expression* can be
 * typeset with no request at all; the evaluated result then lands on top when
 * the debounced preview resolves. Editing therefore feels immediate without
 * introducing a second source of truth for the result.
 */
const localTypeset = computed(() => partialTypesetMarkup(editable.value))

/** The markup a row shows: the live preview while editing, the last render otherwise. */
function rowHtml(index: number): string {
  if (editing.value !== index) return rows.value[index]?.html ?? ''
  // The server's own render wins the moment it lands: it is the one that keeps the
  // result and the formatting consistent with the rest of the document.
  if (previewState.value === 'ready') return previewHtml.value
  // Until then, the local typeset keeps the expression on screen rather than
  // leaving the row blank or showing the stale pre-edit result.
  return localTypeset.value
}

/**
 * The server pads every rendered row with an empty cell at each end for the bracket
 * rule, so a clicked cell's column has to drop that padding to match the source.
 */
function renderedCell(target: EventTarget | null): { row: number; col: number } | null {
  const td = (target as HTMLElement | null)?.closest?.('.matrix .td')
  const tr = td?.closest('.tr')
  const rowEl = tr?.parentElement
  if (!td || !tr || !rowEl) return null
  const cells = [...tr.children]
  const pad = cells.length >= 2
    && !(cells[0].textContent ?? '').trim()
    && !(cells[cells.length - 1].textContent ?? '').trim() ? 1 : 0
  const row = [...rowEl.children].indexOf(tr)
  const col = cells.indexOf(td) - pad
  return row < 0 || col < 0 ? null : { row, col }
}

/**
 * Clicking a rendered expression opens it for in-place editing, with the caret
 * under the pointer; clicking the line number still navigates the source editor.
 */
function onRowClick(index: number, event: MouseEvent): void {
  // A rendered matrix cell routes into its own field, as before.
  const cell = renderedCell(event.target)
  if (cell) {
    if (editing.value !== index) openEditor(index)
    // Selecting the cell's text makes the first keystroke or palette pick replace it.
    focusField({ kind: 'cell', row: cell.row, col: cell.col }, { start: 0, end: 0 }, true)
    return
  }
  // Clicking the line number is the "go to source" affordance; a click anywhere
  // else in the rendered expression edits it in place.
  if ((event.target as HTMLElement | null)?.closest?.('.live-line-num')) {
    emit('navigate', index + 1)
    return
  }
  const row = rows.value[index]
  if (!row || row.state === 'empty') {
    emit('navigate', index + 1)
    return
  }
  // Already open: a click inside the surface keeps the row open and lets the
  // surface place its own caret, exactly as a click inside a text field would.
  if (editing.value === index) return
  openEditor(index, { x: event.clientX, y: event.clientY })
}

// ---- teardown ---------------------------------------------------------------

onBeforeUnmount(() => {
  if (renderTimer) clearTimeout(renderTimer)
  if (previewTimer) clearTimeout(previewTimer)
})
</script>

<template>
  <div ref="paneEl" class="live-display" :class="{ 'dark-theme': dark }">
    <div v-if="rows.length === 0" class="live-empty">Nothing to display yet.</div>
    <div v-for="(row, i) in rows" :key="i" class="live-line">
      <div
        class="live-row"
        :class="[
          row.state,
          {
            editing: editing === i,
            previewing: editing === i && previewState === 'pending',
            // Only a row with rendered output is editable in place.
            editable: row.state === 'ready' || row.state === 'source',
          },
        ]"
        :title="row.state === 'ready' || row.state === 'source'
          ? 'Line ' + (i + 1) + ' — click the expression to edit it in place, or the line number to open the source'
          : 'Source line ' + (i + 1) + ' — click to open it in the editor'"
        @click="onRowClick(i, $event)"
      >
        <span
          class="live-line-num"
          role="button"
          tabindex="-1"
          title="Open source line in the editor"
        >{{ i + 1 }}</span>
        <div class="live-line-body">
          <span v-if="row.state === 'pending'" class="live-pending">…</span>
          <span v-else-if="row.state === 'failed'" class="live-failed">—</span>
          <span v-else-if="editing === i && previewState === 'failed'" class="live-failed">
            Preview failed — the line does not render.
          </span>
          <!-- eslint-disable-next-line vue/no-v-html — rendered by the local Calcpad server -->
          <template v-else-if="rowHtml(i)"><span v-html="rowHtml(i)"></span></template>
          <!-- Nothing rendered: show the source rather than a silent gap. -->
          <span v-else class="live-source">{{ editing === i ? editable : row.text }}</span>
        </div>
        <!-- The engine's own errors for this line, from the same render pass. -->
        <span
          v-if="row.errors.length > 0"
          class="live-error-badge"
          :title="row.errors.map(e => e.message).join('\n')"
        >{{ row.errors.length }}</span>
        <button
          v-if="row.state !== 'empty'"
          class="live-edit-btn"
          :title="'Edit line ' + (i + 1) + ' in place'"
          @click.stop="editing === i ? closeEditor() : openEditor(i)"
        >✎</button>
      </div>

      <!-- In-place editor: typeset maths or source, plus the math palette. -->
      <div
        v-if="editing === i"
        class="live-editor"
        @click.stop
        @keydown="onEditorKeydown"
        @focusin="rememberField"
        @focusout="onEditorFocusOut"
      >
        <!-- An #html line or a #markdown block is content, not arithmetic: it is
             edited as rich text and written back as markup. -->
        <CalcpadRichTextEditor
          v-if="useMarkup"
          :ref="setRichEditor"
          :html="markupHtml"
          :mode="markupBlock!.mode"
          :dark="dark"
          :label="markupBlock!.mode === 'markdown' ? 'Markdown block' : 'HTML line'"
          @change="onMarkupChange"
          @finish="closeEditor"
          @cancel="cancelEditor"
        />

        <template v-else>
          <!-- Opt-in, and offered only for a line the Calcpad bridge can round-trip. -->
          <div class="live-editor-modes">
            <label
              class="live-editor-mode"
              :class="{ unavailable: !editability.ok }"
              :title="editability.ok
                ? 'Edit this line as typeset maths, structure and all'
                : 'Graphical editing is unavailable here: ' + editability.reason"
            >
              <input
                type="checkbox"
                :checked="graphicalPreference"
                :disabled="!editability.ok"
                @change="onToggleGraphical"
              />
              Graphical
            </label>
            <span v-if="!editability.ok" class="live-editor-mode-note">{{ editability.reason }}</span>
            <span v-else-if="graphicalIncomplete" class="live-editor-mode-note warn">
              Fill the empty slot to apply
            </span>
          </div>

          <p v-if="markupReason" class="live-editor-mode-note">
            Rich text is unavailable here: {{ markupReason }}. Edit the source instead.
          </p>

          <CalcpadMathMlEditor
            v-if="useGraphical"
            :ref="setMathEditor"
            v-model="editable"
            :diagnostics="rowDiagnostics(i)"
            :dark="dark"
            @update:incomplete="graphicalIncomplete = $event"
            @finish="closeEditor"
            @cancel="cancelEditor"
          />

          <template v-else>
            <input
              :value="editable"
              class="live-editor-field live-editor-line"
              data-field="line"
              title="The line's Calcpad source"
              aria-label="Line source"
              @input="onLineInput"
              @keydown.enter.prevent="leaveField"
            />

            <!-- One field per matrix cell; clicking a rendered cell lands in its field. -->
            <div v-if="literal" class="live-editor-grid">
              <div v-for="(cells, r) in cellValues" :key="r" class="live-editor-grid-row">
                <input
                  v-for="(value, c) in cells"
                  :key="c"
                  :value="value"
                  class="live-editor-field"
                  :data-field="'cell:' + r + ':' + c"
                  :title="'Row ' + (r + 1) + ', column ' + (c + 1)"
                  @input="onCellInput(r, c, $event)"
                  @keydown.enter.prevent="leaveField"
                />
              </div>
            </div>

            <!-- One field per function argument. -->
            <div v-else-if="call" class="live-editor-call">
              <span class="live-editor-name">{{ editable.slice(call.nameSpan.start, call.nameSpan.end) }}</span>
              <input
                v-for="(value, k) in argValues"
                :key="k"
                :value="value"
                class="live-editor-field live-editor-arg"
                :data-field="'arg:' + k"
                :title="'Argument ' + (k + 1)"
                @input="onArgInput(k, $event)"
                @keydown.enter.prevent="leaveField"
              />
            </div>
          </template>

          <div class="live-editor-insert">
            <button
              type="button"
              class="live-editor-insert-btn"
              title="Insert a function or structure (Ctrl+K)"
              @mousedown.prevent
              @click="commandOpen = !commandOpen"
            >Insert… <kbd>Ctrl</kbd><kbd>K</kbd></button>
            <button
              type="button"
              class="live-editor-insert-btn"
              :class="{ active: browseOpen }"
              :aria-expanded="browseOpen"
              title="Browse every symbol and structure"
              @mousedown.prevent
              @click="browseOpen = !browseOpen"
            >Browse symbols</button>
          </div>

          <div class="live-editor-insert-wrap">
            <CalcpadCommandMenu
              v-if="commandOpen"
              :recent="recentActions"
              @pick="pickFromMenu"
              @close="commandOpen = false"
            />
          </div>

          <CalcpadMathPalette
            v-if="browseOpen"
            v-model:collapsed="collapsedGroups"
            @pick="applyPalette"
          />

          <div class="live-editor-actions">
            <span class="live-editor-hint">
              {{ useGraphical
                ? 'Type maths directly; the row previews as you go.'
                : 'Click a symbol to insert it; the row previews as you type.' }}
            </span>
            <button
              class="live-editor-done"
              :disabled="useGraphical && graphicalIncomplete"
              :title="useGraphical && graphicalIncomplete ? 'Fill the empty slot first' : 'Apply the edit'"
              @click="closeEditor"
            >Done</button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style>
/* Rendered markup comes from the server, so its classes (.eq, .dvc, …) cannot be
   scoped — these rules mirror the math styles of the backend template.html under
   the .live-display namespace. */
.live-display {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 8px 0 24px;
  background: var(--vscode-editor-background, #1e1e1e);
}
.live-empty {
  padding: 16px;
  color: var(--vscode-descriptionForeground, #808080);
  font-size: var(--calcpad-font-size-sm, 12px);
}
.live-row {
  display: flex;
  align-items: flex-start;
  min-height: 1.6em;
  padding: 1px 12px 1px 0;
  line-height: 150%;
  cursor: pointer;
}
.live-row:hover {
  background: var(--vscode-list-hoverBackground, rgba(128, 128, 128, 0.12));
}
/* A row with rendered output is editable in place: outline the expression on
   hover so the click target is obvious, and hint at the pencil affordance. */
.live-row.editable .live-line-body {
  border-radius: 2px;
  outline: 1px solid transparent;
  outline-offset: 1px;
}
.live-row.editable:hover .live-line-body {
  outline-color: var(--vscode-focusBorder, #007acc);
  cursor: text;
}
.live-row.editable:hover .live-line-body::after {
  content: '✎';
  margin-left: 6px;
  color: var(--vscode-descriptionForeground, #808080);
  font-size: var(--calcpad-font-size-xs, 11px);
}
.live-row.empty {
  min-height: 1.2em;
  cursor: default;
}
.live-row.empty:hover {
  background: none;
}
.live-row.pending,
.live-row.failed {
  color: var(--vscode-descriptionForeground, #808080);
}
/* The row is the live preview while an edit is uncommitted, so it dims a touch
   until the fresh render lands — a visible cue that the markup is mid-flight. */
.live-row.previewing .live-line-body {
  opacity: 0.55;
}
.live-line-num {
  flex: 0 0 3.2em;
  padding-right: 8px;
  text-align: right;
  font-family: var(--vscode-editor-font-family, monospace);
  font-size: var(--calcpad-font-size-xs, 11px);
  line-height: 150%;
  color: var(--vscode-editorLineNumber-foreground, #6e7681);
  user-select: none;
}
/* The line number is the "open the source" target, distinct from the expression
   beside it, so it gets its own hover treatment and the pointer that says so. */
.live-row.editable:hover .live-line-num {
  cursor: pointer;
  color: var(--vscode-editor-foreground, #ccc);
  text-decoration: underline;
}
.live-line-body {
  flex: 1;
  min-width: 0;
  overflow-wrap: break-word;
}
.live-failed {
  font-style: italic;
}
/* A line the engine rendered nothing for: its source, so nothing is hidden. */
.live-source {
  font-family: var(--vscode-editor-font-family, monospace);
  font-size: var(--calcpad-font-size-sm, 12px);
  color: var(--vscode-descriptionForeground, #808080);
  white-space: pre-wrap;
}

/* ---- in-place editing ---- */
.live-line {
  display: block;
}
.live-edit-btn {
  flex: 0 0 auto;
  visibility: hidden;
  margin-left: 6px;
  padding: 0 4px;
  background: none;
  border: none;
  border-radius: 2px;
  color: var(--vscode-editorLineNumber-foreground, #6e7681);
  cursor: pointer;
  font-size: var(--calcpad-font-size-sm, 12px);
}
.live-row:hover .live-edit-btn,
.live-row.editing .live-edit-btn {
  visibility: visible;
}
.live-edit-btn:hover {
  color: var(--vscode-editor-foreground, #ccc);
  background: var(--vscode-toolbar-hoverBackground, rgba(128, 128, 128, 0.2));
}
.live-row.editing {
  background: var(--vscode-list-inactiveSelectionBackground, rgba(128, 128, 128, 0.16));
}
.live-editor {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 2px 12px 6px 3.2em;
  padding: 6px;
  border: 1px solid var(--vscode-focusBorder, #007acc);
  border-radius: 3px;
  background: var(--vscode-editorWidget-background, #252526);
}
.live-editor-grid {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.live-editor-grid-row {
  display: flex;
  gap: 2px;
}
.live-editor-call {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}
.live-editor-name {
  font-family: var(--vscode-editor-font-family, monospace);
  font-size: var(--calcpad-font-size-sm, 12px);
  color: var(--vscode-editor-foreground, #ccc);
}
.live-editor-field {
  flex: 1;
  min-width: 3.5em;
  padding: 2px 4px;
  background: var(--vscode-input-background, #3c3c3c);
  border: 1px solid var(--vscode-input-border, #3c3c3c);
  border-radius: 2px;
  color: var(--vscode-input-foreground, #ccc);
  font-family: var(--vscode-editor-font-family, monospace);
  font-size: var(--calcpad-font-size-sm, 12px);
}
.live-editor-field:focus {
  outline: none;
  border-color: var(--vscode-focusBorder, #007acc);
}
.live-editor-arg {
  flex: 0 1 auto;
  width: 8em;
}
.live-editor-line {
  width: 100%;
  box-sizing: border-box;
}
.live-editor-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.live-editor-hint {
  color: var(--vscode-descriptionForeground, #808080);
  font-size: var(--calcpad-font-size-xs, 11px);
}
.live-editor-done {
  padding: 2px 10px;
  background: var(--vscode-button-background, #0e639c);
  color: var(--vscode-button-foreground, #fff);
  border: none;
  border-radius: 2px;
  cursor: pointer;
  font-size: var(--calcpad-font-size-xs, 11px);
}
.live-editor-done:hover {
  background: var(--vscode-button-hoverBackground, #1177bb);
}
.live-editor-done:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ---- graphical mode toggle ---- */
.live-editor-modes {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

/* The insertion control: a menu you open where you are typing, with the full
   grid kept behind "Browse symbols" for looking things up. */
.live-editor-insert {
  display: flex;
  gap: 4px;
}
.live-editor-insert-btn {
  flex: 1;
  padding: 3px 8px;
  background: var(--vscode-button-secondaryBackground, #3a3d41);
  border: 1px solid transparent;
  border-radius: 2px;
  color: var(--vscode-button-secondaryForeground, #ccc);
  font-size: var(--calcpad-font-size-xs, 11px);
  cursor: pointer;
}
.live-editor-insert-btn:hover {
  background: var(--vscode-button-secondaryHoverBackground, #45494e);
  border-color: var(--vscode-focusBorder, #007acc);
}
.live-editor-insert-btn.active {
  background: var(--vscode-button-background, #0e639c);
  color: var(--vscode-button-foreground, #fff);
}
.live-editor-insert-btn kbd {
  margin-left: 2px;
  padding: 0 3px;
  border: 1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.4));
  border-radius: 2px;
  font-family: inherit;
  font-size: 9px;
}
/* Anchors the menu, which opens over whatever follows. */
.live-editor-insert-wrap {
  position: relative;
}

/* The insertion control: a menu you open where you are typing, with the full
   grid kept behind "Browse symbols" for looking things up. */
.live-editor-insert {
  display: flex;
  gap: 4px;
}
.live-editor-insert-btn {
  flex: 1;
  padding: 3px 8px;
  background: var(--vscode-button-secondaryBackground, #3a3d41);
  border: 1px solid transparent;
  border-radius: 2px;
  color: var(--vscode-button-secondaryForeground, #ccc);
  font-size: var(--calcpad-font-size-xs, 11px);
  cursor: pointer;
}
.live-editor-insert-btn:hover {
  background: var(--vscode-button-secondaryHoverBackground, #45494e);
  border-color: var(--vscode-focusBorder, #007acc);
}
.live-editor-insert-btn.active {
  background: var(--vscode-button-background, #0e639c);
  color: var(--vscode-button-foreground, #fff);
}
.live-editor-insert-btn kbd {
  margin-left: 2px;
  padding: 0 3px;
  border: 1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.4));
  border-radius: 2px;
  font-family: inherit;
  font-size: 9px;
}
/* Anchors the menu, which opens over whatever follows. */
.live-editor-insert-wrap {
  position: relative;
}
.live-editor-mode {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--vscode-editor-foreground, #ccc);
  font-size: var(--calcpad-font-size-xs, 11px);
  cursor: pointer;
  user-select: none;
}
.live-editor-mode.unavailable {
  color: var(--vscode-disabledForeground, #6e7681);
  cursor: not-allowed;
}
.live-editor-mode input {
  margin: 0;
}
.live-editor-mode-note {
  color: var(--vscode-descriptionForeground, #808080);
  font-size: var(--calcpad-font-size-xs, 11px);
}
.live-editor-mode-note.warn {
  color: var(--vscode-editorWarning-foreground, #cca700);
}
/* A count of the engine's errors for the line, with the messages on the tooltip. */
.live-error-badge {
  flex: 0 0 auto;
  align-self: center;
  margin-left: 6px;
  padding: 0 5px;
  border-radius: 8px;
  background: var(--vscode-inputValidation-errorBackground, rgba(255, 0, 0, 0.25));
  color: var(--vscode-errorForeground, #f48771);
  font-size: var(--calcpad-font-size-xs, 11px);
  cursor: help;
}

/* ---- math styles (extracted from the backend template) ---- */
.live-display .eq {
  font-family: 'DejaVu Serif Condensed', 'Century Schoolbook', 'Times New Roman', Times, serif;
  font-variant-numeric: lining-nums tabular-nums;
}
.live-display .eq var {
  color: #06d;
  padding-right: 1pt;
  padding-left: 1pt;
  font-size: 11.5pt;
}
.live-display .eq i {
  color: #086;
  font-style: normal;
  font-size: 10pt;
}
.live-display .eq b {
  font-weight: 600;
}
.live-display .eq sub {
  font-family: 'Segoe UI', 'Gill Sans', 'Gill Sans MT', 'Trebuchet MS', sans-serif;
  font-size: 85%;
  vertical-align: -18%;
}
.live-display .eq sup {
  display: inline-block;
  margin-left: 1pt;
  margin-top: -3pt;
}
.live-display .eq small {
  font-family: 'Segoe UI', 'Gill Sans', 'Gill Sans MT', 'Trebuchet MS', sans-serif;
  font-size: 70%;
}
.live-display .eq small var {
  font-family: 'DejaVu Serif Condensed', 'Century Schoolbook', 'Times New Roman', Times, serif;
  font-size: 8.5pt;
}
.live-display .eq small i {
  font-family: 'DejaVu Serif Condensed', 'Century Schoolbook', 'Times New Roman', Times, serif;
  font-size: 6pt;
}
.live-display .eq u {
  background-color: LightYellow;
}
.live-display .dvc, .live-display .dvr, .live-display .dvs {
  display: inline-block;
  vertical-align: middle;
  white-space: nowrap;
}
.live-display .dvc {
  padding-left: 2pt;
  padding-right: 2pt;
  text-align: center;
  line-height: 110%;
}
.live-display .dvr {
  text-align: center;
  line-height: 110%;
  margin-bottom: 4pt;
}
.live-display .dvs {
  text-align: left;
  line-height: 110%;
}
.live-display .dvl {
  display: block;
  border-bottom: solid 1pt black;
  margin-top: 1pt;
  margin-bottom: 1pt;
}
/* Matrix/vector result grids: the server emits .matrix > .tr > .td, with an empty
   leading/trailing cell per row carrying the brackets. Kept in step with the
   backend template, which paints those brackets black in every theme. */
.live-display .matrix {
  display: inline-table;
}
.live-display .matrix .tr {
  display: table-row;
}
.live-display .matrix .td {
  white-space: nowrap;
  padding: 0 2pt 0 2pt;
  min-width: 10pt;
  display: table-cell;
  font-size: 10pt;
  text-align: center;
}
.live-display .matrix .td:first-child,
.live-display .matrix .td:last-child {
  width: 0.75pt;
  min-width: 0.75pt;
  max-width: 0.75pt;
  padding: 0 1pt 0 1pt;
}
.live-display .matrix .td:first-child {
  border-left: solid 1pt var(--live-math-rule, black);
}
.live-display .matrix .td:last-child {
  border-right: solid 1pt var(--live-math-rule, black);
}
.live-display .matrix .tr:first-child .td:first-child,
.live-display .matrix .tr:first-child .td:last-child {
  border-top: solid 1pt var(--live-math-rule, black);
}
.live-display .matrix .tr:last-child .td:first-child,
.live-display .matrix .tr:last-child .td:last-child {
  border-bottom: solid 1pt var(--live-math-rule, black);
}
/* Bracket glyphs the server emits as [ | ] around literals and results. */
.live-display .b0,
.live-display .b1,
.live-display .c1 {
  font-family: 'Jost* Thin', sans-serif;
}
.live-display .b0 {
  font-size: 120%;
  font-weight: 400;
  padding: 0 1pt 0 1pt;
}
.live-display .b1 {
  font-size: 240%;
  margin-top: -3pt;
}
.live-display .nary {
  color: #C080F0;
  font-size: 240%;
  font-family: 'DejaVu Serif Condensed', serif;
  font-weight: 200;
  line-height: 70%;
  display: block;
  margin: 0 1pt 2.5pt 1pt;
}
.live-display .dvc.down {
  position: relative;
  top: 0.5em;
}
.live-display .dvc.up {
  position: relative;
  bottom: 0.6em;
}
.live-display .nth {
  position: relative;
  bottom: 1pt;
}
.live-display .eq small.nth {
  font-size: 70%;
}
.live-display .dvr small {
  font-size: 65%;
}
.live-display .cond {
  color: #E000D0;
}
.live-display .err {
  color: Crimson;
  background-color: #FEE;
}
.live-display .dark-theme .eq {
  color: #d4d4d4;
}
.live-display .dark-theme .eq var {
  color: #569cd6;
}
.live-display .dark-theme .eq i {
  color: #4ec9b0;
}
.live-display .dark-theme .nary {
  color: #C991F2;
}
.live-display .dark-theme .cond {
  color: #c586c0;
}
.live-display .dark-theme .err {
  color: #f48771;
  background-color: #3d2426;
}
.live-display .dark-theme .eq u {
  background-color: #3f3a26;
  color: #e8dca8;
}
.live-display .dark-theme .dvl {
  border-bottom-color: #d4d4d4;
}
.live-display.dark-theme {
  --live-math-rule: #d4d4d4;
}
</style>
