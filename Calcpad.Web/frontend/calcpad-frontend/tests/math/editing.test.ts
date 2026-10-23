// Structural editing.
//
// The invariant that matters most is at the bottom: after *any* edit the tree the editor holds
// must equal the tree its own parser builds from the text it prints —
// `sameTree(tree, parse(print(tree)))`. A text-only check cannot see the editor drifting from
// its own parser, which is how the previous attempt shipped palette buttons that did nothing.

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { MathNode, isElement, sameTree } from '../../src/math/model';
import { parseCalcpad } from '../../src/math/parser';
import { printCalcpad } from '../../src/math/printer';
import {
    Anchor, anchorsOf, firstAnchor, hasEmptySlot, lastAnchor, moveHorizontal, moveVertical,
} from '../../src/math/caret';
import { applyCharacter, deleteBackward, deleteForward, insertStructure } from '../../src/math/insert';
import { History } from '../../src/math/history';
import { isCommittableText } from '../../src/math/gate';

const tree = (source: string): MathNode => parseCalcpad(source).node!;
const at = (path: number[], offset: number): Anchor => ({ kind: 'char', path, offset });

/** How many nodes of a given element name a tree holds — matrix shape assertions use it. */
function countNamed(node: MathNode, name: string): number {
    let total = 0;
    const walk = (current: MathNode): void => {
        if (!isElement(current)) return;
        if (current.name === name) total++;
        current.children.forEach(walk);
    };
    walk(node);
    return total;
}

/** Fill every empty slot so the text becomes parseable — the "held open" rule in reverse. */
function fillEmptySlots(root: MathNode, ch: string): MathNode {
    let node = root;
    for (let guard = 0; guard < 32 && hasEmptySlot(node); guard++) {
        const slot = anchorsOf(node).find((a) => a.kind === 'gap');
        if (!slot) break;
        node = applyCharacter(node, slot, ch).node;
    }
    return node;
}

test('anchors are generated in document order', () => {
    // `a+b` parses to mrow[mi(a), mo(+), mi(b)]: two positions per leaf, six in total.
    const anchors = anchorsOf(tree('a+b'));
    assert.equal(anchors.length, 6);
    assert.deepEqual(anchors[0], at([0], 0));
    assert.deepEqual(anchors[2], at([1], 0));
    assert.deepEqual(anchors[5], at([2], 1));
});

test('horizontal movement walks the canonical sequence', () => {
    const root = tree('a+b');
    const first = firstAnchor(root);
    const second = moveHorizontal(root, first, 1);
    assert.deepEqual(second, at([0], 1));
    assert.deepEqual(moveHorizontal(root, second, -1), first);
    assert.deepEqual(moveHorizontal(root, first, -1), first, 'clamps at the start');
});

test('an editor-built empty slot has a gap anchor and blocks commit', () => {
    const filled = tree('q');
    const result = insertStructure(filled, lastAnchor(filled), 'frac');
    assert.equal(hasEmptySlot(result.node), true);
    assert.ok(anchorsOf(result.node).some((a) => a.kind === 'gap'));
});

test('a filled expression has no empty slot', () => {
    assert.equal(hasEmptySlot(tree('a/b')), false);
});

test('typing a character inserts it at the caret', () => {
    const root = tree('ab');
    const result = applyCharacter(root, at([], 1), 'c');
    assert.equal(printCalcpad(result.node), 'acb');
    assert.deepEqual(result.anchor, at([], 2));
});

test('typing `/` builds a fraction, splitting the text at the caret', () => {
    const result = applyCharacter(tree('ab'), at([], 1), '/');
    assert.equal(printCalcpad(result.node), 'a/b');
    assert.equal(hasEmptySlot(result.node), false);
});

test('typing `^` builds a power with the right-hand text as its exponent', () => {
    const result = applyCharacter(tree('ab'), at([], 1), '^');
    assert.equal(printCalcpad(result.node), 'a^b');
});

test('typing `^` at the end leaves an empty exponent that blocks commit', () => {
    const result = applyCharacter(tree('x'), at([], 1), '^');
    assert.equal(hasEmptySlot(result.node), true);
    assert.equal(result.anchor.kind, 'gap');
});

test('typing `(` inserts a bracket with an empty inner slot', () => {
    const result = applyCharacter(tree('x'), at([], 1), '(');
    assert.equal(printCalcpad(result.node), 'x()');
    assert.equal(hasEmptySlot(result.node), true);
});

test('inserting a structure puts the caret in its first empty slot', () => {
    const base = tree('x');
    const result = insertStructure(base, lastAnchor(base), 'sqrt');
    assert.equal(printCalcpad(result.node), 'sqrt(x)');
    assert.equal(result.anchor.kind, 'char');
});

test('a bare square root leaves its radicand empty', () => {
    const result = insertStructure(tree('q'), lastAnchor(tree('q')), 'sqrt');
    assert.equal(printCalcpad(result.node), 'sqrt(q)');
    const bare = insertStructure(tree('q'), at([], 0), 'sqrt');
    assert.equal(printCalcpad(bare.node), 'sqrt(q)');
});

test('a 2x2 matrix structure has empty cells', () => {
    const base = tree('M');
    const result = insertStructure(base, lastAnchor(base), 'matrix', { rows: 2, cols: 2 });
    assert.ok(printCalcpad(result.node).startsWith('M['), printCalcpad(result.node));
    assert.equal(hasEmptySlot(result.node), true);
    assert.equal(countNamed(result.node, 'mtr'), 2, 'two rows');
    assert.equal(countNamed(result.node, 'mtd'), 4, 'two cells per row');
});

test('the matrix dialog can ask for any shape', () => {
    const root = tree('a = 1');
    const result = insertStructure(root, lastAnchor(root), 'matrix', { rows: 5, cols: 2 });
    assert.equal(countNamed(result.node, 'mtr'), 5, 'five rows');
    assert.equal(countNamed(result.node, 'mtd'), 10, 'two cells per row');
    const filled = fillEmptySlots(result.node, '7');
    const printed = printCalcpad(filled);
    const reparsed = parseCalcpad(printed);
    assert.ok(reparsed.ok, `a filled matrix must parse back: ${printed}`);
    assert.ok(sameTree(filled, reparsed.node!), `a filled matrix drifted: ${printed}`);
    assert.ok(isCommittableText(printed), printed);
});

test('one-row matrix requests become fillable two-row matrices', () => {
    const root = tree('a = 1');
    const result = insertStructure(root, lastAnchor(root), 'matrix', { rows: 1, cols: 3 });
    assert.equal(countNamed(result.node, 'mtr'), 2, 'one-row matrices are promoted to two rows');
    assert.equal(countNamed(result.node, 'mtd'), 6, 'the requested column count is preserved');

    const filled = fillEmptySlots(result.node, '7');
    const printed = printCalcpad(filled);
    const reparsed = parseCalcpad(printed);
    assert.ok(reparsed.ok, `the promoted matrix must parse back: ${printed}`);
    assert.ok(sameTree(filled, reparsed.node!), `the promoted matrix drifted: ${printed}`);
    assert.ok(isCommittableText(printed), printed);
});

test('a matrix inserted into a matrix cell stays parseable after filling', () => {
    const root = tree('a = 1');
    const outer = insertStructure(root, lastAnchor(root), 'matrix', { rows: 2, cols: 2 });
    const nested = insertStructure(outer.node, outer.anchor, 'matrix', { rows: 2, cols: 2 });
    const filled = fillEmptySlots(nested.node, '7');
    const printed = printCalcpad(filled);
    const reparsed = parseCalcpad(printed);

    assert.equal(hasEmptySlot(filled), false, printed);
    assert.ok(reparsed.ok, `a nested matrix must parse back: ${printed}`);
    assert.ok(sameTree(filled, reparsed.node!), `a nested matrix drifted: ${printed}`);
    assert.ok(isCommittableText(printed), printed);
});

test('an impossible matrix size is clamped, not refused', () => {
    const root = tree('a = 1');
    const result = insertStructure(root, lastAnchor(root), 'matrix', { rows: 0, cols: 99 });
    assert.equal(countNamed(result.node, 'mtr'), 2, 'at least two rows');
    assert.equal(countNamed(result.node, 'mtd'), 32, 'columns clamped to 16 across two rows');
});

test('deletion removes the character to the left', () => {
    const result = deleteBackward(tree('abc'), at([], 2));
    assert.equal(printCalcpad(result.node), 'ac');
    assert.deepEqual(result.anchor, at([], 1));
});

test('forward deletion removes the character to the right', () => {
    const result = deleteForward(tree('abc'), at([], 1));
    assert.equal(printCalcpad(result.node), 'ac');
});

test('deletion at the start of a leaf does not corrupt the tree', () => {
    const result = deleteBackward(tree('ab'), at([], 0));
    assert.equal(printCalcpad(result.node), 'ab');
});

test('vertical movement steps between fraction slots', () => {
    const root = tree('a/b');
    const numerator = firstAnchor(root);
    const denominator = moveVertical(root, numerator, 1);
    assert.equal(denominator.path[0], 1, 'the denominator is the fraction\'s second child');
    const back = moveVertical(root, denominator, -1);
    assert.equal(back.path[0], 0, 'and back into the numerator');
});

test('history coalesces a run of same-tag edits into one step', () => {
    const history = new History<string>();
    history.reset('a');
    history.push('ab', 'type');
    history.push('abc', 'type');
    history.push('abcd', 'type');
    assert.equal(history.undo(), 'a');
    assert.equal(history.canUndo, false);
});

test('history separates different tags', () => {
    const history = new History<string>();
    history.reset('a');
    history.push('ab', 'type');
    history.push('a/b', 'structure');
    assert.equal(history.undo(), 'ab');
    assert.equal(history.undo(), 'a');
    assert.equal(history.redo(), 'ab');
    assert.equal(history.redo(), 'a/b');
});

test('a caret move ends a coalescing run without becoming a step', () => {
    const history = new History<string>();
    history.reset('a');
    history.push('ab', 'type');
    history.push('abc', 'type');
    history.breakCoalescing(); // the user moved the caret here
    history.push('abcd', 'type');
    assert.equal(history.undo(), 'abc', 'typing after the move is its own step');
    assert.equal(history.undo(), 'a', 'and the run before it is still one step');
    assert.equal(history.canUndo, false);
});

test('typing and a structure are separate undo steps', () => {
    // The first version pushed every edit with one constant tag, so the whole session collapsed
    // into a single undo step and Ctrl+Z reverted everything at once.
    const history = new History<string>();
    history.reset('q');
    history.push('qx', 'type');
    history.push('q/x', 'structure');
    history.push('q/x+1', 'type');
    assert.equal(history.undo(), 'q/x');
    assert.equal(history.undo(), 'qx');
    assert.equal(history.undo(), 'q');
});

test('the editor tree always equals the tree its own parser builds', () => {
    let root = tree('q');
    let anchor: Anchor = lastAnchor(root);
    for (const ch of ['x', '^', '2']) {
        const result = applyCharacter(root, anchor, ch);
        root = result.node;
        anchor = result.anchor;
        if (hasEmptySlot(root)) continue;
        const printed = printCalcpad(root);
        const reparsed = parseCalcpad(printed);
        assert.ok(reparsed.ok, `editor produced unparsable text: ${printed}`);
        assert.ok(sameTree(root, reparsed.node!), `editor drifted from its parser at ${printed}`);
    }
    assert.equal(printCalcpad(root), 'qx^2');
});

test('every palette structure keeps the editor/parser invariant once filled', () => {
    const ids = ['frac', 'power', 'subscript', 'sqrt', 'cbrt', 'nroot', 'abs', 'paren', 'bracket', 'vector', 'matrix', 'call'] as const;
    for (const id of ids) {
        const base = tree('q');
        const built = insertStructure(base, lastAnchor(base), id);
        const filled = fillEmptySlots(built.node, '1');
        const printed = printCalcpad(filled);
        const reparsed = parseCalcpad(printed);
        assert.ok(reparsed.ok, `${id} produced unparsable text: ${printed}`);
        assert.ok(sameTree(filled, reparsed.node!), `${id} drifted: ${printed}`);
    }
});

test('the caret lands inside the structure it just built', () => {
    const base = tree('q');
    const result = insertStructure(base, lastAnchor(base), 'frac');
    assert.ok(isElement(result.node));
    assert.equal(result.anchor.kind, 'gap');
    assert.equal(result.anchor.path[result.anchor.path.length - 1], 1, 'in the denominator');
});

// ---------------------------------------------------------------------------------------
// The invariant has to hold for *every* accepted keystroke, not the three the first version
// happened to test. A character that cannot produce a rebuildable tree must be declined.
// ---------------------------------------------------------------------------------------

const TYPEABLE = [
    'a', 'Z', '0', '5', '.', '_', ',', '\u03B1', '\u00B0', '\u2032', '\u2081',
    '+', '-', '*', '<', '>', '=', '\u2264', '\u2265', '\u2260', '\u2227', '\u2228',
    '\u29BC', '\u2220', '\u2190', '!', '\\',
    ' ', '\t', ')', ']', ';', '|', '@', '#', '\u00A7',
];

// Every real caret position, not a hard-coded one: the previous version used a single offset
// that was only valid for a leaf-rooted tree, which is how the drift below went unnoticed.
const INVARIANT_SOURCES = ['ab', 'abc', '12', '1.5', 'a + b', 'x', 'x^2', '1/2', 'q_1', 'sqrt(9)', '[1; 2]'];

test('every typeable character at every caret position keeps the invariant or is declined', () => {
    let checked = 0;
    let incomplete = 0;
    for (const source of INVARIANT_SOURCES) {
        const root = tree(source);
        for (const position of anchorsOf(root)) {
            for (const ch of TYPEABLE) {
                const before = printCalcpad(root);
                const result = applyCharacter(root, position, ch);
                const printed = printCalcpad(result.node);
                checked++;

                if (printed === before) continue; // declined: a no-op is always safe
                const reparsed = parseCalcpad(printed);

                // Typing `a + ` on the way to `a + b` is legitimately incomplete, so an
                // unparseable intermediate is allowed — but it must never be committable.
                if (!reparsed.ok) {
                    incomplete++;
                    assert.ok(
                        !isCommittableText(printed),
                        `unparseable but committable: "${printed}"`,
                    );
                    continue;
                }
                assert.ok(
                    sameTree(result.node, reparsed.node!),
                    `typing ${JSON.stringify(ch)} at ${JSON.stringify(position)} of "${source}" drifted: "${printed}"`,
                );
            }
        }
    }
    assert.ok(checked > 1500, `expected a broad sweep, checked ${checked}`);
    assert.ok(incomplete > 0, 'the sweep should include incomplete intermediate states');
});

test('typing an operator builds a row, not a longer name', () => {
    const result = applyCharacter(tree('ab'), at([], 1), '+');
    assert.equal(printCalcpad(result.node), 'a + b');
    assert.ok(isElement(result.node));
    assert.equal((result.node as { children: unknown[] }).children.length, 3, 'a, +, b');
});

test('typing a name character after a number is juxtaposition, not one token', () => {
    const result = applyCharacter(tree('12'), at([], 2), 'x');
    assert.equal(printCalcpad(result.node), '12x');
});

test('typing a digit after a name extends the name', () => {
    const result = applyCharacter(tree('ab'), at([], 2), '3');
    assert.equal(printCalcpad(result.node), 'ab3');
});

test('a structural separator is declined rather than corrupting the leaf', () => {
    for (const ch of [')', ']', ';', '|', ' ', '\t', '@']) {
        const root = tree('ab');
        const result = applyCharacter(root, at([], 1), ch);
        assert.equal(printCalcpad(result.node), 'ab', `typing ${JSON.stringify(ch)} should be a no-op`);
    }
});

// ---------------------------------------------------------------------------------------
// The corruption path: an emptied leaf printed as nothing, was not reported as a slot, and the
// tab wrote `a = /2` into the document.
// ---------------------------------------------------------------------------------------

test('an emptied leaf counts as an empty slot', () => {
    const root = tree('a = 1/2');
    const after = deleteBackward(root, at([2, 0], 1)).node;
    assert.equal(printCalcpad(after), 'a = /2', 'the printer still shows the hole');
    assert.equal(hasEmptySlot(after), true, 'and the guard must see it');
});

test('deleting a branch cannot produce a committable line', () => {
    for (const [source, path] of [
        ['1/2', [1]], ['x^2', [1]], ['q_1', [1]], ['sqrt(9)', [0]],
    ] as [string, number[]][]) {
        const root = tree(source);
        const node = path.reduce<MathNode>((n, i) => (n as { children: MathNode[] }).children[i], root);
        const text = (node as { children: { text?: string }[] }).children[0].text ?? '';
        const after = deleteBackward(root, { kind: 'char', path, offset: text.length }).node;
        const printed = printCalcpad(after);
        const blocked = hasEmptySlot(after) || !isCommittableText(printed);
        assert.ok(blocked, `${source} -> "${printed}" would have been written`);
    }
});

// ---------------------------------------------------------------------------------------
// Deletion: backspace at offset 0 used to be a no-op, so the first character of every leaf was
// undeletable and nothing could be merged.
// ---------------------------------------------------------------------------------------

test('backspace at the start of a leaf deletes the operator before it', () => {
    const merged = deleteBackward(tree('a + b'), at([2], 0)).node;
    assert.equal(printCalcpad(merged), 'ab', 'the "+" is consumed and the operands become a product');
});

test('deleting an operand drops the dangling operator', () => {
    const result = deleteBackward(tree('a + b'), at([2], 1)).node;
    assert.equal(printCalcpad(result), 'a', 'no trailing "+" is left behind');
});

test('deleting an emptied branch collapses a two-branch structure', () => {
    const root = tree('1/2');
    const emptied = deleteBackward(root, at([0], 1)).node;
    assert.equal(hasEmptySlot(emptied), true);
    const collapsed = deleteBackward(emptied, at([0], 0));
    assert.equal(printCalcpad(collapsed.node), '2', 'the fraction collapses to the surviving branch');
});

test('deleting an emptied exponent collapses the power', () => {
    const root = tree('x^2');
    const emptied = deleteBackward(root, at([1], 1)).node;
    const collapsed = deleteBackward(emptied, at([1], 0));
    assert.equal(printCalcpad(collapsed.node), 'x');
});

test('deleting the last character of the whole line leaves an empty tree', () => {
    const root = tree('x');
    const result = deleteBackward(root, at([], 1));
    assert.equal(printCalcpad(result.node), '');
});
