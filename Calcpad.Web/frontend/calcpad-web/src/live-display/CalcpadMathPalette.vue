<script setup lang="ts">
import { computed, ref } from 'vue'
import { MATH_PALETTE, PALETTE_GROUPS, searchPalette } from 'calcpad-frontend'
import type { PaletteAction, PaletteGroup } from 'calcpad-frontend'

/**
 * The live editor's math palette. Purely a button grid: it never touches the
 * line, it only says which action was picked, so the same palette can drive the
 * line field, a matrix cell or a function argument without knowing about any of
 * them. Buttons cancel `mousedown` so the field being edited keeps focus and its
 * caret — the click then lands on an input that still knows where the user was.
 */
const emit = defineEmits<{
  pick: [action: PaletteAction]
  /** Which groups the reader has folded away, so the pane can remember it. */
  'update:collapsed': [names: string[]]
}>()

const props = withDefaults(defineProps<{
  /**
   * The folded groups. Owned by the caller because this component is mounted
   * inside the editor, which unmounts whenever the editor closes — keeping the
   * state here would silently unfold every group on each new edit.
   */
  collapsed?: string[]
}>(), {
  // Structures and Functions are the ones people reach for while building an
  // expression, so they open by default; the symbol tables stay folded away.
  collapsed: () => ['Operators', 'Relations', 'Greek'],
})

const query = ref('')
const collapsed = computed(() => new Set(props.collapsed as PaletteGroup[]))

const groups = computed(() => {
  const matches = searchPalette(query.value)
  const byGroup = new Map<string, PaletteAction[]>()
  for (const action of matches) {
    const bucket = byGroup.get(action.group)
    if (bucket) bucket.push(action)
    else byGroup.set(action.group, [action])
  }
  return PALETTE_GROUPS
    .map(name => ({ name, items: byGroup.get(name) ?? [] }))
    .filter(group => group.items.length > 0)
})

const searching = computed(() => query.value.trim().length > 0)
const isOpen = (name: string): boolean => searching.value || !collapsed.value.has(name as PaletteGroup)

function toggle(name: string): void {
  const next = new Set(props.collapsed)
  if (next.has(name as PaletteGroup)) next.delete(name as PaletteGroup)
  else next.add(name as PaletteGroup)
  emit('update:collapsed', [...next])
}

const pick = (action: PaletteAction): void => emit('pick', action)
</script>

<template>
  <div class="math-palette" role="toolbar" aria-label="Math palette">
    <div class="math-palette-search">
      <input
        v-model="query"
        class="math-palette-search-input"
        type="search"
        placeholder="Search symbols and functions"
        aria-label="Search the math palette"
        @keydown.enter.prevent
      />
    </div>
    <div v-if="groups.length === 0" class="math-palette-empty">No matching symbol.</div>
    <div v-for="group in groups" :key="group.name" class="math-palette-group">
      <button
        class="math-palette-group-header"
        type="button"
        :aria-expanded="isOpen(group.name)"
        @mousedown.prevent
        @click="toggle(group.name)"
      >
        <span class="math-palette-arrow" :class="{ open: isOpen(group.name) }">&#x25B6;</span>
        <span>{{ group.name }}</span>
      </button>
      <div v-show="isOpen(group.name)" class="math-palette-grid">
        <button
          v-for="action in group.items"
          :key="action.id"
          type="button"
          class="math-palette-btn"
          :title="action.title + ' — ' + action.syntax"
          :aria-label="action.title"
          @mousedown.prevent
          @click="pick(action)"
        >{{ action.label }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.math-palette {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 190px;
  overflow-y: auto;
  padding: 4px;
  border: 1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.35));
  border-radius: 3px;
  background: var(--vscode-editorWidget-background, #252526);
}
.math-palette-search {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--vscode-editorWidget-background, #252526);
  padding-bottom: 2px;
}
.math-palette-search-input {
  width: 100%;
  box-sizing: border-box;
  padding: 2px 6px;
  background: var(--vscode-input-background, #3c3c3c);
  border: 1px solid var(--vscode-input-border, #3c3c3c);
  border-radius: 2px;
  color: var(--vscode-input-foreground, #ccc);
  font-size: var(--calcpad-font-size-xs, 11px);
}
.math-palette-search-input:focus {
  outline: none;
  border-color: var(--vscode-focusBorder, #007acc);
}
.math-palette-empty {
  padding: 4px 2px;
  color: var(--vscode-descriptionForeground, #808080);
  font-size: var(--calcpad-font-size-xs, 11px);
}
.math-palette-group-header {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  padding: 2px 2px;
  background: none;
  border: none;
  color: var(--vscode-descriptionForeground, #9a9a9a);
  font-size: var(--calcpad-font-size-xs, 11px);
  text-align: left;
  cursor: pointer;
}
.math-palette-group-header:hover {
  color: var(--vscode-editor-foreground, #ccc);
}
.math-palette-arrow {
  font-size: 8px;
  transition: transform 0.1s ease;
}
.math-palette-arrow.open {
  transform: rotate(90deg);
}
.math-palette-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  padding: 2px 0 4px;
}
.math-palette-btn {
  min-width: 24px;
  height: 24px;
  padding: 0 5px;
  background: var(--vscode-button-secondaryBackground, #3a3d41);
  border: 1px solid transparent;
  border-radius: 2px;
  color: var(--vscode-button-secondaryForeground, #ccc);
  font-size: var(--calcpad-font-size-sm, 12px);
  line-height: 1;
  cursor: pointer;
}
.math-palette-btn:hover {
  background: var(--vscode-button-secondaryHoverBackground, #45494e);
  border-color: var(--vscode-focusBorder, #007acc);
}
.math-palette-btn:active {
  transform: translateY(1px);
}
</style>
