// The end of a row, and a slot that holds a compound expression.
//
// The reference editor appends at the top level when you click past the content or type an
// operator there, even when the line ends in a structure (`x^2`, `sqrt(x)`). Ours sent that
// position into the last structure, so `sqrt(a^2 + b^2)` could never be continued with `+ 1`.
//
// The second half is the consequence for slots. The reference stores structure, so its slot's
// wrapper *is* the grouping; our storage is text, so the grouping is spelled out with brackets —
// and the parser reads those brackets back as nodes. A slot without them is a tree its own
// printer disagrees with, so every keystroke that completed it was refused.

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { Anchor } from '../../src/math/caret';
import { MathNode, isElement } from '../../src/math/model';
import { parseCalcpad } from '../../src/math/parser';
import { printCalcpad } from '../../src/math/printer';
import {
    anchorsOf, hasEmptySlot, moveHorizontal, sameTree, trailingAnchor,
} from '../../src/math';
import { applyCharacter, deleteBackward } from '../../src/math/insert';
import { isCommittableText } from '../../src/math/gate';

const tree = (source: string): MathNode => parseCalcpad(source).node!;
const at = (path: number[], offset: number): Anchor => ({ kind: 'char', path, offset });
const nodeAt = (root: MathNode, path: number[]): MathNode =>
    path.reduce<MathNode>((node, index) => (node as { children: MathNode[] }).children[index], root);

/** The last character position inside the node at `path`, rebased onto the whole tree. */
function endOf(root: MathNode, path: number[]): Anchor {
    const inner = anchorsOf(nodeAt(root, path));
    for (let i = inner.length - 1; i >= 0; i--) {
        const anchor = inner[i];
        if (anchor.kind === 'char') return { kind: 'char', path: [...path, ...anchor.path], offset: anchor.offset };
    }
    return at(path, 0);
}

/** Type `keys` from a caret at the end of the node at `path`, asserting nothing is refused. */
function typeFrom(root: MathNode, path: number[], keys: string): MathNode {
    let node = root;
    let anchor: Anchor = endOf(root, path);
    for (const ch of keys) {
        const result = applyCharacter(node, anchor, ch);
        assert.notEqual(printCalcpad(result.node), printCalcpad(node), `"${ch}" was refused at ${path}`);
        node = result.node;
        anchor = result.anchor;
    }
    assert.ok(sameTree(node, tree(printCalcpad(node))), `the tree drifted from "${printCalcpad(node)}"`);
    return node;
}

test('a row that ends in a structure has a position after it', () => {
    assert.deepEqual(trailingAnchor(tree('a = x^2')), { kind: 'gap', path: [], index: 3 });
    assert.deepEqual(trailingAnchor(tree('a = sqrt(9)')), { kind: 'gap', path: [], index: 3 });
    assert.deepEqual(anchorsOf(tree('a = x^2')).slice(-1), [{ kind: 'gap', path: [], index: 3 }]);
});

test('a row that ends in a leaf needs no position after it', () => {
    // The end of the last leaf's text already *is* the end of the row.
    assert.equal(trailingAnchor(tree('sqrt(x) + 1')), null);
    assert.equal(trailingAnchor(tree('1 + 2')), null);
    assert.equal(trailingAnchor(tree('x^2')), null, 'a power is not a row');
    assert.equal(trailingAnchor(tree('1/2')), null, 'neither is a fraction');
});

test('an operator typed at the row end stays outside the structure', () => {
    const cases: [string, string, string][] = [
        ['a = x^2', '+', 'a = x^2 + '],
        ['a = sqrt(9)', '*', 'a = sqrt(9) * '],
        ['c = sqrt(a^2 + b^2)', '+', 'c = sqrt(a^2 + b^2) + '],
        ['a = b^2 c', '+', 'a = b^2c + '],
        ['-(x + 1)', '+', '-(x + 1) + '],
    ];
    for (const [source, ch, expected] of cases) {
        const root = tree(source);
        const result = applyCharacter(root, trailingAnchor(root)!, ch);
        assert.equal(printCalcpad(result.node), expected, source);
    }
});

test('an operator at the row end groups what it follows, as the parser reads it', () => {
    // `a = 2 + 3` then `*`: the `*` binds `2 + 3`, so the tree nests instead of going flat.
    const root = tree('a = 2 + 3');
    const result = applyCharacter(root, trailingAnchor(root)!, '*');
    assert.equal(printCalcpad(result.node), 'a = 2 + 3 * ');
    const nested = nodeAt(result.node, [2]);
    assert.ok(isElement(nested) && nested.name === 'mrow', 'the operand is its own row');
});

test('an operand at the row end continues the last token', () => {
    // The text decides: `x^2` then `1` prints `x^21`, whose exponent is `21` — so a new leaf
    // beside the power would be a tree its own parser never builds.
    const cases: [string, string, string][] = [
        ['a = x^2', '1', 'a = x^21'],
        ['a = b^2 c', '1', 'a = b^2c1'],
        ['a = sqrt(9)', '2', 'a = sqrt(92)'],
        ['a = 2 + 3', '4', 'a = 2 + 34'],
    ];
    for (const [source, ch, expected] of cases) {
        const result = applyCharacter(tree(source), trailingAnchor(tree(source))!, ch);
        assert.equal(printCalcpad(result.node), expected, source);
        assert.ok(sameTree(result.node, tree(expected)), `${expected} must be the parser's own tree`);
    }
});

test('the reported line accepts a term after its square root', () => {
    const root = tree('c = sqrt(a^2 + b^2)');
    const plus = applyCharacter(root, trailingAnchor(root)!, '+');
    const one = applyCharacter(plus.node, plus.anchor, '1');
    assert.equal(printCalcpad(one.node), 'c = sqrt(a^2 + b^2) + 1');
    assert.ok(isCommittableText(printCalcpad(one.node)));
    assert.ok(sameTree(one.node, tree('c = sqrt(a^2 + b^2) + 1')));
});

test('backspace at the row end deletes the last character', () => {
    const root = tree('c = sqrt(a^2 + b^2)');
    const result = deleteBackward(root, trailingAnchor(root)!);
    assert.equal(printCalcpad(result.node), 'c = sqrt(a^2 + b^)');
    assert.equal(hasEmptySlot(result.node), true, 'the emptied exponent is held open, not committed');
});

test('left and right arrows walk to the row end', () => {
    const root = tree('a = x^2');
    const end = trailingAnchor(root)!;
    const inside = moveHorizontal(root, end, -1);
    assert.notDeepEqual(inside, end);
    assert.deepEqual(moveHorizontal(root, inside, 1), end);
});

test('a slot holds a compound expression as the parser spells it', () => {
    const root = tree('x^2');
    const opened = applyCharacter(root, at([1], 1), '+');
    assert.equal(printCalcpad(opened.node), 'x^(2 + )', 'the incomplete operand still prints');
    const done = applyCharacter(opened.node, opened.anchor, '1');
    assert.equal(printCalcpad(done.node), 'x^(2 + 1)');
    assert.ok(sameTree(done.node, tree('x^(2 + 1)')), 'brackets are nodes, not characters');
    assert.equal(hasEmptySlot(done.node), false);
    assert.ok(isCommittableText(printCalcpad(done.node)));
});

test('a compound slot keeps the precedence grouping inside it', () => {
    const node = typeFrom(tree('x^2'), [1], '+1*3');
    assert.equal(printCalcpad(node), 'x^(2 + 1 * 3)');
});

test('every keystroke that builds a compound slot is accepted', () => {
    const sequences: [string, number[], string][] = [
        ['x^2', [1], '+1'],
        ['x^2', [1], '-2'],
        ['x^2', [0], '+1'],
        ['q/2', [1], '+1'],
        ['1/2', [0], '+1'],
        ['1/2', [1], '*2'],
        ['q/(2)', [1, 1], '+1'],
        ['sqrt(x)', [0], '+1'],
    ];
    for (const [source, path, keys] of sequences) {
        const node = typeFrom(tree(source), path, keys);
        assert.ok(isCommittableText(printCalcpad(node)), `${source} + ${keys} is not committable`);
    }
});

test('a denominator, a numerator and a base all take the brackets', () => {
    const cases: [string, number[], string][] = [
        ['q/2', [1], 'q/(2 + 1)'],
        ['1/2', [0], '(1 + 1)/2'],
        ['x^2', [0], '(x + 1)^2'],
    ];
    for (const [source, path, expected] of cases) {
        const node = typeFrom(tree(source), path, '+1');
        assert.equal(printCalcpad(node), expected, source);
        assert.ok(sameTree(node, tree(expected)), `${expected} must be the parser's own tree`);
    }
});

// A subscript is one token in Calcpad — `q_(1+2)` parses as the name `q_` beside a group — so an
// operator typed inside one belongs to the row outside it. Splitting it into the subscript left a
// tree whose printed text claimed the operator was at the top level.

test('an operator in a subscript belongs to the row outside it', () => {
    const cases: [string, number[], string, string][] = [
        ['q_1', [1], '+2', 'q_1 + 2'],
        ['a = q_1', [2, 1], '*2', 'a = q_1 * 2'],
        ['q_1/2', [0, 1], '+2', '(q_1 + 2)/2'],
        ['x^(q_1)', [1, 1, 1], '+2', 'x^(q_1 + 2)'],
    ];
    for (const [source, path, keys, expected] of cases) {
        const node = typeFrom(tree(source), path, keys);
        assert.equal(printCalcpad(node), expected, source);
        assert.ok(sameTree(node, tree(expected)), `${expected} must be the parser's own tree`);
    }
});
