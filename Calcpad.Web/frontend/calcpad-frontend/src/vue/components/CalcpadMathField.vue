<!--
  CalcpadMathField — a WYSIWYG math field for Calcpad source.

  There is no editor per equation and no layout engine: the AST is typeset by the browser's
  own MathML engine, the caret is an anchor in that tree, and every keystroke is a pure
  function from the tree to a new tree. Calcpad text remains the value that crosses the
  boundary, so the host's document stays the single source of truth.
-->
<template>
  <div class="cp-math-field" :class="{ 'is-readonly': !editable, 'is-empty': empty }">
    <div
      ref="surface"
      class="cp-math-surface"
      :class="{ 'is-focused': focused, 'is-idle': !isActive }"
      :tabindex="tabIndex"
      role="math"
      :aria-label="modelValue"
      :aria-readonly="!isActive"
      @mousedown="onPointerDown"
      @mousemove="onPointerMove"
      @keydown="onKeydown"
      @focus="onFocus"
      @blur="onBlur"
    ></div>

    <div v-if="hint" class="cp-math-hint">{{ hint }}</div>

    <CalcpadMatrixDialog
      v-if="matrixDialogOpen"
      @insert="insertMatrix"
      @cancel="matrixDialogOpen = false"
    />

    <!-- Always visible while the field is editable. Hidden when the host supplies its own
         toolbar (the Live math panel docks one above the worksheet instead of per equation). -->
    <div v-if="editable && showPalette" class="cp-math-palette" @mousedown.prevent>
      <button
        v-for="structure in structures"
        :key="structure.id"
        class="cp-math-key"
        :title="structure.title"
        @click="applyPalette(structure.id)"
      >{{ structure.label }}</button>
      <span class="cp-math-divider"></span>
      <button
        v-for="symbol in symbols"
        :key="symbol"
        class="cp-math-key"
        :title="symbol"
        @click="insertSymbol(symbol)"
      >{{ symbol }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import CalcpadMatrixDialog from './CalcpadMatrixDialog.vue';
import {
    Anchor, AnchorRange, History, MathNode, PALETTE_SYMBOLS, PATH_ATTR, STRUCTURES, StructureId,
    PaletteEntry, anchorRect, applyCharacter, applyPaletteEntry, charEntryFor, deleteBackward,
    deleteForward, deleteRange, domPointAt, el, emptySlotPaths, firstAnchor, hasEmptySlot, hitTest,
    isCommittableText, isEmptyRange, lastAnchor, matrixEntry, moveHorizontal, moveVertical,
    nextSlot, orderedRange, parseCalcpad, printCalcpad, renderMathMl, replaceRange, sameAnchor,
    stretchMatrixFences, structureEntry, tokenRange, wholeRange,
} from '../../math';

/** Undo steps are tagged by what the user did, so a run of typing is one step and a structure is another. */
type EditTag = 'type' | 'structure' | 'delete' | 'paste';

const STRUCTURE_OPENERS = new Set(['/', '^', '(', '[']);

const props = withDefaults(defineProps<{
    modelValue: string;
    editable?: boolean;
    /** Draw the field's own palette below it. Off when the host docks a shared toolbar. */
    showPalette?: boolean;
    /**
     * Mathcad-style click-to-edit: the formula is typeset output until it is clicked, and only
     * the active field takes the caret and the keyboard.
     */
    clickToEdit?: boolean;
    /** With `clickToEdit`, whether this is the field the user is working on. */
    active?: boolean;
}>(), {
    editable: true,
    showPalette: true,
    clickToEdit: false,
    active: true,
});

const emit = defineEmits<{
    (e: 'update:modelValue', value: string): void;
    (e: 'commit', value: string): void;
    /** True while the field holds an edit that has not been written to the document yet. */
    (e: 'dirty', value: boolean): void;
    /** The user clicked this field — the host promotes it to the active one. */
    (e: 'activate'): void;
}>();

const surface = ref<HTMLElement | null>(null);
const tree = ref<MathNode | null>(null);
const anchor = ref<Anchor | null>(null);
const focused = ref(false);
const hint = ref('');
const empty = ref(true);
/** The matrix size dialog, opened by its palette entry and closed by inserting or cancelling. */
const matrixDialogOpen = ref(false);
/** The dragged or Shift-extended range. `null` is the ordinary caret. */
const selection = ref<AnchorRange | null>(null);

let dragOrigin: { x: number; y: number; anchor: Anchor } | null = null;
let dragMoved = false;

const structures = STRUCTURES;
const symbols = PALETTE_SYMBOLS;

/** In click-to-edit mode an inactive field is typeset output: no caret, no keyboard, no tab stop. */
const isActive = computed(() => !props.clickToEdit || props.active);
// `-1` rather than omitting the attribute: an idle field is still clickable, it just cannot be
// reached with Tab, so a worksheet of thirty equations is not thirty tab stops.
const tabIndex = computed(() => (!props.editable ? -1 : isActive.value ? 0 : -1));

interface Snapshot { node: MathNode; anchor: Anchor }
const history = new History<Snapshot>(120);

let caretElement: HTMLElement | null = null;

/** The text the tree currently stands for — what a commit would write. */
const text = computed(() => (tree.value ? printCalcpad(tree.value) : props.modelValue));

function parse(source: string): MathNode | null {
    const result = parseCalcpad(source);
    return result.ok && result.node ? result.node : null;
}

onMounted(() => {
    caretElement = document.createElement('span');
    caretElement.className = 'cp-math-caret';
    surface.value?.appendChild(caretElement);
    window.addEventListener('mouseup', onPointerUp);
    syncFromValue(props.modelValue);
});

onBeforeUnmount(() => {
    caretElement = null;
    window.removeEventListener('mouseup', onPointerUp);
});

// Leaving the active field takes the caret with it, so an idle worksheet shows no cursor at all.
watch(isActive, (value) => {
    if (value) return;
    focused.value = false;
    clearSelection();
    if (caretElement) caretElement.style.display = 'none';
});

watch(() => props.modelValue, (value) => {
    // Only adopt an external change when it is not the echo of our own edit.
    if (tree.value && printCalcpad(tree.value) === value) return;
    syncFromValue(value);
});

function syncFromValue(source: string): void {
    clearSelection();
    const parsed = parse(source);
    tree.value = parsed;
    empty.value = parsed === null;
    hint.value = parsed ? '' : 'Not a math expression — shown as source.';
    anchor.value = parsed ? firstAnchor(parsed) : null;
    if (parsed && anchor.value) history.reset({ node: parsed, anchor: anchor.value });
    emit('dirty', false);
    paint();
}

function paint(): void {
    const host = surface.value;
    if (!host) return;
    while (host.firstChild) host.removeChild(host.firstChild);
    if (caretElement) host.appendChild(caretElement);

    if (!tree.value) {
        const placeholder = document.createElement('span');
        placeholder.className = 'cp-math-placeholder';
        placeholder.textContent = props.modelValue;
        host.insertBefore(placeholder, caretElement);
        return;
    }
    const math = renderMathMl(tree.value, document);
    host.insertBefore(math, caretElement);
    markEmptySlots(math);
    void nextTick(redraw);
}

/** Both overlays follow a render: the caret, and the browser selection that paints the range. */
function redraw(): void {
    // Matrix brackets first: the caret measures rects, and a fence that has not been scaled to
    // its table yet would leave the caret measuring a glyph-height box.
    stretchMatrixFences(surface.value);
    placeCaret();
    paintSelection();
}

/**
 * Draw a box where a slot is waiting for a value, the way a graphical editor shows an insertion
 * point: an unfilled slot renders as nothing, so without this it is invisible and unclickable.
 */
function markEmptySlots(math: Element): void {
    if (!tree.value) return;
    for (const path of emptySlotPaths(tree.value)) {
        math.querySelector(`[${PATH_ATTR}="${path.join('.')}"]`)?.classList.add('cp-math-slot');
    }
}

function placeCaret(): void {
    const host = surface.value;
    if (!host || !anchor.value || !caretElement) return;
    // A visible range hides the caret: a cursor inside a highlight reads as two positions.
    if (!focused.value || !isActive.value || selection.value) {
        caretElement.style.display = 'none';
        return;
    }
    const rect = anchorRect(host, anchor.value);
    if (!rect) {
        caretElement.style.display = 'none';
        return;
    }
    const hostRect = host.getBoundingClientRect();
    caretElement.style.display = 'block';
    caretElement.style.left = `${rect.left - hostRect.left + host.scrollLeft}px`;
    caretElement.style.top = `${rect.top - hostRect.top + host.scrollTop}px`;
    caretElement.style.height = `${Math.max(rect.height, 14)}px`;
}

function onPointerDown(event: MouseEvent): void {
    if (!props.editable || event.button !== 0) return;
    const host = surface.value;
    if (!host || !tree.value) return;
    // The browser's own text selection would fight the one the tree decides, and the press is
    // what promotes an idle field — so it is handled here rather than on `click`.
    event.preventDefault();
    emit('activate');
    void nextTick(() => { focused.value = true; host.focus(); });

    if (event.detail >= 2) {
        // Double click takes the token under the pointer, triple click the whole expression.
        selection.value = event.detail === 2
            ? tokenRange(tree.value, hitTest(tree.value, host, event.clientX, event.clientY))
            : wholeRange(tree.value);
        if (isEmptyRange(selection.value)) selection.value = null;
        anchor.value = (selection.value ?? { from: anchor.value, to: anchor.value }).to;
        dragOrigin = null;
        void nextTick(redraw);
        return;
    }

    // The drag origin is remembered *after* the selection is cleared: `clearSelection` is what
    // makes the press a fresh start, and it also forgets any drag in progress.
    clearSelection();
    anchor.value = hitTest(tree.value, host, event.clientX, event.clientY);
    dragOrigin = { x: event.clientX, y: event.clientY, anchor: anchor.value };
    dragMoved = false;
    void nextTick(redraw);
}

function onPointerMove(event: MouseEvent): void {
    if (!dragOrigin || !props.editable) return;
    const host = surface.value;
    if (!host || !tree.value) return;
    // A few pixels of travel is a click that shook, not a drag.
    if (!dragMoved) {
        if (Math.abs(event.clientX - dragOrigin.x) < 3 && Math.abs(event.clientY - dragOrigin.y) < 3) return;
        dragMoved = true;
    }
    const focus = hitTest(tree.value, host, event.clientX, event.clientY);
    anchor.value = focus;
    selection.value = sameAnchor(focus, dragOrigin.anchor)
        ? null
        : orderedRange(tree.value, dragOrigin.anchor, focus);
    void nextTick(redraw);
}

function onPointerUp(): void {
    if (!dragOrigin) return;
    dragOrigin = null;
    if (selection.value && isEmptyRange(selection.value)) selection.value = null;
    if (selection.value) anchor.value = selection.value.to;
    void nextTick(redraw);
}

/** Hand the range to the browser, which paints it; the caret is ours only because nothing else was. */
function paintSelection(): void {
    const host = surface.value;
    const range = selection.value;
    if (!host || !range || !focused.value || !isActive.value) return;
    const view = host.ownerDocument?.defaultView;
    const start = domPointAt(host, range.from);
    const end = domPointAt(host, range.to);
    if (!view || !start || !end) return;
    const native = host.ownerDocument.createRange();
    native.setStart(start.node, start.offset);
    native.setEnd(end.node, end.offset);
    const chosen = view.getSelection();
    if (!chosen) return;
    chosen.removeAllRanges();
    chosen.addRange(native);
}

function clearNativeSelection(): void {
    surface.value?.ownerDocument.defaultView?.getSelection()?.removeAllRanges();
}

function clearSelection(): void {
    selection.value = null;
    dragOrigin = null;
    dragMoved = false;
    clearNativeSelection();
}

/** Focus can arrive without a click (Tab, or a host calling `focus()`), so the caret is drawn here too. */
function onFocus(): void {
    if (!isActive.value) return;
    focused.value = true;
    void nextTick(placeCaret);
}

function onBlur(): void {
    focused.value = false;
    clearSelection();
    void nextTick(placeCaret);
    commit();
}

function commit(): void {
    if (!tree.value) return;
    if (hasEmptySlot(tree.value)) {
        hint.value = 'Fill the empty slot before leaving — it has no Calcpad spelling.';
        return;
    }
    const next = printCalcpad(tree.value);
    if (next === props.modelValue) return;
    // The engine's own gate, not a local rule. Checking only for empty slots missed an emptied
    // leaf and wrote `a = /2` into the document — a line Calcpad cannot read back.
    if (!isCommittableText(next)) {
        hint.value = 'Not a complete Calcpad expression, so nothing was written to the document.';
        return;
    }
    emit('update:modelValue', next);
    emit('commit', next);
    emit('dirty', false);
}

function onKeydown(event: KeyboardEvent): void {
    if (!props.editable || !isActive.value || !tree.value || !anchor.value) return;
    // The dialog owns the keyboard while it is open — a stray keystroke here would land in the
    // equation behind it.
    if (matrixDialogOpen.value) return;
    // A composition session (dead keys, Greek, CJK) fires keystrokes as well; acting on them
    // here would insert the intermediate characters *and* the committed one.
    if (event.isComposing || event.keyCode === 229) return;

    const modifier = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();

    if (modifier && key === 'z') {
        event.preventDefault();
        const snapshot = event.shiftKey ? history.redo() : history.undo();
        if (snapshot) restore(snapshot);
        return;
    }
    if (modifier && key === 'y') {
        event.preventDefault();
        const snapshot = history.redo();
        if (snapshot) restore(snapshot);
        return;
    }
    if (modifier && key === 'a') {
        event.preventDefault();
        const all = wholeRange(tree.value);
        selection.value = isEmptyRange(all) ? null : all;
        anchor.value = all.to;
        void nextTick(redraw);
        return;
    }
    if (modifier && key === 'c') { event.preventDefault(); void copyExpression(); return; }
    if (modifier && key === 'x') { event.preventDefault(); void cutExpression(); return; }
    if (modifier && key === 'v') { event.preventDefault(); void pasteExpression(); return; }
    if (modifier) return;

    // Tab walks the structural slots and lets the key through once there is none left, so an
    // equation is not a keyboard trap.
    if (event.key === 'Tab') {
        if (moveToSlot(event.shiftKey ? -1 : 1)) event.preventDefault();
        return;
    }
    if (event.key.length === 1 || event.key === 'Backspace' || event.key === 'Delete') {
        if (selection.value && !isEmptyRange(selection.value)) {
            event.preventDefault();
            replaceSelection(event.key.length === 1 ? event.key : null);
            return;
        }
    }

    switch (event.key) {
        case 'ArrowLeft': event.preventDefault(); event.shiftKey ? extend(-1, 0) : move(-1, 0); return;
        case 'ArrowRight': event.preventDefault(); event.shiftKey ? extend(1, 0) : move(1, 0); return;
        case 'ArrowUp': event.preventDefault(); event.shiftKey ? extend(0, -1) : move(0, -1); return;
        case 'ArrowDown': event.preventDefault(); event.shiftKey ? extend(0, 1) : move(0, 1); return;
        case 'Backspace': event.preventDefault(); edit(deleteBackward(tree.value, anchor.value), 'delete'); return;
        case 'Delete': event.preventDefault(); edit(deleteForward(tree.value, anchor.value), 'delete'); return;
        case 'Enter': event.preventDefault(); commit(); surface.value?.blur(); return;
        case 'Escape': event.preventDefault(); clearSelection(); syncFromValue(props.modelValue); surface.value?.blur(); return;
        default: break;
    }

    if (event.key.length === 1) {
        event.preventDefault();
        const tag: EditTag = STRUCTURE_OPENERS.has(event.key) ? 'structure' : 'type';
        edit(applyCharacter(tree.value, anchor.value, event.key), tag);
    }
}

/** Delete the selected range, optionally typing one character in its place. */
function replaceSelection(ch: string | null): void {
    if (!tree.value) return;
    const range = selection.value;
    if (!range) return;
    edit(ch === null ? deleteRange(tree.value, range) : replaceRange(tree.value, range, ch), 'delete');
}

function moveToSlot(direction: -1 | 1): boolean {
    if (!tree.value || !anchor.value) return false;
    const target = nextSlot(tree.value, anchor.value, direction);
    if (!target) return false;
    clearSelection();
    anchor.value = target;
    hint.value = '';
    history.breakCoalescing();
    void nextTick(placeCaret);
    return true;
}

function move(horizontal: number, vertical: number): void {
    if (!tree.value || !anchor.value) return;
    const range = selection.value;
    if (range && !isEmptyRange(range)) {
        // Horizontal movement collapses to that end of the range instead of stepping from it.
        if (horizontal !== 0) {
            clearSelection();
            anchor.value = horizontal < 0 ? range.from : range.to;
            history.breakCoalescing();
            void nextTick(placeCaret);
            return;
        }
        clearSelection();
        anchor.value = range.to;
    }
    anchor.value = horizontal !== 0
        ? moveHorizontal(tree.value, anchor.value, horizontal > 0 ? 1 : -1)
        : moveVertical(tree.value, anchor.value, vertical > 0 ? 1 : -1);
    hint.value = '';
    // A caret move is not an edit, but it ends a run: "type, move, type" is two undo steps.
    history.breakCoalescing();
    void nextTick(placeCaret);
}

/** Shift+Arrow: the far end stays, the moving end follows the arrow. */
function extend(horizontal: number, vertical: number): void {
    if (!tree.value || !anchor.value) return;
    const current = selection.value;
    const from = current ? current.from : anchor.value;
    const focus = current ? current.to : anchor.value;
    const next = horizontal !== 0
        ? moveHorizontal(tree.value, focus, horizontal > 0 ? 1 : -1)
        : moveVertical(tree.value, focus, vertical > 0 ? 1 : -1);
    const range = orderedRange(tree.value, from, next);
    selection.value = range && !isEmptyRange(range) ? range : null;
    anchor.value = next;
    hint.value = '';
    history.breakCoalescing();
    void nextTick(redraw);
}

function edit(result: { node: MathNode; anchor: Anchor }, tag: EditTag): void {
    clearSelection();
    tree.value = result.node;
    anchor.value = result.anchor;
    hint.value = '';
    history.push({ node: result.node, anchor: result.anchor }, tag);
    emit('dirty', true);
    paint();
}

function restore(snapshot: Snapshot): void {
    clearSelection();
    tree.value = snapshot.node;
    anchor.value = snapshot.anchor;
    paint();
}

/**
 * The field holds one expression and has no text selection, so the clipboard acts on the whole
 * line. Calcpad text *is* the storage format, so a paste is a parse — no interchange needed.
 */
async function copyExpression(): Promise<void> {
    if (!tree.value) return;
    try {
        await navigator.clipboard.writeText(printCalcpad(tree.value));
    } catch {
        hint.value = 'The clipboard is not available here.';
    }
}

async function cutExpression(): Promise<void> {
    await copyExpression();
    if (!tree.value) return;
    edit({ node: el('mrow', []), anchor: { kind: 'gap', path: [], index: 0 } }, 'delete');
}

async function pasteExpression(): Promise<void> {
    let text = '';
    try {
        text = await navigator.clipboard.readText();
    } catch {
        hint.value = 'The clipboard is not available here.';
        return;
    }
    const trimmed = text.trim();
    if (trimmed === '') return;
    const parsed = parseCalcpad(trimmed);
    if (!parsed.ok || !parsed.node) {
        hint.value = 'The clipboard does not hold a Calcpad expression.';
        return;
    }
    edit({ node: parsed.node, anchor: lastAnchor(parsed.node) }, 'paste');
}

/** One entry point for every button: structure, call, character — or the matrix dialog. */
function applyEntry(entry: PaletteEntry): void {
    if (entry.kind === 'dialog') {
        matrixDialogOpen.value = true;
        return;
    }
    if (!tree.value || !anchor.value) return;
    edit(applyPaletteEntry(tree.value, anchor.value, entry), entry.kind === 'char' ? 'type' : 'structure');
}

/** The dialog's Insert: close it and flow the chosen shape back through `applyEntry`. */
function insertMatrix(payload: { rows: number; cols: number }): void {
    matrixDialogOpen.value = false;
    applyEntry(matrixEntry(payload.rows, payload.cols));
    surface.value?.focus();
}

function applyPalette(id: StructureId): void {
    const entry = structureEntry(id);
    if (entry) applyEntry(entry);
}

function insertSymbol(symbol: string): void {
    applyEntry(charEntryFor(symbol));
}

defineExpose({
    applyEntry,
    applyPalette,
    insertSymbol,
    getText: (): string => text.value,
    focus: (): void => surface.value?.focus(),
});
</script>

<style scoped>
.cp-math-field {
    display: block;
    position: relative;
}

.cp-math-surface {
    position: relative;
    min-height: 1.9em;
    padding: 4px 6px;
    border: 1px solid transparent;
    border-radius: 4px;
    outline: none;
    cursor: text;
    line-height: 1.4;
}

.cp-math-surface.is-idle {
    cursor: pointer;
}

.cp-math-surface.is-idle:hover {
    background: var(--vscode-list-hoverBackground, rgba(128, 128, 128, 0.08));
}

.cp-math-surface.is-focused {
    border-color: var(--vscode-focusBorder, #0078d4);
    background: var(--vscode-editor-background, transparent);
}

.cp-math-surface :deep(math) {
    display: inline-block;
    font-size: 1.06em;
}

/* `:deep` is required for the caret: it is created imperatively, so it carries no scope id and
   a plain scoped rule never matched it — it stayed an in-flow block, invisible and over the
   maths, swallowing the clicks meant for the equation. */
.cp-math-surface :deep(.cp-math-caret) {
    position: absolute;
    width: 1.5px;
    background: var(--vscode-editorCursor-foreground, #0a66c2);
    animation: cp-math-blink 1.1s step-end infinite;
    pointer-events: none;
    display: none;
}

@keyframes cp-math-blink {
    50% { opacity: 0; }
}

.cp-math-surface :deep(.cp-math-placeholder) {
    font-family: var(--vscode-editor-font-family, monospace);
    opacity: 0.75;
}

/* An unfilled slot: an empty container or an emptied leaf. Rendering it as a box is what makes
   the caret position visible and gives the pointer something to aim at. */
.cp-math-surface :deep(.cp-math-slot) {
    display: inline-block;
    min-width: 0.62em;
    min-height: 1.05em;
    margin: 0 1px;
    vertical-align: -0.16em;
    border: 1px dashed var(--vscode-editorCursor-foreground, #0a66c2);
    border-radius: 2px;
    opacity: 0.6;
}

.cp-math-surface.is-focused :deep(.cp-math-slot) {
    opacity: 0.95;
}

/* The range is a real DOM selection so the engine paints it; only its colour is ours. */
.cp-math-surface ::selection {
    background: var(--vscode-editor-selectionBackground, rgba(10, 102, 194, 0.3));
}

.cp-math-hint {
    margin-top: 4px;
    font-size: 0.82em;
    opacity: 0.8;
}

.cp-math-palette {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
    margin-top: 6px;
    padding-top: 6px;
    border-top: 1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.3));
}
</style>
