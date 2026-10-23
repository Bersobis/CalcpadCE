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
      <span class="cp-live-stats">{{ statsText }}</span>
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
        />
        <span class="cp-live-palette-count">
          {{ paletteQuery ? `${matchCount} of ${entryCount}` : `${entryCount} buttons` }}
        </span>
      </div>

      <!-- One line that always says what the buttons will act on: the equation being edited
           (and which line it is), or the click that makes one. Without it the docked palette
           looks like it belongs to whatever the pointer last touched. -->
      <p class="cp-live-palette-status">{{ paletteStatus }}</p>

      <div class="cp-live-palette-body">
        <section v-for="section in visibleSections" :key="section.id" class="cp-live-section">
          <!-- Sections collapse: twelve of them, some with two dozen buttons, is more than fits
               beside the maths at sidebar width. The header carries the count so a collapsed
               section still says what is inside it. -->
          <button
            class="cp-live-section-title"
            :aria-expanded="!isCollapsed(section.id)"
            @click="toggleSection(section.id)"
          >
            <span class="cp-live-section-chevron" aria-hidden="true">{{ isCollapsed(section.id) ? '▸' : '▾' }}</span>
            <span class="cp-live-section-label">{{ section.label }}</span>
            <span class="cp-live-section-count">{{ section.entries.length }}</span>
          </button>
          <div v-show="!isCollapsed(section.id)" class="cp-live-keys">
            <button
              v-for="entry in section.entries"
              :key="entry.id"
              class="cp-math-key"
              :title="keyTitle(entry)"
              :aria-label="keyLabel(entry)"
              :disabled="!activeTarget"
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
          :show-palette="false"
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
import { computed, nextTick, onMounted, onUpdated, ref, shallowRef, watch } from 'vue';
import CalcpadMathField from './CalcpadMathField.vue';
import {
    LineModel, LineRegion, PaletteEntry, PaletteSectionId, PALETTE_ENTRIES,
    PALETTE_SECTIONS, supportsMathMlCore, filterPalette, stretchMatrixFences, toMathMlDocument,
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

/** Which sections the user folded away. Searching ignores it — see the watcher below. */
const collapsed = ref(new Set<PaletteSectionId>());

function isCollapsed(id: PaletteSectionId): boolean {
    return collapsed.value.has(id);
}

function toggleSection(id: PaletteSectionId): void {
    const next = new Set(collapsed.value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    collapsed.value = next;
}

// A match hidden behind a folded header is a match the user cannot see, so typing a query
// unfolds everything; what was folded stays folded for when the query is cleared.
watch(paletteQuery, (query) => {
    if (query.trim() !== '' && collapsed.value.size > 0) collapsed.value = new Set();
});

const statsText = computed(() =>
    `${equationCount.value} equation${equationCount.value === 1 ? '' : 's'} of ${regions.value.length} lines`);

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
const activeTarget = shallowRef<{ line: number; field: FieldApi } | null>(null);

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

/**
 * The status line under the search box. It names the line the buttons will write into, because
 * a palette docked above the worksheet otherwise looks like it belongs to whatever the pointer
 * last touched — and an insert into the wrong equation is an edit the user has to undo.
 */
const paletteStatus = computed(() => {
    const target = activeTarget.value;
    if (target) {
        return `Inserting into line ${target.line + 1} — click another equation to retarget.`;
    }
    if (equationCount.value === 0) {
        return 'No equations in this worksheet yet — the buttons act on the equation you are editing.';
    }
    return 'Click an equation to edit it, then use these.';
});

function registerField(line: number, instance: unknown): void {
    if (instance) {
        const field = instance as FieldApi;
        fields.set(line, field);
        // A region can be re-created (its kind changing re-keys it), which re-registers the same
        // line. Refresh the toolbar's target rather than leaving it on the unmounted instance.
        if (activeTarget.value?.line === line) activeTarget.value = { line, field };
        return;
    }
    fields.delete(line);
    if (activeTarget.value?.line === line) {
        activeTarget.value = null;
    }
}

function onActivate(line: number): void {
    const field = fields.get(line);
    activeTarget.value = field ? { line, field } : null;
}

function applyEntry(entry: PaletteEntry): void {
    const target = activeTarget.value;
    if (!target) return;
    target.field.applyEntry(entry);
    target.field.focus();
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
    border-radius: 6px;
}

/* The section header is the fold control: a full-width button so the whole row is the target,
   with the count at the far end — a folded section still says what is inside it. */
.cp-live-section-title {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    margin: 0;
    padding: 2px 4px;
    border: none;
    border-radius: 4px;
    background: none;
    color: var(--vscode-foreground);
    font-size: 0.72em;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    text-align: left;
    cursor: pointer;
}

.cp-live-section-title:hover {
    background: var(--vscode-list-hoverBackground, rgba(128, 128, 128, 0.08));
}

.cp-live-section-title:focus-visible {
    outline: 1px solid var(--vscode-focusBorder, #0078d4);
    outline-offset: -1px;
}

.cp-live-section-chevron {
    flex: 0 0 auto;
    width: 0.8em;
    opacity: 0.7;
}

.cp-live-section-label {
    flex: 1 1 auto;
    opacity: 0.6;
}

.cp-live-section-count {
    flex: 0 0 auto;
    padding: 0 5px;
    border-radius: 8px;
    background: var(--vscode-button-secondaryBackground, rgba(128, 128, 128, 0.15));
    color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
    font-size: 0.9em;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0;
    text-transform: none;
}

.cp-live-keys {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
}

/* What the buttons act on and where — always present, not only while nothing is targeted. */
.cp-live-palette-status {
    margin: 0;
    font-size: var(--calcpad-font-size-sm);
    opacity: 0.75;
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
