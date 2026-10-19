<!--
  CalcpadMatrixDialog — pick a shape and insert a matrix.

  The combination the user settled on: the hover grid (variant A) leads, the ± steppers and
  preset chips (variant B) sit beside it, and both drive one `size` — hovering the grid sets it
  live, clicking a cell inserts, Enter inserts whatever is showing, Esc cancels.
-->
<template>
  <div class="cp-matrix-dialog" @click.self="emit('cancel')" @keydown="onKeydown">
    <div
      ref="panel"
      class="cp-matrix-panel"
      role="dialog"
      aria-modal="true"
      aria-label="Insert matrix"
      tabindex="-1"
    >
      <div class="cp-matrix-head">
        <h3>Insert matrix</h3>
        <button class="cp-matrix-close" type="button" aria-label="Cancel" @click="emit('cancel')">×</button>
      </div>

      <div class="cp-matrix-body">
        <div class="cp-matrix-picker">
          <div class="cp-matrix-label">Hover to size · click to insert</div>
          <div
            class="cp-matrix-grid"
            role="group"
            aria-label="Matrix size — rows by columns"
            @mouseleave="hovering = false"
          >
            <button
              v-for="cell in cells"
              :key="cell.index"
              type="button"
              tabindex="-1"
              class="cp-matrix-cell"
              :class="{ 'is-on': cell.row < size.rows && cell.col < size.cols }"
              :aria-label="`${cell.row + 1} by ${cell.col + 1}`"
              @mouseenter="hover(cell.row + 1, cell.col + 1)"
              @click="confirm(cell.row + 1, cell.col + 1)"
            ></button>
          </div>
          <div class="cp-matrix-size" aria-live="polite">{{ size.rows }} × {{ size.cols }}</div>
        </div>

        <div class="cp-matrix-side">
          <div class="cp-matrix-steppers">
            <div class="cp-matrix-step">
              <span>Rows</span>
              <button type="button" aria-label="Fewer rows" @click="bump('rows', -1)">−</button>
              <b>{{ size.rows }}</b>
              <button type="button" aria-label="More rows" @click="bump('rows', 1)">+</button>
            </div>
            <div class="cp-matrix-step">
              <span>Columns</span>
              <button type="button" aria-label="Fewer columns" @click="bump('cols', -1)">−</button>
              <b>{{ size.cols }}</b>
              <button type="button" aria-label="More columns" @click="bump('cols', 1)">+</button>
            </div>
          </div>

          <div class="cp-matrix-presets" role="group" aria-label="Preset sizes">
            <button
              v-for="preset in PRESETS"
              :key="`${preset.rows}x${preset.cols}`"
              type="button"
              @click="set(preset.rows, preset.cols)"
            >{{ preset.rows }}×{{ preset.cols }}</button>
          </div>

          <div class="cp-matrix-preview" aria-hidden="true">
            <span class="cp-matrix-bracket cp-matrix-bracket--open"></span>
            <span
              class="cp-matrix-mini"
              :style="{ gridTemplateColumns: `repeat(${size.cols}, 1fr)` }"
            >
              <span v-for="i in size.rows * size.cols" :key="i"></span>
            </span>
            <span class="cp-matrix-bracket cp-matrix-bracket--close"></span>
          </div>
        </div>
      </div>

      <div class="cp-matrix-actions">
        <span class="cp-matrix-hint">Enter inserts · Esc cancels</span>
        <button class="cp-matrix-btn" type="button" @click="emit('cancel')">Cancel</button>
        <button class="cp-matrix-btn is-primary" type="button" @click="confirm()">Insert</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

const emit = defineEmits<{
    (e: 'insert', payload: { rows: number; cols: number }): void;
    (e: 'cancel'): void;
}>();

const MAX = 8;
const PRESETS = [
    { rows: 2, cols: 2 }, { rows: 3, cols: 3 }, { rows: 4, cols: 4 }, { rows: 1, cols: 3 },
] as const;

const size = ref({ rows: 3, cols: 3 });
const hovering = ref(false);
const panel = ref<HTMLElement | null>(null);

const cells = computed(() =>
    Array.from({ length: MAX * MAX }, (_, index) => ({
        index,
        row: Math.floor(index / MAX),
        col: index % MAX,
    })));

function set(rows: number, cols: number): void {
    const clamp = (value: number): number => Math.min(MAX, Math.max(1, Math.round(value)));
    size.value = { rows: clamp(rows), cols: clamp(cols) };
}

function bump(axis: 'rows' | 'cols', delta: number): void {
    hovering.value = false;
    set(size.value.rows + (axis === 'rows' ? delta : 0), size.value.cols + (axis === 'cols' ? delta : 0));
}

function hover(rows: number, cols: number): void {
    hovering.value = true;
    set(rows, cols);
}

function confirm(rows?: number, cols?: number): void {
    if (rows !== undefined && cols !== undefined) set(rows, cols);
    emit('insert', { rows: size.value.rows, cols: size.value.cols });
}

function onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
        event.preventDefault();
        emit('cancel');
        return;
    }
    // Enter on a focused button is that button's own click; only handle it anywhere else,
    // or Insert would fire twice and the field would build two matrices.
    if (event.key === 'Enter' && !(event.target as HTMLElement | null)?.closest('button')) {
        event.preventDefault();
        confirm();
        return;
    }
    const steps: Record<string, [number, number]> = {
        ArrowUp: [1, 0], ArrowDown: [-1, 0], ArrowRight: [0, 1], ArrowLeft: [0, -1],
    };
    const step = steps[event.key];
    if (!step) return;
    event.preventDefault();
    hovering.value = false;
    set(size.value.rows + step[0], size.value.cols + step[1]);
}

onMounted(() => panel.value?.focus());
</script>

<style scoped>
.cp-matrix-dialog {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(12, 18, 32, 0.42);
}

.cp-matrix-panel {
    min-width: 320px;
    padding: 14px 16px 12px;
    border: 1px solid rgba(120, 140, 180, 0.35);
    border-radius: 8px;
    background: Canvas;
    color: CanvasText;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
    outline: none;
}

.cp-matrix-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
}

.cp-matrix-head h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
}

.cp-matrix-close {
    border: none;
    background: none;
    color: inherit;
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
    opacity: 0.7;
}

.cp-matrix-close:hover {
    opacity: 1;
}

.cp-matrix-body {
    display: flex;
    gap: 18px;
    align-items: flex-start;
}

.cp-matrix-label {
    margin-bottom: 6px;
    font-size: 11px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    opacity: 0.65;
}

.cp-matrix-grid {
    display: grid;
    grid-template-columns: repeat(8, 20px);
    gap: 3px;
}

.cp-matrix-cell {
    width: 20px;
    height: 20px;
    padding: 0;
    border: none;
    border-radius: 3px;
    background: rgba(120, 140, 180, 0.18);
    cursor: pointer;
}

.cp-matrix-cell.is-on {
    background: Highlight;
}

.cp-matrix-size {
    margin-top: 8px;
    font-size: 13px;
    font-variant-numeric: tabular-nums;
    opacity: 0.85;
}

.cp-matrix-steppers {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 13px;
}

.cp-matrix-step {
    display: flex;
    align-items: center;
    gap: 7px;
}

.cp-matrix-step span {
    min-width: 58px;
}

.cp-matrix-step b {
    min-width: 12px;
    text-align: center;
    font-variant-numeric: tabular-nums;
}

.cp-matrix-step button {
    width: 20px;
    height: 20px;
    padding: 0;
    border: 1px solid rgba(120, 140, 180, 0.45);
    border-radius: 4px;
    background: none;
    color: inherit;
    cursor: pointer;
}

.cp-matrix-presets {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 10px;
}

.cp-matrix-presets button {
    padding: 1px 7px;
    border: 1px solid rgba(120, 140, 180, 0.45);
    border-radius: 4px;
    background: none;
    color: inherit;
    font-size: 12px;
    cursor: pointer;
}

.cp-matrix-preview {
    display: flex;
    align-items: stretch;
    gap: 5px;
    height: 54px;
    margin-top: 12px;
}

.cp-matrix-mini {
    display: grid;
    gap: 3px;
    align-content: start;
}

.cp-matrix-mini>span {
    display: block;
    min-width: 14px;
    height: 14px;
    border: 1px solid rgba(120, 140, 180, 0.6);
    border-radius: 2px;
}

/* Fences drawn as borders: a glyph would not stretch here either — that is the whole bug. */
.cp-matrix-bracket {
    width: 6px;
    border-style: solid;
    border-color: currentColor;
}

.cp-matrix-bracket--open {
    border-width: 2px 0 2px 2px;
}

.cp-matrix-bracket--close {
    border-width: 2px 2px 2px 0;
}

.cp-matrix-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 14px;
    padding-top: 10px;
    border-top: 1px solid rgba(120, 140, 180, 0.25);
}

.cp-matrix-hint {
    margin-right: auto;
    font-size: 11px;
    opacity: 0.6;
}

.cp-matrix-btn {
    padding: 4px 12px;
    border: 1px solid rgba(120, 140, 180, 0.45);
    border-radius: 5px;
    background: none;
    color: inherit;
    font-size: 13px;
    cursor: pointer;
}

.cp-matrix-btn.is-primary {
    border-color: Highlight;
    background: Highlight;
    color: HighlightText;
}
</style>
