// Tab between slots, and a selected range that typing replaces.
//
// The reference editor walks a structure's slots with Tab and lets a keystroke replace a selected
// range. Both are pure functions here: `nextSlot` decides where Tab goes, and `deleteRange` /
// `replaceRange` decide what a keystroke does to a range. A selection delete removes exactly the
// selected characters — deleting backward stopped one short whenever a slot collapsed under it.
//
// Emptying a slot is a *holding state*, as the reference has it: deleting the exponent of `x^2`
// leaves `x^` with the slot drawn, and the next keystroke fills it.

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { Anchor, anchorsOf, firstAnchor, moveHorizontal, nextSlot, slotAnchors } from '../../src/math/caret';
import { MathNode } from '../../src/math/model';
import { parseCalcpad } from '../../src/math/parser';
import { printCalcpad } from '../../src/math/printer';
import {
    deleteRange, isEmptyRange, orderedRange, rangeLength, replaceRange, tokenRange, wholeRange,
} from '../../src/math/selection';

const tree = (source: string): MathNode => parseCalcpad(source).node!;
const print = (source: string, range: { from: Anchor; to: Anchor }): string =>
    printCalcpad(deleteRange(tree(source), range).node);
const replaced = (source: string, range: { from: Anchor; to: Anchor }, ch: string): string =>
    printCalcpad(replaceRange(tree(source), range, ch).node);

/** The anchor `steps` positions after the first one. */
function nth(root: MathNode, steps: number): Anchor {
    let anchor = firstAnchor(root);
    for (let i = 0; i < steps; i++) anchor = moveHorizontal(root, anchor, 1);
    return anchor;
}

const span = (root: MathNode, from: number, to: number) => ({ from: nth(root, from), to: nth(root, to) });

// ---------------------------------------------------------------------------------------
// Tab
// ---------------------------------------------------------------------------------------

test('Tab leaves the numerator for the denominator', () => {
    const root = tree('1/2');
    const numeratorEnd = nth(root, 1);
    const denominator = nextSlot(root, numeratorEnd, 1);
    assert.deepEqual(denominator, { kind: 'char', path: [1], offset: 0 });
});

test('Tab in the last slot returns nothing, so the field lets the key leave', () => {
    const root = tree('1/2');
    const denominator = nextSlot(root, nth(root, 1), 1)!;
    assert.equal(nextSlot(root, denominator, 1), null);
});

test('Shift+Tab walks back to the previous slot', () => {
    const root = tree('1/2');
    const denominator = nextSlot(root, nth(root, 1), 1)!;
    assert.deepEqual(nextSlot(root, denominator, -1), { kind: 'char', path: [0], offset: 0 });
    // From anywhere inside the denominator — its first position included.
    assert.deepEqual(nextSlot(root, nth(root, 2), -1), { kind: 'char', path: [0], offset: 0 });
    assert.equal(nextSlot(root, nth(root, 0), -1), null, 'nothing before the first slot');
});

test('every structure slot is a Tab stop, in reading order', () => {
    const root = tree('x^2');
    assert.deepEqual(slotAnchors(root), [
        { kind: 'char', path: [0], offset: 0 },
        { kind: 'char', path: [1], offset: 0 },
    ]);
    assert.deepEqual(nextSlot(root, nth(root, 1), 1), { kind: 'char', path: [1], offset: 0 });
});

test('a plain expression has no slots, so Tab is not swallowed', () => {
    const root = tree('a + b');
    assert.equal(nextSlot(root, firstAnchor(root), 1), null);
});

test('a slot inside a group is reached in reading order', () => {
    const root = tree('1/(a + 2)');
    const numeratorEnd = nth(root, 1);
    const target = nextSlot(root, numeratorEnd, 1);
    assert.ok(target, 'the denominator is a slot');
    assert.equal(printCalcpad(root), '1/(a + 2)');
    // The denominator's own first position is the start of the group's content — inside the
    // brackets, where typing means something.
    assert.deepEqual(target, { kind: 'char', path: [1, 1, 0], offset: 0 });
});

// ---------------------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------------------

test('a range is ordered, whichever end was dragged from', () => {
    const root = tree('a = abc');
    const back = orderedRange(root, nth(root, 6), nth(root, 4))!;
    assert.deepEqual(back.from, nth(root, 4));
    assert.deepEqual(back.to, nth(root, 6));
    assert.equal(isEmptyRange(back), false);
});

test('a range counts characters, not positions between structures', () => {
    const root = tree('a = q_1 + 2');
    assert.equal(rangeLength(root, span(root, 4, 7)), 2);
    assert.equal(rangeLength(root, { from: nth(root, 4), to: nth(root, 4) }), 0);
});

test('deleting a range removes exactly the selected characters', () => {
    assert.equal(print('a = abc', span(tree('a = abc'), 5, 6)), 'a = ac');
    assert.equal(print('a = abc', span(tree('a = abc'), 4, 7)), 'a = ');
});

test('typing over a range replaces it', () => {
    assert.equal(replaced('a = abc', span(tree('a = abc'), 5, 6), '9'), 'a = a9c');
    assert.equal(replaced('a = abc', span(tree('a = abc'), 4, 7), '9'), 'a = 9');
});

test('a token selection takes the scripted name whole', () => {
    const root = tree('a = q_1 + 2');
    const token = tokenRange(root, nth(root, 6));
    assert.deepEqual(token, { from: nth(root, 4), to: nth(root, 7) });
    assert.equal(printCalcpad(deleteRange(root, token).node), 'a = +2');
    assert.equal(replaced('a = q_1 + 2', token, '9'), 'a = 9 + 2');
});

test('selecting only the subscript leaves the base and the empty slot', () => {
    const root = tree('a = q_1 + 2');
    // The slot is emptied, not collapsed: the same holding state Backspace leaves behind.
    assert.equal(print('a = q_1 + 2', span(root, 6, 7)), 'a = q_ + 2');
});

test('deleting a slot content leaves the slot, not a collapsed structure', () => {
    const root = tree('1/2');
    assert.equal(printCalcpad(deleteRange(root, span(root, 0, 1)).node), '/2');
    assert.equal(replaced('1/2', span(tree('1/2'), 0, 1), '9'), '9/2');
    assert.equal(print('x^2', span(tree('x^2'), 2, 3)), 'x^');
});

test('a selection delete keeps the operator whose operand it removes', () => {
    // Typing over the selection needs somewhere to type: `a^2 + ` keeps its plus, so the
    // character lands in the slot instead of being refused at the end of the row.
    const root = tree('c = sqrt(a^2 + b^2)');
    const range = tokenRange(root, { kind: 'char', path: [2, 0, 2, 0], offset: 0 });
    assert.equal(printCalcpad(deleteRange(root, range).node), 'c = sqrt(a^2 + )');
    assert.equal(replaced('c = sqrt(a^2 + b^2)', range, '9'), 'c = sqrt(a^2 + 9)');
});

test('deleting everything leaves a blank field, not empty brackets', () => {
    const root = tree('a = 1 + 2');
    assert.equal(printCalcpad(deleteRange(root, wholeRange(root)).node), '');
});

test('the whole-range selection covers the expression', () => {
    const root = tree('a = 1 + 2');
    const all = wholeRange(root);
    assert.deepEqual(all.from, firstAnchor(root));
    assert.equal(printCalcpad(replaceRange(root, all, 'x').node), 'x');
});

test('an anchor that is not a position in the tree orders to nothing', () => {
    const root = tree('a = 1');
    assert.equal(orderedRange(root, firstAnchor(root), { kind: 'char', path: [], offset: 4 }), null);
});

test('a token range holds its anchors in reading order', () => {
    const root = tree('a = bc');
    const token = tokenRange(root, nth(root, 4));
    const indices = anchorsOf(root);
    assert.ok(indices.findIndex((anchor) => anchor.path[0] === 2) >= 0);
    assert.equal(token.from.kind, 'char');
    assert.equal(printCalcpad(replaceRange(root, token, '9').node), 'a = 9');
});
