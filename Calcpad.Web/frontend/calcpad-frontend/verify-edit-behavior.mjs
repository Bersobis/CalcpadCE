import { strict as assert } from 'node:assert';
import { parseCalcpad } from './src/math/parser.ts';
import { printCalcpad } from './src/math/printer.ts';
import { applyCharacter, insertStructure } from './src/math/insert.ts';
import { anchorsOf, firstAnchor, sameAnchor, moveVertical, slotAnchors, nextSlot, trailingAnchor, anchorIndex, hasEmptySlot, lastAnchor } from './src/math/caret.ts';
import { nearestAnchor, withRowEnd } from './src/math/hit-test.ts';

const tree = (source) => parseCalcpad(source).node;
const at = (path, offset) => ({ kind: 'char', path, offset });

// --- 1. Insert behavior: build structures and keep the parser invariant ---
{
  const root = tree('ab');
  const result = applyCharacter(root, at([], 1), '/');
  assert.equal(printCalcpad(result.node), 'a/b', 'typing / builds a fraction');
  assert.equal(hasEmptySlot(result.node), false, 'filled fraction has no empty slot');

  const power = applyCharacter(tree('ab'), at([], 1), '^');
  assert.equal(printCalcpad(power.node), 'a^b', 'typing ^ builds a power');

  const paren = applyCharacter(tree('x'), at([], 1), '(');
  assert.equal(printCalcpad(paren.node), 'x()', 'typing ( inserts a bracket with an empty slot');
  assert.equal(hasEmptySlot(paren.node), true, 'empty paren slot is reported');
}

// --- 2. Matrix structure shape ---
{
  const base = tree('M');
  const result = insertStructure(base, lastAnchor(base), 'matrix', { rows: 2, cols: 2 });
  const printed = printCalcpad(result.node);
  assert.ok(printed.startsWith('M['), 'matrix prints as M[...]: ' + printed);
  assert.equal(hasEmptySlot(result.node), true, 'matrix has empty cells');
}

// --- 3. Bracket wrapping: compound slot accepts compound expression ---
{
  const base = tree('x');
  const withCaret = insertStructure(base, lastAnchor(base), 'power');
  const filled = applyCharacter(withCaret.node, withCaret.anchor, '2');
  const plus = applyCharacter(filled.node, filled.anchor, '+');
  const one = applyCharacter(plus.node, plus.anchor, '1');
  assert.equal(printCalcpad(one.node), 'x^(2 + 1)', 'compound exponent is bracketed');
  const reparsed = parseCalcpad(printCalcpad(one.node));
  assert.ok(reparsed.ok && reparsed.node.name === 'msup',
    're-parsed back to a power node');
}

// --- 4. Tab slots and nextSlot ---
{
  const frac = tree('a/b');
  const num = firstAnchor(frac);
  const den = moveVertical(frac, num, 1);
  assert.equal(den.path[0], 1, 'denominator is the fraction second child');
  assert.equal(moveVertical(frac, den, -1).path[0], 0, 'and back up');

  const slots = slotAnchors(frac);
  assert.ok(slots.length >= 2, 'a fraction exposes at least two Tab slots');

  const afterNum = nextSlot(frac, num, 1);
  assert.ok(afterNum && sameAnchor(afterNum, den), 'Tab from numerator goes to denominator');

  const plain = tree('a + b');
  const plainSlots = slotAnchors(plain);
  assert.equal(plainSlots.length, 0, 'plain expression has no slots, so Tab is not swallowed');

  const lastSlot = nextSlot(frac, den, 1);
  assert.equal(lastSlot, null, 'Tab past the last slot returns nothing');
  const prevSlot = nextSlot(frac, den, -1);
  assert.ok(prevSlot && sameAnchor(prevSlot, num), 'Shift+Tab walks back to the previous slot');
}

// --- 5. Hit testing: row-end anchor and nearest-anchor logic ---
{
  const rendered = tree('x^2 + sqrt(y)');
  const list = anchorsOf(rendered);
  const end = trailingAnchor(rendered);
  assert.ok(end && end.kind === 'gap', 'a row ending in a structure exposes a row-end gap anchor');

  const ordinals = list.map((a) => anchorIndex(rendered, a));
  assert.equal(ordinals[ordinals.length - 1], list.length - 1, 'last anchor is last in canonical order');
  assert.equal(anchorIndex(rendered, end), ordinals.length - 1, 'row-end anchor is last among candidates');

  const lineCandidates = withRowEnd(rendered, [
    { anchor: firstAnchor(rendered), left: 0, right: 100, top: 0, bottom: 20 },
  ]);
  assert.ok(lineCandidates.length === 2, 'withRowEnd adds the row-end candidate');
  const pastEnd = nearestAnchor(lineCandidates, 200, 10);
  assert.ok(pastEnd && sameAnchor(pastEnd, end), 'click past all boxes picks the row end');
}

// --- 6. Selection-order helpers are present and usable ---
{
  const root = tree('a + b');
  const list = anchorsOf(root);
  assert.ok(list.length >= 2, 'expression has multiple anchors');
}
console.log('ALL VERIFICATION ASSERTIONS PASSED');
