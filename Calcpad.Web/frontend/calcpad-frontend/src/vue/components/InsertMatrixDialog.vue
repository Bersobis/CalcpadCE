<template>
  <div v-if="open" class="matrix-dialog-mask" @click.self="cancel">
    <div class="matrix-dialog" role="dialog" aria-modal="true" aria-label="Insert matrix">
      <div class="matrix-dialog-header">
        <h3 class="matrix-dialog-title">Insert matrix</h3>
        <button class="matrix-dialog-close" title="Close (Esc)" @click="cancel">&#x2715;</button>
      </div>

      <div class="matrix-dialog-body">
        <section class="matrix-size-section">
          <div class="matrix-steppers">
            <div class="matrix-stepper">
              <label for="matrix-rows">Rows</label>
              <div class="stepper">
                <button type="button" class="stepper-btn" @click="decRows" :disabled="rows <= 1" title="Decrease rows">&#x2212;</button>
                <input id="matrix-rows" v-model.number="rows" type="number" min="1" max="8" class="stepper-input" @change="clampRows" />
                <button type="button" class="stepper-btn" @click="incRows" :disabled="rows >= 8" title="Increase rows">+</button>
              </div>
            </div>
            <div class="matrix-stepper">
              <label for="matrix-cols">Columns</label>
              <div class="stepper">
                <button type="button" class="stepper-btn" @click="decCols" :disabled="cols <= 1" title="Decrease columns">&#x2212;</button>
                <input id="matrix-cols" v-model.number="cols" type="number" min="1" max="8" class="stepper-input" @change="clampCols" />
                <button type="button" class="stepper-btn" @click="incCols" :disabled="cols >= 8" title="Increase columns">+</button>
              </div>
            </div>
          </div>

          <div class="matrix-presets">
            <span class="matrix-presets-label">Presets</span>
            <div class="matrix-preset-btns">
              <button v-for="p in PRESETS" :key="p.label" type="button" class="matrix-preset-btn" :class="{ selected: rows === p.rows && cols === p.cols }" @click="selectPreset(p)" :title="`${p.rows}×${p.cols}`">
                {{ p.label }}
              </button>
            </div>
          </div>
        </section>

        <section class="matrix-grid-section">
          <div class="matrix-grid-section-label">Grid — click a cell to toggle it</div>
          <div class="matrix-grid" :style="gridStyle">
            <div v-for="(on, idx) in grid" :key="idx" class="matrix-cell" :class="{ on: on }" @click="toggleCell(Math.floor(idx / 8), idx % 8)" />
          </div>
        </section>

        <section class="matrix-preview-section">
          <div class="matrix-preview-label">Preview</div>
          <div class="matrix-preview-fence">[</div>
          <div class="matrix-preview-grid" :style="previewStyle">
            <div v-for="(on, idx) in grid" :key="idx" class="matrix-preview-cell" :class="{ on: on }" />
          </div>
          <div class="matrix-preview-fence">]</div>
        </section>

        <section class="matrix-variable-section">
          <label for="matrix-variable">Variable name</label>
          <input id="matrix-variable" v-model.trim="variableName" type="text" spellcheck="false" class="matrix-variable-input" placeholder="M" @keyup.enter="insert" />
          <p class="matrix-variable-hint">Inserted as <code>{{ insertExample }}</code></p>
        </section>
      </div>

      <div class="matrix-dialog-footer">
        <button type="button" class="matrix-dialog-btn matrix-dialog-cancel" @click="cancel">Cancel</button>
        <button type="button" class="matrix-dialog-btn matrix-dialog-insert" @click="insert">Insert</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
  insert: [text: string]
}>()

const GRID_SIZE = 8
const MIN = 1
const MAX = 8

const PRESETS = [
  { label: '2×2', rows: 2, cols: 2 },
  { label: '3×3', rows: 3, cols: 3 },
  { label: '4×4', rows: 4, cols: 4 },
  { label: '1×3', rows: 1, cols: 3 },
]

const rows = ref(3)
const cols = ref(3)
const variableName = ref('M')

/** Flat 8×8 grid of togglable cells; only the top-left rows×cols region is meaningful. */
const grid = ref<boolean[]>(() => Array.from({ length: GRID_SIZE * GRID_SIZE }, () => false))

/** Keep the grid in sync with the current size whenever rows/cols change. */
const reinitGrid = () => {
  const len = GRID_SIZE * GRID_SIZE
  const next = new Array<boolean>(len)
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      next[r * GRID_SIZE + c] = r < rows.value && c < cols.value
    }
  }
  grid.value = next
}

const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${GRID_SIZE}, 18px)`,
}))

const previewStyle = computed(() => ({
  gridTemplateColumns: `repeat(${cols.value}, 22px)`,
}))

const insertExample = computed(() => {
  const name = variableName.value || 'M'
  return `${name} = matrix(${rows.value}; ${cols.value})`
})

function clampRows() {
  if (rows.value < MIN) rows.value = MIN
  if (rows.value > MAX) rows.value = MAX
  reinitGrid()
}

function clampCols() {
  if (cols.value < MIN) cols.value = MIN
  if (cols.value > MAX) cols.value = MAX
  reinitGrid()
}

function incRows() { if (rows.value < MAX) { rows.value++; reinitGrid() } }
function decRows() { if (rows.value > MIN) { rows.value--; reinitGrid() } }
function incCols() { if (cols.value < MAX) { cols.value++; reinitGrid() } }
function decCols() { if (cols.value > MIN) { cols.value--; reinitGrid() } }

function selectPreset(p: (typeof PRESETS)[number]) {
  rows.value = p.rows
  cols.value = p.cols
  reinitGrid()
}

function toggleCell(r: number, c: number) {
  const idx = r * GRID_SIZE + c
  if (idx >= 0 && idx < grid.value.length) {
    grid.value[idx] = !grid.value[idx]
  }
}

function insert() {
  const text = insertExample.value
  emit('insert', text)
  emit('close')
}

function cancel() {
  emit('close')
}
</script>

<style scoped>
.matrix-dialog-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.matrix-dialog {
  width: 340px;
  background: var(--vscode-sideBar-background);
  border: 1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.3));
  border-radius: 4px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  overflow: hidden;
}

.matrix-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: var(--vscode-sideBarSectionHeader-background);
  border-bottom: 1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.3));
}

.matrix-dialog-title {
  margin: 0;
  font-size: var(--calcpad-font-size-md);
  color: var(--vscode-sideBarSectionHeader-foreground);
}

.matrix-dialog-close {
  background: none;
  border: none;
  color: var(--vscode-sideBarSectionHeader-foreground);
  font-size: 16px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}

.matrix-dialog-close:hover {
  color: var(--vscode-button-foreground);
}

.matrix-dialog-body {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.matrix-size-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.matrix-steppers {
  display: flex;
  gap: 16px;
}

.matrix-stepper {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.matrix-stepper label {
  font-size: var(--calcpad-font-size-sm);
  color: var(--vscode-descriptionForeground);
}

.stepper {
  display: flex;
  align-items: center;
  gap: 4px;
}

.stepper-btn {
  width: 24px;
  height: 24px;
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border: none;
  border-radius: 2px;
  cursor: pointer;
  font-size: 14px;
  font-family: var(--vscode-font-family);
  display: flex;
  align-items: center;
  justify-content: center;
}

.stepper-btn:hover:not(:disabled) {
  background: var(--vscode-button-hoverBackground);
}

.stepper-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.stepper-input {
  width: 40px;
  text-align: center;
  padding: 2px 4px;
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  border: 1px solid var(--vscode-input-border, rgba(128, 128, 128, 0.3));
  border-radius: 2px;
  font-size: var(--calcpad-font-size-md);
  font-family: var(--vscode-font-family);
}

.stepper-input:focus {
  outline: none;
  border-color: var(--vscode-focusBorder);
}

.matrix-presets {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.matrix-presets-label {
  font-size: var(--calcpad-font-size-sm);
  color: var(--vscode-descriptionForeground);
}

.matrix-preset-btns {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.matrix-preset-btn {
  padding: 2px 8px;
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border: none;
  border-radius: 2px;
  cursor: pointer;
  font-size: var(--calcpad-font-size-sm);
  font-family: var(--vscode-font-family);
}

.matrix-preset-btn:hover {
  background: var(--vscode-button-hoverBackground);
}

.matrix-preset-btn.selected {
  background: var(--calcpad-accent, #3b6ef5);
  color: #fff;
}

.matrix-grid-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.matrix-grid-section-label {
  font-size: var(--calcpad-font-size-sm);
  color: var(--vscode-descriptionForeground);
}

.matrix-grid {
  display: grid;
  gap: 3px;
}

.matrix-cell {
  width: 18px;
  height: 18px;
  background: rgba(120, 140, 180, 0.18);
  border-radius: 3px;
  cursor: pointer;
}

.matrix-cell.on {
  background: var(--calcpad-accent, #3b6ef5);
}

.matrix-cell:hover {
  opacity: 0.85;
}

.matrix-preview-section {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.matrix-preview-label {
  font-size: var(--calcpad-font-size-sm);
  color: var(--vscode-descriptionForeground);
  min-width: 52px;
}

.matrix-preview-fence {
  font-size: 22px;
  line-height: 1;
  color: var(--vscode-descriptionForeground);
}

.matrix-preview-grid {
  display: grid;
  gap: 3px;
}

.matrix-preview-cell {
  width: 22px;
  height: 22px;
  border: 1px solid var(--vscode-panel-border, rgba(120, 140, 180, 0.4));
  border-radius: 2px;
  background: var(--vscode-editor-background);
}

.matrix-preview-cell.on {
  background: var(--calcpad-accent, #3b6ef5);
}

.matrix-variable-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.matrix-variable-section label {
  font-size: var(--calcpad-font-size-sm);
  color: var(--vscode-descriptionForeground);
}

.matrix-variable-input {
  padding: 4px 6px;
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  border: 1px solid var(--vscode-input-border, rgba(128, 128, 128, 0.3));
  border-radius: 2px;
  font-size: var(--calcpad-font-size-md);
  font-family: var(--vscode-font-family);
  font-family: 'Consolas', 'Monaco', monospace;
}

.matrix-variable-input:focus {
  outline: none;
  border-color: var(--vscode-focusBorder);
}

.matrix-variable-hint {
  margin: 0;
  font-size: var(--calcpad-font-size-xs);
  color: var(--vscode-descriptionForeground);
  opacity: 0.8;
}

.matrix-variable-hint code {
  font-family: 'Consolas', 'Monaco', monospace;
}

.matrix-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.3));
}

.matrix-dialog-btn {
  padding: 5px 14px;
  border: none;
  border-radius: 2px;
  font-size: var(--calcpad-font-size-sm);
  font-family: var(--vscode-font-family);
  cursor: pointer;
}

.matrix-dialog-cancel {
  background: transparent;
  color: var(--vscode-button-foreground);
  border: 1px solid var(--vscode-button-border, rgba(128, 128, 128, 0.4));
}

.matrix-dialog-cancel:hover {
  background: var(--vscode-button-hoverBackground);
}

.matrix-dialog-insert {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
}

.matrix-dialog-insert:hover {
  background: var(--vscode-button-hoverBackground);
}
</style>
