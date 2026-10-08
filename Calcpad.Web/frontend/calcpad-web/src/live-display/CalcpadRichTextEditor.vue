<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { htmlToMarkdown } from 'calcpad-frontend'

/**
 * The rich-text surface for an `#html` line or a `#markdown` block.
 *
 * A `contenteditable` element holds the engine's own rendering of the block, so
 * what the user edits is what they already saw. Two rules keep that safe:
 *
 * - **Paste is plain text.** A pasted fragment would otherwise bring in markup
 *   the Markdown subset has no spelling for, and the commit would be refused
 *   after the user had already done the work.
 * - **Nothing is written back unless it changed.** The browser normalises markup
 *   as soon as it parses it, so an untouched block would come back subtly
 *   rewritten. `dirty` gates that: an edit the user did not make is not an edit.
 *
 * Formatting uses `document.execCommand`, which is deprecated but is the only
 * way to drive `contenteditable` without adopting a rich-text framework, and is
 * still implemented by every engine the three hosts run on.
 */

const props = defineProps<{
  /** The author markup to open, anchors already stripped. */
  html: string
  mode: 'html' | 'markdown'
  dark?: boolean
  /** What is being edited, for the heading and the accessible name. */
  label?: string
}>()

const emit = defineEmits<{
  /** The current markup, and whether the user has actually changed it. */
  change: [html: string, dirty: boolean]
  finish: []
  cancel: []
}>()

const surfaceEl = ref<HTMLElement | null>(null)
const dirty = ref(false)
const showSource = ref(false)

/** The Markdown this block would be written back as, when it can be. */
const preview = computed(() => {
  if (props.mode === 'html') return props.html
  return htmlToMarkdown(props.html) ?? '— this block has no Markdown spelling —'
})

function readHtml(): string {
  return surfaceEl.value?.innerHTML ?? ''
}

function publish(): void {
  emit('change', readHtml(), dirty.value)
}

function onInput(): void {
  dirty.value = true
  publish()
}

/** Put the caret back after a toolbar press, which moves focus to the button. */
function refocus(): void {
  surfaceEl.value?.focus()
}

function exec(command: string, value?: string): void {
  refocus()
  document.execCommand(command, false, value)
  dirty.value = true
  publish()
}

function formatBlock(tag: string): void {
  exec('formatBlock', `<${tag}>`)
}

/** Wrap the selection in an inline element `execCommand` has no command for. */
function wrapInline(tag: 'code' | 'sub' | 'sup' | 'ins' | 'del'): void {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    // Nothing selected: drop an empty element and leave the caret inside it.
    exec('insertHTML', `<${tag}></${tag}>`)
    return
  }
  const range = selection.getRangeAt(0)
  const element = document.createElement(tag)
  try {
    element.appendChild(range.extractContents())
    range.insertNode(element)
  } catch {
    // A selection spanning blocks cannot be surrounded; fall back to plain text.
    exec('insertHTML', `<${tag}>${selection.toString()}</${tag}>`)
  }
  selection.removeAllRanges()
  const after = document.createRange()
  after.selectNodeContents(element)
  selection.addRange(after)

  dirty.value = true
  publish()
  refocus()
}

function addLink(): void {
  const url = window.prompt('Link address', 'https://')
  if (!url) return
  exec('createLink', url)
}

/**
 * Paste as plain text.
 *
 * The clipboard's HTML would carry classes, styles and elements the Markdown
 * subset cannot spell, which would make the block uncommittable. Taking only the
 * text keeps the surface inside the subset by construction.
 */
function onPaste(event: ClipboardEvent): void {
  event.preventDefault()
  const text = event.clipboardData?.getData('text/plain') ?? ''
  if (text === '') return
  document.execCommand('insertText', false, text)
  dirty.value = true
  publish()
}

/** A drop would insert markup from outside the page; only typing and pasting may. */
function onDrop(event: DragEvent): void {
  event.preventDefault()
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('cancel')
    return
  }
  // Ctrl/Cmd+B and I are the familiar shortcuts; let the browser handle the rest.
  if ((event.ctrlKey || event.metaKey) && !event.shiftKey) {
    const key = event.key.toLowerCase()
    if (key === 'b') { event.preventDefault(); exec('bold') }
    else if (key === 'i') { event.preventDefault(); exec('italic') }
  }
}

function load(): void {
  const surface = surfaceEl.value
  if (!surface) return
  surface.innerHTML = props.html
  dirty.value = false
  publish()
}

onMounted(() => void nextTick(load))

/** Focus the surface, so opening a block lands ready to type. */
function focus(): void {
  surfaceEl.value?.focus()
}

defineExpose({ focus })

// A new block opened in the same component: reload, and drop the previous edit.
watch(() => props.html, (next, previous) => {
  if (next !== previous) void nextTick(load)
})
</script>

<template>
  <div class="rich-text" :class="{ dark }">
    <div class="rich-text-bar" role="toolbar" aria-label="Formatting">
      <button type="button" title="Bold (Ctrl+B)" aria-label="Bold" @mousedown.prevent @click="exec('bold')"><b>B</b></button>
      <button type="button" title="Italic (Ctrl+I)" aria-label="Italic" @mousedown.prevent @click="exec('italic')"><i>I</i></button>
      <button type="button" title="Strikethrough" aria-label="Strikethrough" @mousedown.prevent @click="exec('strikeThrough')"><s>S</s></button>
      <button type="button" title="Inline code" aria-label="Inline code" @mousedown.prevent @click="wrapInline('code')">&lt;/&gt;</button>
      <span class="rich-text-sep" aria-hidden="true"></span>
      <button type="button" title="Heading" aria-label="Heading" @mousedown.prevent @click="formatBlock('h2')">H</button>
      <button type="button" title="Bulleted list" aria-label="Bulleted list" @mousedown.prevent @click="exec('insertUnorderedList')">•</button>
      <button type="button" title="Numbered list" aria-label="Numbered list" @mousedown.prevent @click="exec('insertOrderedList')">1.</button>
      <button type="button" title="Quote" aria-label="Quote" @mousedown.prevent @click="formatBlock('blockquote')">❝</button>
      <button type="button" title="Code block" aria-label="Code block" @mousedown.prevent @click="formatBlock('pre')">{ }</button>
      <span class="rich-text-sep" aria-hidden="true"></span>
      <button type="button" title="Link" aria-label="Link" @mousedown.prevent @click="addLink">🔗</button>
      <button type="button" title="Horizontal rule" aria-label="Horizontal rule" @mousedown.prevent @click="exec('insertHorizontalRule')">―</button>
      <span class="rich-text-spacer"></span>
      <button
        type="button"
        class="rich-text-toggle"
        :class="{ active: showSource }"
        :aria-pressed="showSource"
        title="Show what will be written back"
        @mousedown.prevent
        @click="showSource = !showSource"
      >Source</button>
    </div>

    <div
      ref="surfaceEl"
      class="rich-text-surface"
      role="textbox"
      aria-multiline="true"
      :aria-label="label ? `Edit ${label}` : 'Edit content'"
      contenteditable="true"
      @input="onInput"
      @paste="onPaste"
      @drop="onDrop"
      @keydown="onKeydown"
      @blur="emit('finish')"
    ></div>

    <pre v-if="showSource" class="rich-text-source">{{ preview }}</pre>

    <div class="rich-text-foot">
      <span class="rich-text-hint">
        {{ dirty ? 'Edited' : 'Unchanged — nothing will be written back' }}
      </span>
      <button type="button" class="rich-text-done" @mousedown.prevent @click="emit('finish')">Done</button>
    </div>
  </div>
</template>

<style scoped>
.rich-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
  border: 1px solid var(--vscode-focusBorder, #007acc);
  border-radius: 3px;
  background: var(--vscode-editor-background, #1e1e1e);
  padding: 4px;
}
.rich-text-bar {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-wrap: wrap;
}
.rich-text-bar button {
  min-width: 24px;
  height: 22px;
  padding: 0 5px;
  background: var(--vscode-button-secondaryBackground, #3a3d41);
  border: 1px solid transparent;
  border-radius: 2px;
  color: var(--vscode-button-secondaryForeground, #ccc);
  font-size: var(--calcpad-font-size-xs, 11px);
  line-height: 1;
  cursor: pointer;
}
.rich-text-bar button:hover {
  background: var(--vscode-button-secondaryHoverBackground, #45494e);
  border-color: var(--vscode-focusBorder, #007acc);
}
.rich-text-toggle.active {
  background: var(--vscode-button-background, #0e639c);
  color: var(--vscode-button-foreground, #fff);
}
.rich-text-sep {
  width: 1px;
  height: 16px;
  margin: 0 3px;
  background: var(--vscode-panel-border, rgba(128, 128, 128, 0.35));
}
.rich-text-spacer {
  flex: 1;
}
.rich-text-surface {
  min-height: 1.6em;
  padding: 4px 6px;
  border: 1px solid var(--vscode-input-border, rgba(128, 128, 128, 0.35));
  border-radius: 2px;
  background: var(--vscode-input-background, #3c3c3c);
  color: var(--vscode-input-foreground, #ccc);
  font-size: var(--calcpad-font-size-sm, 13px);
  line-height: 1.5;
  overflow-wrap: anywhere;
  cursor: text;
}
.rich-text-surface:focus {
  outline: none;
  border-color: var(--vscode-focusBorder, #007acc);
}
/* Keep the engine's own typography recognisable inside the surface. */
.rich-text-surface :deep(h1),
.rich-text-surface :deep(h2),
.rich-text-surface :deep(h3) {
  margin: 0.4em 0 0.2em;
  font-size: 1.15em;
}
.rich-text-surface :deep(blockquote) {
  margin: 0.3em 0;
  padding-left: 8px;
  border-left: 3px solid var(--vscode-panel-border, #888);
}
.rich-text-surface :deep(pre),
.rich-text-surface :deep(code) {
  font-family: var(--vscode-editor-font-family, monospace);
  background: rgba(128, 128, 128, 0.18);
}
.rich-text-surface :deep(pre) {
  padding: 4px 6px;
  border-radius: 2px;
  overflow-x: auto;
}
.rich-text-surface :deep(table) {
  border-collapse: collapse;
}
.rich-text-surface :deep(th),
.rich-text-surface :deep(td) {
  border: 1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.35));
  padding: 1px 5px;
}
.rich-text-surface :deep(hr) {
  border: none;
  border-top: 1px solid var(--vscode-panel-border, #888);
}
.rich-text-source {
  margin: 0;
  padding: 4px 6px;
  max-height: 9em;
  overflow: auto;
  background: var(--vscode-textCodeBlock-background, #2a2a2a);
  border-radius: 2px;
  color: var(--vscode-descriptionForeground, #9a9a9a);
  font-family: var(--vscode-editor-font-family, monospace);
  font-size: var(--calcpad-font-size-xs, 11px);
  white-space: pre-wrap;
}
.rich-text-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.rich-text-hint {
  color: var(--vscode-descriptionForeground, #9a9a9a);
  font-size: var(--calcpad-font-size-xs, 11px);
}
.rich-text-done {
  padding: 2px 10px;
  background: var(--vscode-button-background, #0e639c);
  border: none;
  border-radius: 2px;
  color: var(--vscode-button-foreground, #fff);
  font-size: var(--calcpad-font-size-xs, 11px);
  cursor: pointer;
}
</style>
