<template>
  <div class="drawing-editor-backdrop" @click.self="close">
    <div class="drawing-editor" role="dialog" aria-modal="true" :aria-label="`Edit drawing ${source}`">
      <header class="drawing-editor-head">
        <span class="drawing-editor-title">{{ title || source }}</span>
        <span class="drawing-editor-hint">
          <span class="drawing-dot fixed"></span>fixed
          <span class="drawing-dot driven"></span>expression — drag to fix
        </span>
        <span class="spacer"></span>
        <span v-if="status" class="drawing-editor-status" :class="{ error: statusError }">{{ status }}</span>
        <button class="drawing-editor-action" title="Save the evaluated drawing as DXF (mm)" @click="exportDxf">Export DXF</button>
        <button class="drawing-editor-action" title="Replace geometry with an imported DXF" @click="pickDxf">Import DXF…</button>
        <input ref="fileEl" type="file" accept=".dxf,application/dxf" class="drawing-editor-file" @change="importDxf" />
        <button class="drawing-editor-close" title="Close (Esc)" aria-label="Close" @click="close">✕</button>
      </header>

      <div class="drawing-editor-body">
        <div v-if="loading" class="drawing-editor-note">Loading drawing…</div>
        <div v-else-if="error" class="drawing-editor-note error">{{ error }}</div>
        <!-- The server's own SVG is the canvas: handles are cloned from its node
             markers, so no geometry is re-implemented here. -->
        <div v-else ref="canvasEl" class="drawing-editor-canvas" v-html="svg"></div>
        <div v-if="band" class="drawing-band" :style="band.style"></div>
      </div>

      <footer class="drawing-editor-foot">
        <span class="drawing-editor-keys">
          drag a box to select · Ctrl+drag locks an axis · Shift+click adds a node · arrows nudge · Ctrl+A all
        </span>
        <span v-for="warning in warnings" :key="warning" class="drawing-editor-warning">{{ warning }}</span>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import type { CalcpadApiClient } from 'calcpad-frontend/api/client'

const props = defineProps<{
  /** Sidecar path exactly as the worksheet writes it. */
  source: string
  /** Worksheet on disk; the server resolves the sidecar against its directory. */
  documentPath: string | null
  api: CalcpadApiClient
}>()

const emit = defineEmits<{ close: []; saved: [] }>()

const SVG_NS = 'http://www.w3.org/2000/svg'
/** Pointer slop, in screen pixels, matching Inkscape's node tool feel. */
const SNAP_PX = 8

const canvasEl = ref<HTMLElement | null>(null)
const fileEl = ref<HTMLInputElement | null>(null)
const svg = ref('')
const title = ref('')
const loading = ref(true)
const error = ref('')
const warnings = ref<string[]>([])
const status = ref('')
const statusError = ref(false)
const selected = ref(new Set<string>())
const band = ref<{ style: Record<string, string> } | null>(null)
let disposed = false

onMounted(() => {
  void load()
  window.addEventListener('keydown', onKeyDown)
})

onBeforeUnmount(() => {
  disposed = true
  window.removeEventListener('keydown', onKeyDown)
})

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape') { close(); return }
  if (!canvasEl.value) return
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
    e.preventDefault()
    selected.value = new Set(markerNodes().map(m => m.getAttribute('data-node-id') ?? ''))
    paintSelection()
    return
  }
  const step = e.shiftKey ? 10 : 1
  const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key]
  if (!delta || selected.value.size === 0) return
  e.preventDefault()
  const k = unitsPerPixel()
  const nodes: Record<string, { x: number; y: number }> = {}
  for (const id of selected.value) {
    const marker = markerFor(id)
    if (!marker) continue
    nodes[id] = {
      x: round((Number(marker.getAttribute('cx')) || 0) + delta[0] * k),
      y: round((Number(marker.getAttribute('cy')) || 0) + delta[1] * k),
    }
  }
  void save(nodes)
}

function close(): void {
  emit('close')
}

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  const result = await props.api.parseDrawing(props.source, props.documentPath ?? undefined)
  if (disposed) return
  loading.value = false
  if (!result) {
    error.value = `Could not load “${props.source}”. Check that the sidecar exists beside the worksheet.`
    return
  }
  title.value = result.name
  warnings.value = result.warnings ?? []
  svg.value = result.svg
  await nextTick()
  attachHandles()
}

function markerNodes(): SVGCircleElement[] {
  return Array.from(canvasEl.value?.querySelectorAll<SVGCircleElement>('circle[data-node-id]') ?? [])
}

function markerFor(id: string): SVGCircleElement | null {
  return canvasEl.value?.querySelector<SVGCircleElement>(`circle[data-node-id="${CSS.escape(id)}"]`) ?? null
}

/**
 * Adds an oversized transparent twin to every node marker. The drawing's own circles
 * are a few units across, which is far too small a pointer target.
 */
function attachHandles(): void {
  const root = svgRoot()
  if (!root) return
  root.querySelectorAll('circle.cdrw-handle').forEach(h => h.remove())
  const minRadius = SNAP_PX * unitsPerPixel()
  for (const marker of markerNodes()) {
    const id = marker.getAttribute('data-node-id')
    if (!id) continue
    const radius = Number(marker.getAttribute('r')) || 0
    const handle = document.createElementNS(SVG_NS, 'circle')
    handle.setAttribute('cx', marker.getAttribute('cx') ?? '0')
    handle.setAttribute('cy', marker.getAttribute('cy') ?? '0')
    handle.setAttribute('r', String(Math.max(radius * 3, minRadius)))
    handle.setAttribute('fill', 'transparent')
    handle.setAttribute('stroke', 'none')
    handle.setAttribute('pointer-events', 'all')
    handle.setAttribute('class', 'cdrw-handle')
    handle.setAttribute('data-handle-for', id)
    const label = document.createElementNS(SVG_NS, 'title')
    label.textContent = marker.getAttribute('data-driven') === 'true'
      ? `${id} follows an expression — drag to fix it`
      : `${id} — drag to move`
    handle.appendChild(label)
    handle.addEventListener('pointerdown', e => onHandleDown(e, id))
    marker.parentNode?.appendChild(handle)
  }
  paintSelection()
  root.addEventListener('pointerdown', onCanvasDown)
}

/** Selection is drawn by class on the node markers themselves, so it survives re-renders. */
function paintSelection(): void {
  for (const marker of markerNodes()) {
    const id = marker.getAttribute('data-node-id') ?? ''
    marker.classList.toggle('cdrw-selected', selected.value.has(id))
  }
}

function svgRoot(): SVGSVGElement | null {
  return (canvasEl.value?.querySelector('svg') as SVGSVGElement | null) ?? null
}

/** Screen pixels to the drawing's own units, so every gesture survives any zoom. */
function unitsPerPixel(): number {
  const ctm = svgRoot()?.getScreenCTM()
  return ctm ? 1 / Math.hypot(ctm.a, ctm.b) : 1
}

function toUserPoint(ev: PointerEvent): { x: number; y: number } {
  const root = svgRoot()
  const matrix = root?.getScreenCTM()
  if (!root || !matrix) return { x: 0, y: 0 }
  const point = root.createSVGPoint()
  point.x = ev.clientX
  point.y = ev.clientY
  const mapped = point.matrixTransform(matrix.inverse())
  return { x: mapped.x, y: mapped.y }
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000
}

interface DragNode {
  marker: SVGCircleElement
  handle: SVGCircleElement
  origin: { x: number; y: number }
}

/** Starts a drag of the whole selection, or of just this node when it was not selected. */
function onHandleDown(ev: PointerEvent, id: string): void {
  ev.preventDefault()
  ev.stopPropagation()
  if (!selected.value.has(id)) {
    if (ev.shiftKey) selected.value.add(id)
    else selected.value = new Set([id])
    paintSelection()
  }

  const moving: DragNode[] = []
  for (const selectedId of selected.value) {
    const marker = markerFor(selectedId)
    const handle = handleFor(selectedId)
    if (!marker || !handle) continue
    moving.push({
      marker,
      handle,
      origin: { x: Number(marker.getAttribute('cx')) || 0, y: Number(marker.getAttribute('cy')) || 0 },
    })
  }
  const primary = moving.find(m => m.marker.getAttribute('data-node-id') === id)
  if (!primary || moving.length === 0) return

  const start = toUserPoint(ev)
  const latest: Record<string, { x: number; y: number }> = {}
  const k = unitsPerPixel()
  const snapTargets = markerNodes()
    .filter(m => !selected.value.has(m.getAttribute('data-node-id') ?? ''))
    .map(m => ({ x: Number(m.getAttribute('cx')) || 0, y: Number(m.getAttribute('cy')) || 0 }))

  const onMove = (e: PointerEvent) => {
    const point = toUserPoint(e)
    let dx = point.x - start.x
    let dy = point.y - start.y
    // Ctrl locks the axis, as in Inkscape's node tool.
    if (e.ctrlKey || e.metaKey) {
      if (Math.abs(dx) > Math.abs(dy)) dy = 0
      else dx = 0
    }

    let snapX = 0
    let snapY = 0
    if (!(e.ctrlKey || e.metaKey)) {
      const wantX = primary.origin.x + dx
      const wantY = primary.origin.y + dy
      let bestX = SNAP_PX * k
      let bestY = SNAP_PX * k
      for (const target of snapTargets) {
        const gapX = Math.abs(target.x - wantX)
        const gapY = Math.abs(target.y - wantY)
        if (gapX < bestX) { bestX = gapX; snapX = target.x - wantX }
        if (gapY < bestY) { bestY = gapY; snapY = target.y - wantY }
      }
    }

    for (const node of moving) {
      const x = round(node.origin.x + dx + snapX)
      const y = round(node.origin.y + dy + snapY)
      node.marker.setAttribute('cx', String(x))
      node.marker.setAttribute('cy', String(y))
      node.handle.setAttribute('cx', String(x))
      node.handle.setAttribute('cy', String(y))
      latest[node.marker.getAttribute('data-node-id') ?? ''] = { x, y }
    }
  }

  const onUp = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
    const changed = Object.entries(latest).filter(([nodeId, point]) => {
      const node = moving.find(m => m.marker.getAttribute('data-node-id') === nodeId)
      return node && (node.origin.x !== point.x || node.origin.y !== point.y)
    })
    if (changed.length === 0) return
    void save(Object.fromEntries(changed))
  }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)
}

function handleFor(id: string): SVGCircleElement | null {
  return svgRoot()?.querySelector<SVGCircleElement>(`circle.cdrw-handle[data-handle-for="${CSS.escape(id)}"]`) ?? null
}

/** Rubber-band selection on empty canvas, as the node tool does in Inkscape. */
let bandStart: { x: number; y: number } | null = null

function onCanvasDown(ev: PointerEvent): void {
  if ((ev.target as Element).closest('circle.cdrw-handle')) return
  if (ev.button !== 0) return
  const rect = canvasEl.value?.getBoundingClientRect()
  if (!rect) return
  bandStart = { x: ev.clientX - rect.left, y: ev.clientY - rect.top }
  if (!ev.shiftKey) { selected.value = new Set(); paintSelection() }
  band.value = { style: bandStyle(bandStart, bandStart) }
  window.addEventListener('pointermove', onBandMove)
  window.addEventListener('pointerup', onBandUp)
}

function onBandMove(ev: PointerEvent): void {
  const rect = canvasEl.value?.getBoundingClientRect()
  if (!rect || !bandStart) return
  band.value = { style: bandStyle(bandStart, { x: ev.clientX - rect.left, y: ev.clientY - rect.top }) }
}

function onBandUp(ev: PointerEvent): void {
  window.removeEventListener('pointermove', onBandMove)
  window.removeEventListener('pointerup', onBandUp)
  const rect = canvasEl.value?.getBoundingClientRect()
  const start = bandStart
  bandStart = null
  band.value = null
  if (!rect || !start) return
  const left = Math.min(start.x, ev.clientX - rect.left)
  const right = Math.max(start.x, ev.clientX - rect.left)
  const top = Math.min(start.y, ev.clientY - rect.top)
  const bottom = Math.max(start.y, ev.clientY - rect.top)
  if (right - left < 3 && bottom - top < 3) return
  const next = new Set(selected.value)
  for (const marker of markerNodes()) {
    const box = marker.getBoundingClientRect()
    const cx = box.left + box.width / 2 - rect.left
    const cy = box.top + box.height / 2 - rect.top
    if (cx >= left && cx <= right && cy >= top && cy <= bottom)
      next.add(marker.getAttribute('data-node-id') ?? '')
  }
  selected.value = next
  paintSelection()
}

function bandStyle(a: { x: number; y: number }, b: { x: number; y: number }): Record<string, string> {
  return {
    left: `${Math.min(a.x, b.x)}px`,
    top: `${Math.min(a.y, b.y)}px`,
    width: `${Math.abs(b.x - a.x)}px`,
    height: `${Math.abs(b.y - a.y)}px`,
  }
}

/** Saves on drop, then re-renders from disk so members and dimensions follow the nodes. */
async function save(nodes: Record<string, { x: number; y: number }>): Promise<void> {
  status.value = 'Saving…'
  statusError.value = false
  const result = await props.api.saveDrawing(props.source, nodes, props.documentPath ?? undefined)
  if (disposed) return
  if (!result) {
    status.value = 'Save failed'
    statusError.value = true
    return
  }
  status.value = `Saved ${Object.keys(nodes).join(', ')}`
  emit('saved')
  await load()
}

function pickDxf(): void {
  fileEl.value?.click()
}

async function exportDxf(): Promise<void> {
  status.value = 'Exporting…'
  statusError.value = false
  const bytes = await props.api.exportDrawingDxf(props.source, props.documentPath ?? undefined)
  if (disposed) return
  if (!bytes) {
    status.value = 'Export failed'
    statusError.value = true
    return
  }
  download(bytes, `${drawingName()}.dxf`, 'application/dxf')
  status.value = 'Exported DXF'
}

/** The reader returns literal geometry, so the result is offered as a file, not applied. */
async function importDxf(ev: Event): Promise<void> {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  status.value = 'Importing…'
  statusError.value = false
  const bytes = new Uint8Array(await file.arrayBuffer())
  const result = await props.api.importDrawingDxf(bytes)
  if (disposed) return
  if (!result) {
    status.value = 'Import failed'
    statusError.value = true
    return
  }
  warnings.value = result.warnings ?? []
  const name = file.name.replace(/\.dxf$/i, '') || 'imported-drawing'
  download(new TextEncoder().encode(result.cdrw), `${name}.cdrw`, 'text/plain')
  status.value = `Imported ${name}.cdrw`
}

function drawingName(): string {
  return (props.source.split(/[\\/]/).pop() ?? 'drawing').replace(/\.cdrw$/i, '')
}

function download(bytes: Uint8Array, name: string, type: string): void {
  const url = URL.createObjectURL(new Blob([bytes], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
</script>

<style scoped>
.drawing-editor-backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(20, 26, 32, 0.45);
}

.drawing-editor {
  display: flex;
  flex-direction: column;
  width: min(920px, 90vw);
  height: min(680px, 88vh);
  background: var(--app-surface, #fff);
  border: 1px solid var(--app-border, #c9d0d6);
  border-radius: 6px;
  box-shadow: 0 18px 48px rgba(16, 22, 28, 0.35);
  overflow: hidden;
}

.drawing-editor-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--app-border, #dfe4e8);
}

.drawing-editor-title {
  font-weight: 600;
}

.drawing-editor-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  opacity: 0.7;
}

.drawing-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1px solid #3c4852;
}

.drawing-dot.fixed {
  background: #fdfdfc;
}

.drawing-dot.driven {
  background: #e8b04b;
  border-color: #b5832b;
}

.drawing-editor-status {
  font-size: 11px;
  opacity: 0.75;
}

.drawing-editor-status.error {
  color: #b3261e;
  opacity: 1;
}

.drawing-editor-action {
  border: 1px solid var(--app-border, #c9d0d6);
  background: transparent;
  color: inherit;
  border-radius: 3px;
  font-size: 11px;
  padding: 3px 8px;
  cursor: pointer;
}

.drawing-editor-action:hover {
  background: var(--app-hover, rgba(60, 72, 82, 0.08));
}

.drawing-editor-file {
  display: none;
}

.drawing-editor-close {
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 14px;
  padding: 2px 6px;
  color: inherit;
}

.drawing-editor-body {
  position: relative;
  flex: 1;
  overflow: auto;
  background: #fdfdfc;
}

.drawing-editor-canvas {
  box-sizing: border-box;
  height: 100%;
  padding: 16px;
}

/* The sidecar SVG carries width="100%" and no height, so without an explicit height it
   would size to the viewBox ratio and overflow the pane. */
.drawing-editor-canvas :deep(svg.drawing) {
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none;
}

.drawing-editor-canvas :deep(circle[data-driven='true']) {
  fill: #e8b04b;
  stroke: #b5832b;
}

/* Inkscape's node-tool selection blue, on the marker itself so it survives re-renders. */
.drawing-editor-canvas :deep(circle[data-node-id].cdrw-selected) {
  fill: #2f6df6;
  stroke: #1c4bb0;
  stroke-width: 2;
}

.drawing-band {
  position: absolute;
  border: 1px dashed #2f6df6;
  background: rgba(47, 109, 246, 0.08);
  pointer-events: none;
}

.drawing-editor-note {
  padding: 24px;
  text-align: center;
  opacity: 0.75;
}

.drawing-editor-note.error {
  color: #b3261e;
  opacity: 1;
}

.drawing-editor-foot {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 12px;
  border-top: 1px solid var(--app-border, #dfe4e8);
  font-size: 11px;
  opacity: 0.75;
}

.drawing-editor-keys {
  letter-spacing: 0.01em;
}

.spacer {
  flex: 1;
}
</style>
