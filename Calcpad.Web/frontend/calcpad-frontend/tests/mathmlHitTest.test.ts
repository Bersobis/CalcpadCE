// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
    taggedPath,
    anchorFromDomPoint,
    anchorForClick,
} from '../src/mathml/hit-test';
import { lineEditorModel, clearLineEditorCache, partialTypesetMarkup } from '../src/mathml/line-model';
import { serializeWithPaths } from '../src/mathml/serialize';
import { calcpadLineToMathMl, mathMlToCalcpadLine } from '../src/mathml/calcpad';
import { anchorIndex, moveHorizontal } from '../src/mathml/caret';
import type { Anchor } from '../src/mathml/caret';

/** Mount a serialized MathML tree into a detached container, as the editor does. */
function mount(source: string): { surface: HTMLElement; root: NonNullable<ReturnType<typeof calcpadLineToMathMl>['root']> } {
    const parsed = calcpadLineToMathMl(source);
    if (!parsed.root) throw new Error(`not parseable: ${source}`);
    const surface = document.createElement('div');
    surface.innerHTML = serializeWithPaths(parsed.root);
    document.body.appendChild(surface);
    return { surface, root: parsed.root };
}

/** The DOM element tagged with the given AST path, inside a mounted surface. */
function nodeForPath(surface: HTMLElement, path: string): HTMLElement {
    const el = surface.querySelector<HTMLElement>(`[data-path="${path}"]`);
    if (!el) throw new Error(`no element at path "${path}"`);
    return el;
}

beforeEach(() => {
    document.body.innerHTML = '';
});

describe('taggedPath', () => {
    it('reads the path off the nearest tagged ancestor', () => {
        const { surface } = mount('a = 5');
        // The `mn` holding `5` is at path 0.2 in the expression row.
        const leaf = nodeForPath(surface, '0.2');
        const textNode = leaf.firstChild;
        expect(taggedPath(textNode)).toEqual([0, 2]);
    });

    it('returns the empty path for the tagged root', () => {
        const { surface } = mount('a = 5');
        const root = surface.querySelector<HTMLElement>('[data-path=""]');
        expect(taggedPath(root)).toEqual([]);
    });

    it('returns null outside any tagged surface', () => {
        const stray = document.createElement('span');
        stray.textContent = 'loose';
        expect(taggedPath(stray.firstChild)).toBeNull();
        expect(taggedPath(null)).toBeNull();
    });
});

describe('anchorFromDomPoint', () => {
    it('maps a click inside a leaf to a char anchor at that offset', () => {
        const { surface, root } = mount('a = 5');
        const leaf = nodeForPath(surface, '0.2');
        const anchor = anchorFromDomPoint(root, { node: leaf.firstChild!, offset: 1 });
        expect(anchor).toMatchObject({ kind: 'char', path: [0, 2], offset: 1 });
    });

    it('clamps a click past the end of a leaf to its length', () => {
        const { surface, root } = mount('a = 5');
        const leaf = nodeForPath(surface, '0.2');
        const anchor = anchorFromDomPoint(root, { node: leaf.firstChild!, offset: 99 });
        expect(anchor).toMatchObject({ kind: 'char', path: [0, 2], offset: 1 });
    });

    it('returns null for a path the tree cannot address', () => {
        const { root } = mount('a = 5');
        const stray = document.createElement('span');
        stray.setAttribute('data-path', '9.9.9');
        document.body.appendChild(stray);
        expect(anchorFromDomPoint(root, { node: stray, offset: 0 })).toBeNull();
    });

    it('gives the same caret for a click as moving the caret there would', () => {
        const { surface, root } = mount('b = a + 1');
        // Click the `+` operator; the caret should be at its start.
        const plus = nodeForPath(surface, '0.4');
        const anchor = anchorFromDomPoint(root, { node: plus.firstChild!, offset: 0 });
        expect(anchor).not.toBeNull();
        // Canonical, so walking one step left then right returns to it.
        const left = moveHorizontal(root, anchor as Anchor, -1);
        const back = moveHorizontal(root, left, 1);
        expect(anchorIndex(root, back)).toBe(anchorIndex(root, anchor as Anchor));
    });
});

describe('anchorForClick', () => {
    it('falls back to the start of the expression when the point is unresolvable', () => {
        const { root } = mount('a = 5');
        const anchor = anchorForClick(root, { node: document.body, offset: 0 });
        expect(anchorIndex(root, anchor)).toBe(0);
    });
});

describe('lineEditorModel', () => {
    beforeEach(() => clearLineEditorCache());

    it('parses a line and renders it with path tags', () => {
        const model = lineEditorModel('a = b/c');
        expect(model.root).not.toBeNull();
        expect(model.markup).toContain('data-path="0.2"');
        expect(model.markup).toContain('<mfrac ');
    });

    it('declines a line the bridge does not model, carrying the reason', () => {
        const model = lineEditorModel('M = [1; 2|3; 4]');
        expect(model.root).toBeNull();
        expect(model.reason).toBeTruthy();
        expect(model.markup).toBe('');
    });

    it('returns the same model object for unchanged text', () => {
        const first = lineEditorModel('x = a + 1');
        const second = lineEditorModel('x = a + 1');
        expect(second).toBe(first);
    });

    it('rebuilds when the text changes', () => {
        const first = lineEditorModel('x = a + 1');
        const second = lineEditorModel('x = a + 2');
        expect(second).not.toBe(first);
        expect(mathMlToCalcpadLine(second.root!)).toBe('x = a + 2');
    });
});

describe('partialTypesetMarkup', () => {
    it('typesets a complete line with path tags', () => {
        const out = partialTypesetMarkup('a = b/c');
        expect(out).toContain('<mfrac ');
        expect(out).toContain('data-path="0.2"');
    });

    it('typesets the prefix of a line stuck on a dangling operator', () => {
        // `x = a +` is mid-keystroke; the preview must still show `x = a`.
        const out = partialTypesetMarkup('x = a +');
        expect(out).toContain('<math');
        expect(out).toContain('a');
    });

    it('typesets the operand before an unclosed structure', () => {
        // `b/` has an empty denominator; show `b` rather than nothing.
        const out = partialTypesetMarkup('c = b/');
        expect(out).toContain('<math');
    });

    it('returns empty for input with nothing to typeset', () => {
        expect(partialTypesetMarkup('')).toBe('');
        expect(partialTypesetMarkup('   ')).toBe('');
        expect(partialTypesetMarkup('+')).toBe('');
    });

    it('never emits path tags for text the strict gate would reject as a whole', () => {
        // The helper is display-only: it may show a *prefix*, but it must not claim
        // the whole partial text is a valid expression.
        const out = partialTypesetMarkup('M = [1; 2');
        // Brackets are declined outright, so nothing is typeset.
        expect(out).toBe('');
    });
});
