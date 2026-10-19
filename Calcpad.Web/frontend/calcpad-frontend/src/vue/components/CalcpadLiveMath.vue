<!--
  CalcpadLiveMath — the whole worksheet as typeset maths.

  The document text stays authoritative: this is a *view* over it. Equation lines become math
  fields, everything else is grouped into source blocks, and a committed edit is written back
  one line at a time through `applyLine`, so the host's document remains the single source of
  truth and no second copy can drift.
-->
<template>
  <div ref="root" class="cp-live-math">
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
         It targets whichever equation is being edited, and shows the whole syntax catalog —
         grouped into sections and filtered by the search box. -->
    <div v-if="editable" class="cp-live-palette">
      <div class="cp-live-palette-bar">
        <input
          v-model="paletteQuery"
          class="cp-live-palette-search"
          type="search"
          aria-label="Find Calcpad syntax"
          placeholder="Find syntax — sin, mod, greek, a/b…"
          :disabled="!activeField"
        />
        <span class="cp-live-palette-count">
          {{ paletteQuery ? `${matchCount} of ${entryCount}` : `${entryCount} buttons` }}
        </span>
      </div>

      <p v-if="!activeField" class="cp-live-palette-hint">{{ paletteHint }}</p>

      <div class="cp-live-palette-body">
        <section v-for="section in visibleSections" :key="section.id" class="cp-live-section" :style="sectionStyle(section)">
          <h4 class="cp-live-section-title">{{ section.label }}</h4>
          <div class="cp-live-keys">
            <button
              v-for="entry in section.entries"
              :key="entry.id"
              class="cp-math-key"
              :title="keyTitle(entry)"
              :aria-label="keyLabel(entry)"
              :disabled="!activeField"
              @mousedown.prevent
              @click="applyEntry(entry)"
            >{{ entry.label }}</button>
          </div>
        </section>
        <p v-if="visibleSections.length === 0" class="cp-live-palette-hint">
          Nothing matches “{{ paletteQuery }}”.
        </p>
      </div>
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
import { computed, nextTick, onMounted, onUpdated, ref, shallowRef } from 'vue';
import CalcpadMathField from './CalcpadMathField.vue';
import {
    LineModel, LineRegion, PaletteEntry, PaletteSection, PALETTE_SECTIONS, supportsMathMlCore,
    filterPalette, stretchMatrixFences, toMathMlDocument,
} from '../../math';

/** The subset of the field's exposed API the shared toolbar drives. */
interface FieldApi {
    applyEntry(entry: PaletteEntry): void;
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

const entryCount = PALETTE_ENTRIES.length;
const paletteQuery = ref('');

/** A dialog button does not write text — it opens — so its tooltip says what it does. */
function keyTitle(entry: PaletteEntry): string {
    return entry.kind === 'dialog'
        ? `${entry.title} — pick rows and columns`
        : `${entry.title} — writes ${entry.insert}`;
}

function keyLabel(entry: PaletteEntry): string {
    return entry.kind === 'dialog'
        ? `${entry.title} (opens a dialog)`
        : `${entry.title} (${entry.insert})`;
}
const visibleSections = computed(() => filterPalette(PALETTE_SECTIONS, paletteQuery.value));
const matchCount = computed(() =>
    visibleSections.value.reduce((total, section) => total + section.entries.length, 0));

const wizardSectionRank = computed(() =>
    visibleSections.value.reduce((rank, section, index) =>
        section.entries.some((entry) => entry.kind === 'dialog') ? index : rank, -1));

function sectionStyle(section: PaletteSection): Record<string, string> {
    const index = visibleSections.value.indexOf(section);
    const rank = wizardSectionRank.value;
    const isActive = rank >= 0 && index === rank;
    return {
        '--wizard-section-index': String(isActive ? index + 1 : 0),
        'data-wizard-section': String(isActive),
    };
}

const lines = computed(() => props.modelValue.split(/\r\n|\r|\n/));

// Static equation lines arrive through v-html, so their matrix brackets are stretched after
// each patch; the editable fields do it themselves on every paint.
const root = ref<HTMLElement | null>(null);
function stretchFences(): void {
    stretchMatrixFences(root.value);
}
onMounted(() => nextTick(stretchFences));
onUpdated(stretchFences);

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

function applyEntry(entry: PaletteEntry): void {
    const field = activeField.value;
    if (!field) return;
    field.applyEntry(entry);
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

/* Sticky so the palette stays reachable while the worksheet scrolls past it. The body scrolls
   on its own: twelve sections at sidebar width would otherwise push the maths off the panel. */
.cp-live-palette {
    position: sticky;
    top: 0;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 6px 0;
    background: var(--vscode-sideBar-background, inherit);
    border-bottom: 1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.3));
}

.cp-live-palette-bar {
    display: flex;
    align-items: center;
    gap: 6px;
}

.cp-live-palette-search {
    flex: 1 1 auto;
    min-width: 0;
    height: 24px;
    padding: 0 6px;
    background: var(--vscode-input-background);
    border: 1px solid var(--vscode-input-border, var(--vscode-panel-border, transparent));
    border-radius: 3px;
    color: var(--vscode-input-foreground);
    font-size: var(--calcpad-font-size-sm);
}

.cp-live-palette-search::placeholder {
    color: var(--vscode-input-placeholderForeground, var(--vscode-disabledForeground));
}

.cp-live-palette-search:disabled {
    opacity: 0.5;
    cursor: default;
}

.cp-live-palette-count {
    flex: 0 0 auto;
    font-size: var(--calcpad-font-size-sm);
    opacity: 0.65;
    white-space: nowrap;
}

.cp-live-palette-body {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 34vh;
    overflow: auto;
}

.cp-live-section {
    display: flex;
    flex-direction: column;
    gap: 2px;
    transition: background 0.25s ease;
    border-radius: 6px;
}

.cp-live-section.is-wizard-section,
.cph-was-touched .cp-live-section[data-wizard-section] {
    background: linear-gradient(180deg,
        var(--calcpad-wizard-glow, rgba(86, 156, 255, 0.18)),
        transparent 70%);
    outline: 1.5px dashed var(--calcpad-wizard-outline, rgba(86, 156, 255, 0.55));
}

.cp-live-section[data-wizard-section] .cp-live-section-title,
.cph-was-touched .cp-live-section[data-wizard-section] .cp-live-section-title {
    opacity: 1;
    color: var(--calcpad-wizard-foreground, var(--vscode-foreground));
    letter-spacing: 0.08em;
}

.cp-live-section[data-wizard-section] .cp-live-section-title::before,
.cph-was-touched .cp-live-section[data-wizard-section] .cp-live-section-title::before {
    content: '⚡ ';
}

.cp-live-section[data-wizard-section] .cp-live-keys,
.cph-was-touched .cp-live-section[data-wizard-section] .cp-live-keys {
    gap: 4px;
}

.cp-live-section[data-wizard-section] .cp-math-key,
.cph-was-touched .cp-live-section[data-wizard-section] .cp-math-key {
    border-radius: 4px;
    background: var(--calcpad-wizard-button-bg, rgba(86, 156, 255, 0.1));
    border: 1px solid var(--calcpad-wizard-outline, rgba(86, 156, 255, 0.3));
    color: var(--calcpad-wizard-foreground, var(--vscode-foreground));
    cursor: pointer;
    user-select: none;
    font-weight: 500;
    font-size: 0.95em;
    padding: 4px 8px;
    min-width: 24px;
    min-height: 24px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    position: relative;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    opacity: 0.9;
    transform: rotateX(0deg);
    transform-origin: center bottom;
    perspective: 1000px;
    transform-style: preserve-3d;
    backface-visibility: hidden;
    will-change: transform, opacity, background, border-color, filter, box-shadow;
    contain: layout style paint;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.cp-live-section[data-wizard-section] .cp-math-key:hover,
.cph-was-touched .cp-live-section[data-wizard-section] .cp-math-key:hover {
    background: var(--calcpad-wizard-button-hover-bg, rgba(86, 156, 255, 0.2));
    border-color: var(--calcpad-wizard-outline, rgba(86, 156, 255, 0.6));
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
    filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.15));
    opacity: 1;
    transform: translateY(-1px) rotateX(-5deg);
}

.cp-live-section[data-wizard-section] .cp-math-key:active,
.cph-was-touched .cp-live-section[data-wizard-section] .cp-math-key:active {
    background: var(--calcpad-wizard-button-active-bg, rgba(86, 156, 255, 0.3));
    border-color: var(--calcpad-wizard-outline, rgba(86, 156, 255, 1));
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
    opacity: 0.8;
    transform: rotateX(0deg);
}

.cp-live-section[data-wizard-section] .cp-math-key:focus,
.cph-was-touched .cp-live-section[data-wizard-section] .cp-math-key:focus {
    box-shadow: 0 0 0 2px var(--calcpad-wizard-outline, rgba(86, 156, 255, 0.4));
    border-color: var(--calcpad-wizard-outline, rgba(86, 156, 255, 0.8));
}

.cp-live-section[data-wizard-section] .cp-math-key:focus-visible,
.cph-was-touched .cp-live-section[data-wizard-section] .cp-math-key:focus-visible {
    outline: 2px solid var(--calcpad-wizard-outline, rgba(86, 156, 255, 0.8));
    outline-offset: 1px;
}

.cp-live-section[data-wizard-section] .cp-math-key::after,
.cph-was-touched .cp-live-section[data-wizard-section] .cp-math-key::after {
    content: '';
    position: absolute;
    bottom: -2px;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 4px solid transparent;
    border-right: 4px solid transparent;
    border-top: 4px solid var(--calcpad-wizard-outline, rgba(86, 156, 255, 0.3));
}

.cp-live-section[data-wizard-section] .cp-math-key:hover::after,
.cph-was-touched .cp-live-section[data-wizard-section] .cp-math-key:hover::after {
    border-top-color: var(--calcpad-wizard-outline, rgba(86, 156, 255, 0.6));
}

.cp-live-section[data-wizard-section] .cp-math-key:first-child,
.cph-was-touched .cp-live-section[data-wizard-section] .cp-math-key:first-child {
    animation: cp-wizard-pulse 2s ease-in-out infinite;
}

@keyframes cp-wizard-pulse {
    0%, 100% {
        box-shadow: 0 0 0 0 var(--calcpad-wizard-outline, rgba(86, 156, 255, 0.4));
    }
    50% {
        box-shadow: 0 0 0 4px var(--calcpad-wizard-outline, rgba(86, 156, 255, 0.2));
    }
}

.cp-live-section.is-wizard-section .cp-math-key:first-child {
    animation: cp-wizard-pulse 2s ease-in-out infinite;
}

.cp-live-section-title {
    margin: 0;
    font-size: 0.72em;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    opacity: 0.6;
}

.cp-live-keys {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
}

.cp-live-palette-hint {
    margin: 0;
    font-size: var(--calcpad-font-size-sm);
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
