<template>
  <div class="math-tools" role="group" aria-label="Equation tools">
    <!-- Resizing by hand means retyping every cell. Only the field being worked on can
         have a matrix, so this strip is as conditional as the field itself. -->
    <div v-if="size" class="math-tools__matrix">
      <span class="math-tools__size">{{ size.rows }} × {{ size.cols }}</span>
      <button
        v-for="b in MATRIX_BUTTONS"
        :key="b.op"
        type="button"
        class="math-tools__btn"
        :title="b.title"
        :aria-label="b.title"
        :disabled="matrixOpDisabled(b.op, size)"
        @mousedown.prevent
        @click="reshape(b.op)"
      >{{ b.label }}</button>
    </div>

    <!-- The palette: a bordered collapsible section with a grid of square glyph buttons,
         which is what the Insert tab already does for its Symbol Palette. Collapsed by
         default -- it is a reference, not something wanted on every line. -->
    <div class="math-tools__panel">
      <div class="math-tools__bar">
        <button
          type="button"
          class="math-tools__toggle"
          :aria-expanded="paletteOpen"
          @mousedown.prevent
          @click="paletteOpen = !paletteOpen"
        >
          <span class="math-tools__arrow" :class="{ open: paletteOpen }" aria-hidden="true">▶</span>
          Insert
        </button>
        <span class="math-tools__spacer" />
        <button
          v-for="b in EDIT_BUTTONS"
          :key="b.command"
          type="button"
          class="math-tools__btn"
          :title="b.title"
          :aria-label="b.title"
          @mousedown.prevent
          @click="command(b.command)"
        >{{ b.label }}</button>
      </div>

      <div v-show="paletteOpen" class="math-tools__body">
        <div v-for="group in groups" :key="group.name" class="math-tools__group">
          <div class="math-tools__group-label">{{ group.name }}</div>
          <div class="math-tools__grid">
            <button
              v-for="t in group.items"
              :key="t.label + t.latex"
              type="button"
              class="math-tools__tpl"
              :title="t.title"
              :aria-label="t.title"
              @mousedown.prevent
              @click="insert(t)"
            >{{ t.label }}</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The editing controls for the live editor, docked once above the canvas.
 *
 * They used to sit inside every field, which at sidebar width wrapped 21 buttons into a
 * single column beside each equation. One toolbar, pointed at whichever field the user is
 * working on, keeps the canvas readable and matches how the rest of the panel is arranged.
 *
 * The handle is nullable because a field withdraws it the moment it stops being edited,
 * which can land between a press and its click. Every action is a no-op without one.
 */
import { computed, ref } from 'vue';
import { INSERT_TEMPLATES } from '../../math/insertTemplates';
import type { InsertTemplate } from '../../math/insertTemplates';
import { EDIT_BUTTONS, MATRIX_BUTTONS, matrixOpDisabled } from '../../math/mathFieldTools';
import type { MatrixOp, MatrixSize, MathFieldHandle } from '../../math/mathFieldTools';

const props = defineProps<{ handle: MathFieldHandle | null }>();

const size = computed<MatrixSize | null>(() => props.handle?.size ?? null);

const paletteOpen = ref(false);

/** Group headings come from the templates themselves, so a new one needs no edit here. */
const groups = computed(() =>
    [...new Set(INSERT_TEMPLATES.map((t) => t.group))].map((name) => ({
        name,
        items: INSERT_TEMPLATES.filter((t) => t.group === name),
    })),
);

function insert(template: InsertTemplate): void {
    props.handle?.insert(template.latex);
}

function command(name: string): void {
    props.handle?.command(name);
}

function reshape(op: MatrixOp): void {
    props.handle?.reshape(op);
}
</script>

<style scoped>
.math-tools {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--vscode-widget-border);
}

.math-tools__matrix {
    display: flex;
    align-items: center;
    gap: 2px;
    /* Five items in a sidebar-width row: the size must not be the thing that wraps. */
    flex-wrap: nowrap;
}

.math-tools__size {
    flex: 0 0 auto;
    margin-right: 4px;
    white-space: nowrap;
    font-size: var(--calcpad-font-size-sm);
    color: var(--vscode-descriptionForeground);
    font-variant-numeric: tabular-nums;
}

.math-tools__matrix .math-tools__btn {
    flex: 1 1 auto;
}

.math-tools__panel {
    border: 1px solid var(--vscode-widget-border);
    border-radius: 3px;
    overflow: hidden;
}

.math-tools__bar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 6px;
    background: var(--vscode-sideBar-background);
}

.math-tools__bar:hover {
    background: var(--vscode-list-hoverBackground);
}

.math-tools__toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 2px 2px 0;
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    font-family: var(--vscode-font-family);
    font-size: var(--calcpad-font-size-md);
    font-weight: bold;
}

.math-tools__arrow {
    display: inline-block;
    font-size: var(--calcpad-font-size-xxs);
    transition: transform 0.2s ease;
}

.math-tools__arrow.open {
    transform: rotate(90deg);
}

.math-tools__spacer {
    flex: 1;
}

.math-tools__body {
    padding: 6px 8px 8px;
}

.math-tools__group + .math-tools__group {
    margin-top: 8px;
}

.math-tools__group-label {
    margin-bottom: 4px;
    font-size: var(--calcpad-font-size-sm);
    font-weight: 600;
    color: var(--vscode-descriptionForeground);
}

/* Square glyph buttons, the measure the Insert tab's symbol grid uses. */
.math-tools__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(30px, 1fr));
    gap: 2px;
}

.math-tools__tpl,
.math-tools__btn {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 24px;
    padding: 4px 6px;
    background: var(--vscode-editor-background);
    color: var(--vscode-editor-foreground);
    border: 1px solid var(--vscode-widget-border);
    border-radius: 2px;
    cursor: pointer;
    font-family: var(--vscode-font-family);
    font-size: var(--calcpad-font-size-sm);
    line-height: 1;
}

.math-tools__tpl:hover,
.math-tools__btn:hover:not(:disabled) {
    background: var(--vscode-list-hoverBackground);
    border-color: var(--vscode-focusBorder);
}

.math-tools__btn:disabled {
    opacity: 0.4;
    cursor: default;
}
</style>
