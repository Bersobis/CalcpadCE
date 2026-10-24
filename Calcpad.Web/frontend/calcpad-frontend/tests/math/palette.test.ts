// The syntax catalog.
//
// The palette used to be two hand-written arrays: 14 of the 21 operators the parser accepts and
// none of the 69 functions. The catalog is generated from `grammar.ts` instead, and these tests
// are the guard that keeps it that way — every entry must be unique, must insert something the
// editor accepts, and must land the caret where the next keystroke belongs.

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { anchorIndex, emptySlotPaths, lastAnchor } from '../../src/math/caret';
import { BUILTIN_FUNCTIONS, OPERATORS } from '../../src/math/grammar';
import { isCommittableText } from '../../src/math/gate';
import { parseCalcpad } from '../../src/math/parser';
import {
    PALETTE_ENTRIES, PALETTE_SECTIONS, applyPaletteEntry, charEntryFor, filterPalette,
    functionEntriesMissing, matrixEntry, structureEntry,
} from '../../src/math/palette';
import { isElement, MathNode } from '../../src/math/model';
import { applyCharacter } from '../../src/math/insert';
import { printCalcpad } from '../../src/math/printer';

const tree = (source: string) => parseCalcpad(source).node!;

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
/** Insert an entry at the end of `a = 1`, the way the toolbar does. */
const insert = (entry = PALETTE_ENTRIES[0]) => {
    const root = tree('a = 1');
    return applyPaletteEntry(root, lastAnchor(root), entry);
};
const entry = (id: string) => {
    const found = PALETTE_ENTRIES.find((candidate) => candidate.id === id);
    assert.ok(found, `expected an entry with id ${id}`);
    return found;
};

test('every entry is unique, labelled and self-describing', () => {
    const ids = new Set<string>();
    for (const section of PALETTE_SECTIONS) {
        assert.ok(section.label.length > 0, `${section.id} needs a label`);
        assert.ok(section.entries.length > 0, `${section.id} is empty`);
        for (const candidate of section.entries) {
            assert.equal(candidate.section, section.id, `${candidate.id} sits in the wrong section`);
            assert.ok(!ids.has(candidate.id), `${candidate.id} is defined twice`);
            ids.add(candidate.id);
            assert.ok(candidate.label.length > 0, `${candidate.id} needs a label`);
            assert.ok(candidate.title.length > 0, `${candidate.id} needs a title`);
            assert.ok(candidate.insert.length > 0, `${candidate.id} needs Calcpad source`);
            if (candidate.kind === 'structure') assert.ok(candidate.structure, `${candidate.id} needs a structure`);
            if (candidate.kind === 'call') assert.ok(candidate.name, `${candidate.id} needs a callee`);
        }
    }
    assert.ok(PALETTE_ENTRIES.length > 100, 'the catalog should be the whole language, not a sample');
});

test('every operator the parser accepts has a button', () => {
    const offered = new Set(PALETTE_ENTRIES
        .filter((candidate) => candidate.section === 'operators')
        .map((candidate) => candidate.insert));
    const missing = Object.keys(OPERATORS).filter((glyph) => !offered.has(glyph));
    // `|` is the absolute-value delimiter: typing it is declined, only the `abs` structure writes it.
    assert.deepEqual(missing, ['|'], 'only the absolute-value bar has no button of its own');
    assert.ok(offered.has('!'), 'factorial is an operator too');
});

test('every built-in function has a button', () => {
    assert.deepEqual(functionEntriesMissing(), []);
    const offered = PALETTE_ENTRIES.flatMap((candidate) => (candidate.name ? [candidate.name] : []));
    assert.equal(new Set(offered).size, offered.length, 'one entry per function, no duplicates');
    assert.ok(offered.length >= BUILTIN_FUNCTIONS.size - 1, `${offered.length} of ${BUILTIN_FUNCTIONS.size}`);
});

test('every entry inserts something the editor accepts', () => {
    for (const candidate of PALETTE_ENTRIES) {
        const root = tree('a = 1');
        const result = applyPaletteEntry(root, lastAnchor(root), candidate);
        const printed = printCalcpad(result.node);
        assert.ok(printed !== printCalcpad(root) || result.node !== root,
            `${candidate.id} was refused at the end of a line`);
        if (candidate.kind === 'char') {
            assert.ok(printed.includes(candidate.insert),
                `${candidate.id} printed as "${printed}"`);
            continue;
        }
        // The caret must be a position in the new tree, or the next keystroke is silently lost.
        assert.ok(anchorIndex(result.node, result.anchor) >= 0,
            `${candidate.id} left the caret at a position that does not exist`);
        const typed = applyCharacter(result.node, result.anchor, 'x');
        assert.notEqual(typed.node, result.node, `${candidate.id} dropped the next keystroke`);
        if (candidate.kind === 'call') {
            assert.ok(printed.includes(`${candidate.name}(`),
                `${candidate.id} printed as "${printed}"`);
        }
    }
});

test('a structure button fills its slot with a committable expression', () => {
    for (const candidate of PALETTE_ENTRIES) {
        if (candidate.kind !== 'structure') continue;
        const root = tree('a = b');
        const result = applyPaletteEntry(root, lastAnchor(root), candidate);
        // Matrices and vectors have more than one slot; only the single-slot case is checked.
        if (emptySlotPaths(result.node).length !== 1) continue;
        const filled = applyCharacter(result.node, result.anchor, '7');
        assert.ok(isCommittableText(printCalcpad(filled.node)),
            `${candidate.id} left "${printCalcpad(filled.node)}" which Calcpad cannot read back`);
    }
});

test('a function button writes the call and puts the caret in the argument', () => {
    const root = tree('a = 1');
    const result = applyPaletteEntry(root, lastAnchor(root), entry('function:sin'));
    // A value to the left is multiplied explicitly: `1sin()` would be read as one name.
    assert.equal(printCalcpad(result.node), 'a = 1 * sin()');
    assert.equal(result.anchor.kind, 'gap');

    const typed = applyCharacter(result.node, result.anchor, 'x');
    assert.ok(isCommittableText(printCalcpad(typed.node)), printCalcpad(typed.node));
    assert.equal(printCalcpad(typed.node), 'a = 1 * sin(x)');
});

test('the field can still reach a structure and a bare character by name', () => {
    assert.equal(structureEntry('frac')?.kind, 'structure');
    assert.equal(structureEntry('sqrt')?.structure, 'sqrt');
    const char = charEntryFor('\u03C0');
    assert.equal(char.kind, 'char');
    assert.ok(printCalcpad(insert(char).node).includes('\u03C0'));
});

test('search filters by label, title and Calcpad source', () => {
    const labels = (query: string) => filterPalette(PALETTE_SECTIONS, query)
        .flatMap((section) => section.entries.map((candidate) => candidate.label));
    assert.ok(labels('sin').includes('sin'));
    assert.ok(labels('cosine').includes('cos'), 'the title is searchable');
    assert.ok(labels('/').includes('/'), 'the source is searchable');
    assert.deepEqual(labels('zzz'), []);
});

test('searching for a section shows the whole section, not just its matches', () => {
    const greek = filterPalette(PALETTE_SECTIONS, 'greek');
    assert.equal(greek.length, 1);
    assert.equal(greek[0].id, 'greek');
    assert.equal(greek[0].entries.length, PALETTE_SECTIONS.find((s) => s.id === 'greek')!.entries.length);
});

test('an empty query returns the catalog unchanged', () => {
    const all = filterPalette(PALETTE_SECTIONS, '  ');
    assert.equal(all.length, PALETTE_SECTIONS.length);
    assert.equal(all.flatMap((section) => section.entries).length, PALETTE_ENTRIES.length);
});

test('the matrix button opens the dialog and still inserts a matrix headless', () => {
    const dialog = structureEntry('matrix');
    assert.ok(dialog);
    assert.equal(dialog.kind, 'dialog', 'the button opens the dialog rather than writing text');
    assert.ok(dialog.structure, 'it stays findable by StructureId for the field palette');
    // Headless (a caller that never opens the dialog) must still produce a usable default 3×3.
    const result = insert(dialog);
    assert.equal(countNamed(result.node, 'mtr'), 3);
    assert.equal(countNamed(result.node, 'mtd'), 9);
    assert.ok(anchorIndex(result.node, result.anchor) >= 0, 'the caret must land in the matrix');
});

test('the dialog can request any shape through the same funnel', () => {
    const root = tree('a = 1');
    const result = applyPaletteEntry(root, lastAnchor(root), matrixEntry(4, 2));
    assert.equal(countNamed(result.node, 'mtr'), 4, 'four rows');
    assert.equal(countNamed(result.node, 'mtd'), 8, 'two cells per row');
    assert.ok(anchorIndex(result.node, result.anchor) >= 0, 'the caret must land in the matrix');
    const typed = applyCharacter(result.node, result.anchor, 'x');
    assert.notEqual(typed.node, result.node, 'the first cell must take a keystroke');
});

test('a structure button used where a name sits keeps the name', () => {
    // The engine's own rule: the text left of the caret becomes the structure's base.
    const root = tree('a = ab');
    const result = applyPaletteEntry(root, lastAnchor(root), entry('structure:frac'));
    assert.equal(printCalcpad(result.node), 'a = ab/');
    assert.equal(result.anchor.kind, 'gap');
});
