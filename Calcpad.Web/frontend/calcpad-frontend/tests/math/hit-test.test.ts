// Pointer → anchor. The boxes are the shape `collectCandidates` produces: one per character
// boundary, and for an offset past the last character a zero-width box on its right edge.

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { HitCandidate, boxOf, nearestAnchor, parseCalcpad, withRowEnd } from '../../src/math';

function leaf(path: number[], text: string, left: number, width: number, top = 100, bottom = 114): HitCandidate[] {
    const boxes: HitCandidate[] = [];
    const step = width / text.length;
    for (let offset = 0; offset <= text.length; offset++) {
        const at = left + step * offset;
        boxes.push({
            anchor: { kind: 'char', path, offset },
            left: at,
            right: offset === text.length ? at : at + step,
            top,
            bottom,
        });
    }
    return boxes;
}

/** `x = x^3`: the last box on the line is a raised exponent. */
const power = (): HitCandidate[] => [
    ...leaf([0], 'x', 10, 7),
    ...leaf([1], '=', 20, 7),
    ...leaf([2, 0], 'x', 32, 6),
    ...leaf([2, 1], '3', 38, 5, 94, 101),
];

/** `x = 1/2`: the last box on the line is a denominator. */
const fraction = (): HitCandidate[] => [
    ...leaf([0], 'x', 10, 7),
    ...leaf([1], '=', 20, 7),
    ...leaf([2, 0], '1', 32, 7, 94, 106),
    ...leaf([2, 1], '2', 32, 7, 108, 122),
];

test('a click past the right edge lands at the end of the line, not inside the last box', () => {
    // The raised exponent is above the click, so the vertical term would never pick it: this
    // is the case that used to park the caret between `x` and its exponent in `x = x^3`.
    assert.deepEqual(nearestAnchor(power(), 500, 107), { kind: 'char', path: [2, 1], offset: 1 });
    assert.deepEqual(nearestAnchor(fraction(), 500, 110), { kind: 'char', path: [2, 1], offset: 1 });
});

test('a click left of everything lands at the start of the line', () => {
    assert.deepEqual(nearestAnchor(power(), 0, 107), { kind: 'char', path: [0], offset: 0 });
    assert.deepEqual(nearestAnchor(fraction(), 0, 107), { kind: 'char', path: [0], offset: 0 });
});

test('a click on a raised box still picks it, because vertical distance dominates', () => {
    assert.deepEqual(nearestAnchor(power(), 40, 97), { kind: 'char', path: [2, 1], offset: 0 });
    assert.deepEqual(nearestAnchor(fraction(), 35, 101), { kind: 'char', path: [2, 0], offset: 0 });
});

test('a click inside a line lands on the boundary it was nearest', () => {
    // Clicking a part of an equation has to put the caret where the pointer was: the left half
    // of a character is before it, the right half after it.
    assert.deepEqual(nearestAnchor(power(), 22, 107), { kind: 'char', path: [1], offset: 0 });
    assert.deepEqual(nearestAnchor(power(), 25, 107), { kind: 'char', path: [1], offset: 1 });
    assert.deepEqual(nearestAnchor(power(), 33, 107), { kind: 'char', path: [2, 0], offset: 0 });
    assert.deepEqual(nearestAnchor(power(), 37, 107), { kind: 'char', path: [2, 0], offset: 1 });
});

test('no boxes yields no anchor rather than a guess', () => {
    assert.equal(nearestAnchor([], 10, 10), null);
});

// The line's own end. Nothing inside `a = x^2` stands for it — the deepest box is the exponent's
// — so without this candidate a click past the content parks the caret inside the power.

/** `a = x^2`: the last box is the exponent, and the row ends in a structure. */
const rowEndBoxes = (): HitCandidate[] => [
    ...leaf([0], 'a', 10, 7),
    ...leaf([1], '=', 20, 7),
    ...leaf([2, 0], 'x', 32, 6),
    ...leaf([2, 1], '2', 38, 5, 94, 101),
];

const at = (source: string) => parseCalcpad(source).node!;

test('a click past the content lands at the end of the row', () => {
    const candidates = withRowEnd(at('a = x^2'), rowEndBoxes());
    assert.equal(candidates.length, rowEndBoxes().length + 1, 'one position is added');
    assert.deepEqual(nearestAnchor(candidates, 500, 107), { kind: 'gap', path: [], index: 3 });
});

test('the row end is not added when a leaf already ends the row', () => {
    const boxes = [...leaf([0], 'a', 10, 7), ...leaf([1], '+', 20, 7), ...leaf([2], '2', 30, 7)];
    assert.deepEqual(withRowEnd(at('1 + 2'), boxes), boxes);
    assert.deepEqual(withRowEnd(at('a + 2'), boxes), boxes);
});

test('a click on the last box still picks that box', () => {
    const candidates = withRowEnd(at('a = x^2'), rowEndBoxes());
    // The raised exponent is above this click, and the row end is far to the right.
    assert.deepEqual(nearestAnchor(candidates, 40, 97), { kind: 'char', path: [2, 1], offset: 0 });
});

test('a DOMRect becomes a plain box, field by field', () => {
    // Spreading a DOMRect copies nothing: its fields are prototype getters, so every candidate
    // built that way had NaN coordinates and could never win. An unfilled slot was a dead zone.
    class PrototypeRect {
        get left(): number { return 3; }
        get right(): number { return 9; }
        get top(): number { return 11; }
        get bottom(): number { return 17; }
    }
    assert.deepEqual(boxOf(new PrototypeRect() as unknown as DOMRectReadOnly), { left: 3, right: 9, top: 11, bottom: 17 });
    const slot: HitCandidate = { anchor: { kind: 'gap', path: [2, 1], index: 0 }, ...boxOf({ left: 74, right: 86, top: 188, bottom: 209 } as DOMRectReadOnly) };
    assert.deepEqual(nearestAnchor([slot], 80, 198), { kind: 'gap', path: [2, 1], index: 0 });
});

test('a click below the line still picks the nearest glyph, not the row end', () => {
    // The field is taller than its maths, and the row end used to borrow the field's height: it
    // scored a perfect vertical match for every click in that empty band and stole the caret.
    const candidates = withRowEnd(at('a = x^2'), rowEndBoxes());
    assert.deepEqual(nearestAnchor(candidates, 22, 140), { kind: 'char', path: [1], offset: 0 });
    assert.deepEqual(nearestAnchor(candidates, 37, 140), { kind: 'char', path: [2, 0], offset: 1 });
});
