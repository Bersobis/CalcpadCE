import { describe, it, expect } from 'vitest';
import { calcpadLineToMathMl, mathMlToCalcpadLine } from '../src/mathml/calcpad';
import type { MathMlElement } from '../src/mathml/ast';
import { equalNodes, nodeAt, tokenText } from '../src/mathml/ast';
import { serializeMathMl } from '../src/mathml/serialize';
import {
    anchorsOf,
    applyCharacter,
    applyCharacterToSelection,
    anchorIndex,
    buildStructure,
    deleteBackward,
    deleteBackwardInSelection,
    deleteForward,
    deleteSelection,
    firstAnchor,
    hasEmptySlot,
    insertTable,
    lastAnchor,
    mergeable,
    moveHorizontal,
    moveVertical,
    selectionText,
} from '../src/mathml/caret';
import type { Anchor, EditorSelection } from '../src/mathml/caret';

function tree(source: string): MathMlElement {
    const parsed = calcpadLineToMathMl(source);
    if (!parsed.root) throw new Error(`cannot parse ${source}: ${parsed.reason}`);
    return parsed.root;
}

/** Read a tree back out as Calcpad text. */
function text(root: MathMlElement): string {
    const out = mathMlToCalcpadLine(root);
    if (out === null) throw new Error('tree is not serializable');
    return out;
}

/** The caret just after the first token whose text is `token`. */
function after(root: MathMlElement, token: string): Anchor {
    for (const anchor of anchorsOf(root)) {
        if (anchor.kind !== 'char') continue;
        const node = nodeAt(root, anchor.path);
        const value = node ? tokenText(node) : null;
        if (value === token && anchor.offset === value.length) return anchor;
    }
    throw new Error(`no caret after "${token}"`);
}

/** The caret just before the first token whose text is `token`. */
function before(root: MathMlElement, token: string): Anchor {
    for (const anchor of anchorsOf(root)) {
        if (anchor.kind !== 'char') continue;
        const node = nodeAt(root, anchor.path);
        const value = node ? tokenText(node) : null;
        if (value === token && anchor.offset === 0) return anchor;
    }
    throw new Error(`no caret before "${token}"`);
}

describe('anchors', () => {
    it('lists one position per character boundary, in document order', () => {
        // `a = 5` is three tokens: two boundaries each.
        expect(anchorsOf(tree('a = 5'))).toHaveLength(6);
    });

    it('gives an empty slot exactly one position', () => {
        const root = tree('a = b');
        const built = applyCharacter(root, after(root, 'b'), '/');
        // The fraction adds a numerator (b) and an empty denominator.
        expect(anchorsOf(built.root).some(a => a.kind === 'gap')).toBe(true);
    });
});

describe('navigation', () => {
    it('steps right through the whole expression and stops at the end', () => {
        const root = tree('a = 5');
        let caret = firstAnchor(root);
        const seen: string[] = [];
        for (let i = 0; i < 10; i++) {
            seen.push(JSON.stringify(caret));
            caret = moveHorizontal(root, caret, 1);
        }
        expect(new Set(seen).size).toBe(6);
        expect(caret).toEqual(lastAnchor(root));
    });

    it('steps left back to the start', () => {
        const root = tree('a = 5');
        expect(moveHorizontal(root, firstAnchor(root), -1)).toEqual(firstAnchor(root));
        expect(moveHorizontal(root, lastAnchor(root), -1)).not.toEqual(lastAnchor(root));
    });

    it('walks into and out of a fraction', () => {
        const root = tree('a/b');
        const path = anchorsOf(root).map(a => anchorIndex(root, a));
        // Every position is reachable by repeated Right from the start.
        let caret = firstAnchor(root);
        const visited = new Set<number>([anchorIndex(root, caret)]);
        for (let i = 0; i < path.length + 2; i++) {
            caret = moveHorizontal(root, caret, 1);
            visited.add(anchorIndex(root, caret));
        }
        expect(visited.size).toBe(path.length);
    });

    it('moves from a numerator down to its denominator, then out', () => {
        const root = tree('a/b');
        const numeratorEnd = after(root, 'a');
        const denominator = moveVertical(root, numeratorEnd, 1);
        expect(nodeAt(root, denominator.kind === 'char' ? denominator.path : [])).toBeTruthy();
        expect(tokenText(nodeAt(root, denominator.kind === 'char' ? denominator.path : [])!)).toBe('b');
        // Down again leaves the fraction entirely.
        const outside = moveVertical(root, denominator, 1);
        expect(anchorIndex(root, outside)).toBe(anchorIndex(root, lastAnchor(root)));
    });

    it('moves from a base up into nothing and down into an exponent', () => {
        const root = tree('x^2');
        const exponent = moveVertical(root, after(root, 'x'), 1);
        expect(tokenText(nodeAt(root, exponent.kind === 'char' ? exponent.path : [])!)).toBe('2');
        const back = moveVertical(root, exponent, -1);
        expect(tokenText(nodeAt(root, back.kind === 'char' ? back.path : [])!)).toBe('x');
    });
});

describe('typing', () => {
    it('merges a digit into the number before the caret', () => {
        const root = tree('x = 1');
        const typed = applyCharacter(root, after(root, '1'), '2');
        expect(text(typed.root)).toBe('x = 12');
    });

    it('merges a letter into the identifier before the caret', () => {
        const root = tree('x = 1');
        const typed = applyCharacter(root, after(root, 'x'), 'y');
        expect(text(typed.root)).toBe('xy = 1');
    });

    it('starts a new token when the character does not belong to the run', () => {
        const root = tree('x = 1');
        const typed = applyCharacter(root, after(root, '1'), '+');
        expect(text(typed.root)).toBe('x = 1 +');
    });

    it('merges into the token after the caret when the caret is at its start', () => {
        const root = tree('x = 1');
        const typed = applyCharacter(root, before(root, '1'), '2');
        expect(text(typed.root)).toBe('x = 21');
    });

    it('splits a token when the caret is inside it', () => {
        const root = tree('x = 12');
        const typed = applyCharacter(root, { kind: 'char', path: [0, 2], offset: 1 }, '+');
        expect(text(typed.root)).toBe('x = 1 + 2');
    });

    it('builds a fraction out of the operand before the caret', () => {
        const root = tree('a = b');
        const built = applyCharacter(root, after(root, 'b'), '/');
        expect(text(built.root)).toBe('a = b/');
        // The caret sits in the empty denominator.
        expect(built.anchor.kind).toBe('gap');
    });

    it('builds a power, and typing then fills the exponent', () => {
        const root = tree('a = b');
        const built = applyCharacter(root, after(root, 'b'), '^');
        const typed = applyCharacter(built.root, built.anchor, '2');
        expect(text(typed.root)).toBe('a = b^2');
    });

    it('builds a subscript', () => {
        const root = tree('x = a');
        const built = applyCharacter(root, after(root, 'a'), '_');
        const typed = applyCharacter(built.root, built.anchor, '1');
        expect(text(typed.root)).toBe('x = a_1');
    });

    it('takes the whole left product as a fraction numerator', () => {
        // `*` and `/` bind equally and associate left, so `a*b/c` already means
        // `(a*b)/c` — no brackets are needed on the way back out.
        const root = tree('x = a*b');
        const built = applyCharacter(root, after(root, 'b'), '/');
        const typed = applyCharacter(built.root, built.anchor, 'c');
        expect(text(typed.root)).toBe('x = a*b/c');
    });

    it('inserts a matched pair and leaves the caret between them', () => {
        const root = tree('a = b');
        const built = applyCharacter(root, after(root, 'b'), '(');
        expect(text(built.root)).toBe('a = b()');
        const typed = applyCharacter(built.root, built.anchor, 'c');
        expect(text(typed.root)).toBe('a = b(c)');
    });

    it('splits a leaf when building a structure mid-identifier', () => {
        const root = tree('ab = 1');
        const built = applyCharacter(root, { kind: 'char', path: [0, 0], offset: 1 }, '/');
        // The head becomes the numerator and the tail stays a sibling, so the
        // identifier `ab` is split rather than swallowed whole.
        expect(text(built.root)).toBe('a/b = 1');
        // And the line is held open rather than committed: an empty slot has no
        // Calcpad spelling, so `a/b` would otherwise re-parse as a division by `b`.
        expect(hasEmptySlot(built.root)).toBe(true);
    });
});

describe('deleting', () => {
    it('removes one character at a time', () => {
        const root = tree('x = 12');
        const step = deleteBackward(root, after(root, '12'));
        expect(text(step.root)).toBe('x = 1');
        const again = deleteBackward(step.root, step.anchor);
        expect(text(again.root)).toBe('x =');
    });

    it('deletes the token before the caret when it sits at a token start', () => {
        // The caret is before `1`, so Backspace removes the `=` before it.
        const root = tree('x = 1');
        const step = deleteBackward(root, before(root, '1'));
        expect(text(step.root)).toBe('x*1');
    });

    it('unwraps a fraction rather than losing its numerator', () => {
        const root = tree('a = b');
        const built = applyCharacter(root, after(root, 'b'), '/');
        const step = deleteBackward(built.root, built.anchor);
        expect(text(step.root)).toBe('a = b');
    });

    it('does not eat the expression from the inside', () => {
        const root = tree('x = 1');
        const step = deleteBackward(root, firstAnchor(root));
        expect(step.removed).toBe(0);
        expect(text(step.root)).toBe('x = 1');
    });

    it('deletes forward', () => {
        const root = tree('x = 12');
        const step = deleteForward(root, { kind: 'char', path: [0, 2], offset: 0 });
        expect(text(step.root)).toBe('x = 2');
    });
});

describe('selection', () => {
    it('reports the covered text', () => {
        const root = tree('x = 12');
        const selection: EditorSelection = { anchor: { kind: 'char', path: [0, 2], offset: 0 }, focus: { kind: 'char', path: [0, 2], offset: 2 } };
        expect(selectionText(root, selection)).toBe('12');
    });

    it('deletes the selected range', () => {
        const root = tree('x = 12');
        const selection: EditorSelection = { anchor: { kind: 'char', path: [0, 2], offset: 0 }, focus: { kind: 'char', path: [0, 2], offset: 2 } };
        expect(text(deleteSelection(root, selection).root)).toBe('x =');
    });

    it('replaces the selection with the typed character', () => {
        const root = tree('x = 12');
        const selection: EditorSelection = { anchor: { kind: 'char', path: [0, 2], offset: 0 }, focus: { kind: 'char', path: [0, 2], offset: 2 } };
        expect(text(applyCharacterToSelection(root, selection, '7').root)).toBe('x = 7');
    });

    it('backspace over a selection clears it in one step', () => {
        const root = tree('x = 12');
        const selection: EditorSelection = { anchor: { kind: 'char', path: [0, 2], offset: 0 }, focus: { kind: 'char', path: [0, 2], offset: 2 } };
        const step = deleteBackwardInSelection(root, selection);
        expect(text(step.root)).toBe('x =');
    });

    it('spans across tokens', () => {
        // From before `=` to the end of `12`: everything after `x` goes.
        const root = tree('x = 12');
        const selection: EditorSelection = { anchor: { kind: 'char', path: [0, 1], offset: 0 }, focus: { kind: 'char', path: [0, 2], offset: 2 } };
        expect(text(deleteSelection(root, selection).root)).toBe('x');
    });
});

describe('buildStructure directly', () => {
    it('wraps the operand before the caret', () => {
        const root = tree('a = b');
        const built = buildStructure(root, after(root, 'b'), 'sqrt');
        expect(text(built.root)).toBe('a = sqrt(b)');
    });

    it('builds an empty structure when there is nothing to wrap', () => {
        const root = tree('a = b');
        const built = buildStructure(root, before(root, 'a'), 'fraction');
        expect(anchorsOf(built.root).some(a => a.kind === 'gap')).toBe(true);
        expect(built.anchor.kind).toBe('gap');
    });

    it('fills the cube root degree in, so the button means what it says', () => {
        // `cbrt` is `root(x; 3)`, not `root(x; )` — an empty degree would make
        // the button's own tooltip a lie.
        const root = tree('a = b');
        const built = buildStructure(root, after(root, 'b'), 'cbrt');
        expect(text(built.root)).toBe('a = root(b; 3)');
        expect(hasEmptySlot(built.root)).toBe(false);
    });
});

describe('typing agrees with the parser', () => {
    /** Type `ch` at the end of `x = 1` and read the tree back through the bridge. */
    function typeAtEnd(ch: string) {
        const root = tree('x = 1');
        const typed = applyCharacter(root, lastAnchor(root), ch).root;
        const text = mathMlToCalcpadLine(typed);
        if (text === null) throw new Error(`not printable after typing ${ch}`);
        return { typed, text, reopened: calcpadLineToMathMl(text).root };
    }

    it('splits `2x` rather than merging it into one token', () => {
        // A number never continues into a letter: the tokenizer reads `2x` as a
        // number and a name, which is what makes it implicit multiplication. An
        // editor that merged them would hold a tree its own parser rejects.
        expect(mergeable('1', 'x')).toBe(false);
        expect(mergeable('1', 'ξ')).toBe(false);
        expect(mergeable('1', '2')).toBe(true);
        expect(mergeable('x', '2')).toBe(true);
        expect(mergeable('x', 'y')).toBe(true);
    });

    it('keeps the tree a reload would produce, for every character it accepts', () => {
        // `_`, `^`, `/` and `(` are structure builders: they leave a line that is
        // deliberately mid-edit, so they are not in this list.
        for (const ch of ['x', 'ξ', '2', '.', '°', '!']) {
            const { typed, text, reopened } = typeAtEnd(ch);
            expect(reopened, `typing ${ch} produced ${text}, which does not re-parse`).not.toBeNull();
            expect(equalNodes(typed, reopened!), `typing ${ch} drifted from a reload`).toBe(true);
        }
    });

    it('builds a fraction for `÷` as well as `/`', () => {
        // The bridge parses both as division, so typing either must build the
        // structure rather than leaving a slash-shaped token behind.
        expect(text(applyCharacter(tree('x = 1'), lastAnchor(tree('x = 1')), '÷').root)).toBe('x = 1/');
        expect(text(applyCharacter(tree('x = 1'), lastAnchor(tree('x = 1')), '/').root)).toBe('x = 1/');
    });
});

describe('insertTable', () => {
    it('builds the requested shape with a slot in every cell', () => {
        const root = tree('x = 1');
        const built = insertTable(root, lastAnchor(root), 2, 2);
        const markup = serializeMathMl(built.root);
        expect(markup.match(/<mtr>/g)).toHaveLength(2);
        expect(markup.match(/<mtd>/g)).toHaveLength(4);
        expect(markup.match(/<mtd><mrow><\/mrow><\/mtd>/g)).toHaveLength(4);
    });

    it('leaves the caret in the first cell', () => {
        const root = tree('x = 1');
        const built = insertTable(root, lastAnchor(root), 2, 2);
        expect(built.anchor.kind).toBe('gap');
        // The path ends `mtr[0] → mtd[0] → its slot`.
        expect(built.anchor.path.slice(-3)).toEqual([0, 0, 0]);
    });

    it('holds the line open until every cell is filled', () => {
        const root = tree('x = 1');
        let result = insertTable(root, lastAnchor(root), 1, 2);
        expect(hasEmptySlot(result.root)).toBe(true);

        // Type a digit into whichever cell is still empty, as the editor does.
        for (let guard = 0; hasEmptySlot(result.root) && guard < 10; guard++) {
            const gap = anchorsOf(result.root).find(a => a.kind === 'gap');
            if (!gap) break;
            result = applyCharacter(result.root, gap, '1');
        }

        expect(hasEmptySlot(result.root)).toBe(false);
        expect(text(result.root)).toBe('x = 1[1; 1]');
    });

    it('builds a single-row vector for the vector button', () => {
        const root = tree('x = 1');
        const built = insertTable(root, lastAnchor(root), 1, 3);
        expect(serializeMathMl(built.root).match(/<mtr>/g)).toHaveLength(1);
        expect(serializeMathMl(built.root).match(/<mtd>/g)).toHaveLength(3);
    });
});
