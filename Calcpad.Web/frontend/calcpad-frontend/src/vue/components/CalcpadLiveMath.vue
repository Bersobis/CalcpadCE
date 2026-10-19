<!--
  CalcpadLiveMath — the whole worksheet as typeset maths.

  The document text stays authoritative: this is a *view* over it. Equation lines become math
  fields, everything else is grouped into source blocks, and a committed edit is written back
  one line at a time through `applyLine`, so the host's document remains the single source of
  truth and no second copy can drift.
-->
<template>
  <div class="cp-live-math">
    <div class="cp-live-toolbar">
      <label class="cp-live-toggle">
        <input type="checkbox" v-model="editable" />
        <span>Editable</span>
      </label>
      <label class="cp-live-toggle" title="Typeset output until you click an equation, like Mathcad">
        <input type="checkbox" v-model="clickToEdit" />
        <span>Click to edit</span>
      </label>
      <span class="cp-live-stats">{{ equationCount }} / {{ regions.length }} lines as maths</span>
    </div>

    <!-- Docked once above the worksheet and always visible, rather than repeated beside every
         equation: at sidebar width, a palette per line wraps into a column and buries the maths.
         It targets whichever equation is being edited. -->
    <div v-if="editable" class="cp-live-palette" @mousedown.prevent>
      <button
        v-for="structure in structures"
        :key="structure.id"
        class="cp-math-key"
        :title="structure.title"
        :disabled="!activeField"
        @click="applyPalette(structure.id)"
      >{{ structure.label }}</button>
      <span class="cp-math-divider"></span>
      <button
        v-for="symbol in symbols"
        :key="symbol"
        class="cp-math-key"
        :title="symbol"
        :disabled="!activeField"
        @click="insertSymbol(symbol)"
      >{{ symbol }}</button>
      <span v-if="!activeField" class="cp-live-palette-hint">{{ paletteHint }}</span>
    </div>

    <div v-if="supported && equationCount === 0" class="cp-live-empty">
      <p>No equations to edit yet.</p>
      <p class="cp-live-empty-hint">
        Type one in the editor — any line the engine can read back appears here as editable maths.
      </p>
    </div>

    <div v-if="!supported" class="cp-live-note">
      This host has no MathML engine, so the graphical view is unavailable and the source is shown instead.
    </div>

    <div v-if="!supported" class="cp-live-source">
      <pre>{{ modelValue }}</pre>
    </div>

    <div v-else class="cp-live-body">
      <template v-for="region in regions" :key="`${region.kind}-${region.startLine}`">
        <CalcpadMathField
          v-if="region.kind === 'equation' && editable"
          :ref="fieldRef(region.startLine)"
          class="cp-live-equation"
          :model-value="lineText(region.startLine)"
          :editable="true"
          :show-palette="false"
          :click-to-edit="clickToEdit"
          :active="!clickToEdit || activeLine === region.startLine"
          @commit="(value) => applyLine(region.startLine, value)"
          @dirty="(value) => emit('dirty', value)"
          @activate="onActivate(region.startLine)"
        />
        <div v-else-if="region.kind === 'equation'" class="cp-live-static" v-html="staticMarkup(region)"></div>
        <pre v-else class="cp-live-block">{{ region.text }}</pre>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue';
import CalcpadMathField from './CalcpadMathField.vue';
import {
    LineModel, LineRegion, PALETTE_SYMBOLS, STRUCTURES, StructureId, supportsMathMlCore,
    toMathMlDocument,
} from '../../math';

/** The subset of the field's exposed API the shared toolbar drives. */
interface FieldApi {
    applyPalette(id: StructureId): void;
    insertSymbol(symbol: string): void;
    focus(): void;
}

const props = withDefaults(defineProps<{
    modelValue: string;
    editableDefault?: boolean;
}>(), {
    editableDefault: true,
});

const emit = defineEmits<{
    (e: 'update:modelValue', value: string): void;
    (e: 'applyLine', payload: { line: number; text: string }): void;
    /** Forwarded from a field so the host knows not to overwrite an edit in progress. */
    (e: 'dirty', value: boolean): void;
}>();

const editable = ref(props.editableDefault);
const clickToEdit = ref(false);
const supported = ref(true);

// The probe is measured once per document, never inferred from a user-agent string.
if (typeof document !== 'undefined') supported.value = supportsMathMlCore(document);

const structures = STRUCTURES;
const symbols = PALETTE_SYMBOLS;

const lines = computed(() => props.modelValue.split(/\r\n|\r|\n/));

// Classifying a line costs a parse, a print and a re-parse, and this computed re-runs on every
// commit. The model memoises per line text, so only the edited line is re-classified.
const model = new LineModel();
const regions = computed(() => model.regions(props.modelValue));
const equationCount = computed(() => regions.value.filter((r) => r.kind === 'equation').length);

// A plain `ref="field"` inside `v-for` is collected by Vue into an *array* — truthy, so it passes
// a guard, and then fails at the call site with "is not a function". That bug made every palette
// button dead in the previous attempt, so the instances are registered by a function ref.
const fields = new Map<number, FieldApi>();
const fieldRefs = new Map<number, (instance: unknown) => void>();
const activeLine = ref<number | null>(null);
const activeField = shallowRef<FieldApi | null>(null);

/**
 * One stable callback per line. An inline arrow would be a new function on every render, and Vue
 * unsets a changed ref before setting it — which would clear the active field on every commit and
 * leave the palette pointing at nothing.
 */
function fieldRef(line: number): (instance: unknown) => void {
    let callback = fieldRefs.get(line);
    if (!callback) {
        callback = (instance: unknown) => registerField(line, instance);
        fieldRefs.set(line, callback);
    }
    return callback;
}

const paletteHint = computed(() => {
    if (equationCount.value === 0) return 'The buttons act on the equation you are editing.';
    return clickToEdit.value
        ? 'Click an equation to edit it, then use these.'
        : 'Click into an equation, then use these.';
});

function registerField(line: number, instance: unknown): void {
    if (instance) {
        fields.set(line, instance as FieldApi);
        // A region can be re-created (its kind changing re-keys it), which re-registers the same
        // line. Refresh the toolbar's target rather than leaving it on the unmounted instance.
        if (activeLine.value === line) activeField.value = instance as FieldApi;
        return;
    }
    fields.delete(line);
    if (activeLine.value === line) {
        activeLine.value = null;
        activeField.value = null;
    }
}

function onActivate(line: number): void {
    activeLine.value = line;
    activeField.value = fields.get(line) ?? null;
}

function applyPalette(id: StructureId): void {
    const field = activeField.value;
    if (!field) return;
    field.applyPalette(id);
    field.focus();
}

function insertSymbol(symbol: string): void {
    const field = activeField.value;
    if (!field) return;
    field.insertSymbol(symbol);
    field.focus();
}

function lineText(index: number): string {
    return lines.value[index] ?? '';
}

function applyLine(line: number, text: string): void {
    const next = lines.value.slice();
    next[line] = text;
    const joined = next.join('\n');
    emit('update:modelValue', joined);
    emit('applyLine', { line, text });
}

/** Static markup for a read-only equation region, from the tree the region already carries. */
function staticMarkup(region: LineRegion): string {
    return region.node ? toMathMlDocument(region.node) : '';
}
</script>

<style scoped>
.cp-live-math {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px;
    font-size: 0.95em;
}

.cp-live-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-size: 0.85em;
    opacity: 0.85;
}

.cp-live-toggle {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    cursor: pointer;
}

/* Sticky so the palette stays reachable while the worksheet scrolls past it. */
.cp-live-palette {
    position: sticky;
    top: 0;
    z-index: 1;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 3px;
    padding: 6px 0;
    background: var(--vscode-sideBar-background, inherit);
    border-bottom: 1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.3));
}

.cp-live-palette-hint {
    margin-left: 6px;
    font-size: 0.85em;
    opacity: 0.7;
}

.cp-live-body {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.cp-live-equation {
    padding: 1px 0;
}

.cp-live-static {
    padding: 4px 6px;
}

.cp-live-static :deep(math) {
    display: inline-block;
    font-size: 1.06em;
}

.cp-live-block {
    margin: 0;
    padding: 4px 6px;
    white-space: pre-wrap;
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 0.9em;
    opacity: 0.78;
}

.cp-live-empty {
    padding: 12px 8px;
    opacity: 0.75;
}

.cp-live-empty p {
    margin: 0 0 4px;
}

.cp-live-empty-hint {
    font-size: 0.85em;
    opacity: 0.85;
}

.cp-live-note {
    padding: 6px 8px;
    border-radius: 4px;
    background: var(--vscode-inputValidation-warningBackground, rgba(255, 200, 0, 0.15));
}

.cp-live-source {
    max-height: 60vh;
    overflow: auto;
}
</style>
