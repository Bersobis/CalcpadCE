/**
 * Maps the entities the Live Display renders back to their text in the source line.
 *
 * The pane draws whatever the server typeset, which for a function call is a radical
 * rather than `sqrt(...)` — so a rendered token cannot be traced to source text by
 * looking at it. These helpers go the other way instead: they read the source line,
 * find the entities in it, and hand back a span per cell/argument. The rendered side
 * only has to say *which* cell was clicked (row/column), which the server's grid
 * markup already tells us.
 */

/** A half-open `[start, end)` range into a source line. */
export interface Span {
  start: number
  end: number
}

export interface CellSpan extends Span {
  row: number
  col: number
}

/** A `[...]` matrix/vector literal, with one span per cell. */
export interface MatrixLiteral {
  /** Span of the whole literal, including both brackets. */
  span: Span
  /** `cells[row][col]`, in source order. */
  cells: CellSpan[][]
}

/** A function call, with a span per `;`-separated argument. */
export interface CallArguments {
  /** Span of the function name. */
  nameSpan: Span
  args: Span[]
}

function isQuote(ch: string): boolean {
  return ch === '"' || ch === "'"
}

/** Index of the `]` matching the `[` at `open`, or -1. Quoted text is stepped over. */
function matchBracket(line: string, open: number): number {
  let depth = 0
  let quote: string | null = null
  for (let i = open; i < line.length; i++) {
    const ch = line[i]
    if (quote) {
      if (ch === quote) quote = null
      continue
    }
    if (isQuote(ch)) {
      quote = ch
      continue
    }
    if (ch === '[') depth++
    else if (ch === ']') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

/** Index of the `)` matching the `(` at `open`, or -1. */
function matchParen(line: string, open: number): number {
  let depth = 0
  let quote: string | null = null
  for (let i = open; i < line.length; i++) {
    const ch = line[i]
    if (quote) {
      if (ch === quote) quote = null
      continue
    }
    if (isQuote(ch)) {
      quote = ch
      continue
    }
    if (ch === '(') depth++
    else if (ch === ')') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

/** Trim an inner span to the text between it and the first/last non-space character. */
function trimSpan(line: string, start: number, end: number): Span {
  let s = start
  let e = end
  while (s < e && /\s/.test(line[s])) s++
  while (e > s && /\s/.test(line[e - 1])) e--
  return { start: s, end: e }
}

/**
 * The first `[...]` literal on the line, split into cells the way Calcpad reads it:
 * `;` separates columns and `|` separates rows. A line with no literal returns null.
 */
export function findMatrixLiteral(line: string): MatrixLiteral | null {
  const start = line.indexOf('[')
  if (start === -1) return null
  const end = matchBracket(line, start)
  if (end === -1) return null

  const cells: CellSpan[][] = []
  let row = 0
  let col = 0
  let cellStart = start + 1

  const closeCell = (to: number) => {
    const span = trimSpan(line, cellStart, to)
    ;(cells[row] ??= []).push({ ...span, row, col })
    col++
  }

  for (let i = start + 1; i < end; i++) {
    const ch = line[i]
    if (ch === ';') {
      closeCell(i)
      cellStart = i + 1
    } else if (ch === '|') {
      closeCell(i)
      row++
      col = 0
      cellStart = i + 1
    }
  }
  closeCell(end)

  return { span: { start, end: end + 1 }, cells }
}

/**
 * The first function call on the line, with each `;`-separated argument as a span.
 * Nested calls are left inside their argument's span — editing an argument replaces
 * the whole nested expression, which is what typing over it would do anyway.
 */
export function findCallArguments(line: string): CallArguments | null {
  for (let open = line.indexOf('('); open !== -1; open = line.indexOf('(', open + 1)) {
    let nameEnd = open
    while (nameEnd > 0 && /\s/.test(line[nameEnd - 1])) nameEnd--
    let nameStart = nameEnd
    while (nameStart > 0 && /[A-Za-z0-9_]/.test(line[nameStart - 1])) nameStart--
    if (nameStart === nameEnd) continue

    const close = matchParen(line, open)
    if (close === -1) continue

    const args: Span[] = []
    let argStart = open + 1
    let depth = 1
    let quote: string | null = null
    for (let i = open + 1; i < close; i++) {
      const ch = line[i]
      if (quote) {
        if (ch === quote) quote = null
        continue
      }
      if (isQuote(ch)) quote = ch
      else if (ch === '(') depth++
      else if (ch === ')') depth--
      else if (ch === ';' && depth === 1) {
        args.push(trimSpan(line, argStart, i))
        argStart = i + 1
      }
    }
    args.push(trimSpan(line, argStart, close))

    return { nameSpan: { start: nameStart, end: nameEnd }, args }
  }
  return null
}

/**
 * Apply replacements to a line. Edits are applied from the end backwards so each
 * span stays valid while the ones before it are still to come.
 */
export function applySpans(line: string, edits: { span: Span; text: string }[]): string {
  let result = line
  const ordered = [...edits].sort((a, b) => b.span.start - a.span.start)
  for (const { span, text } of ordered) {
    result = result.slice(0, span.start) + text + result.slice(span.end)
  }
  return result
}

/** The text a span currently covers. */
export function spanText(line: string, span: Span): string {
  return line.slice(span.start, span.end)
}
