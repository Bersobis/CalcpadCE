// Matrix brackets, stretched by hand.
//
// Chromium's MathML engine does not stretch `[` and `]` around an `<mtable>`: `stretchy` and
// `minsize` are ignored and `<mfenced>` renders no fences at all (measured — no font helps
// either), so a matrix's brackets sit at glyph height beside a table several lines tall.
// Scaling each fence to its table's measured height after every render restores what Calcpad
// shows. This is visual only: the model, the printer and the caret never see it.

const FENCE_GLYPHS = new Set(['[', ']']);

/** Stretch the `[` `]` around every matrix in `host` to its table's height. Idempotent. */
export function stretchMatrixFences(host: HTMLElement | null): void {
    if (!host) return;
    for (const table of Array.from(host.querySelectorAll('mtable'))) {
        const row = table.parentElement;
        // The parser and the structure builder both make a matrix `mrow[ mo('['), mtable, mo(']') ]`.
        if (!row || row.children.length !== 3) continue;
        const [open, , close] = Array.from(row.children);
        if (open.localName !== 'mo' || close.localName !== 'mo') continue;
        if (!FENCE_GLYPHS.has(open.textContent ?? '') || !FENCE_GLYPHS.has(close.textContent ?? '')) continue;

        const target = table.getBoundingClientRect().height;
        if (target <= 0) continue;
        for (const fence of [open, close] as HTMLElement[]) {
            fence.style.transform = 'none';
            // The natural height, measured with the previous transform cleared: the first pass
            // stores the glyph, every later pass re-reads it instead of compounding the scale.
            const natural = fence.getBoundingClientRect().height;
            if (natural <= 0 || target <= natural + 0.5) continue;
            fence.style.transformOrigin = 'center';
            fence.style.transform = `scaleY(${(target / natural).toFixed(4)})`;
        }
    }
}
