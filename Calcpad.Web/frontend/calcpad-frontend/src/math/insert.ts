// Structural editing: what a keystroke or a palette button does to the tree.
//
// Calcpad's operators *are* its structures, so typing `/` builds a fraction and `^` builds a
// power — there is no command layer to translate. Every operation is a pure function over the
// AST, which is what makes the whole editing surface testable without a browser.
//
// The rule every function here obeys: an accepted keystroke must produce a tree the parser
// rebuilds from the text the printer emits. A keystroke that cannot is *declined* (a no-op),
// never guessed at — appending `)` to a name used to produce `mi('a)b')`, which round-tripped
// to a different tree and broke the invariant the whole design rests on.

import {
    MathElement, MathNode, Path, el, elAttr, isElement, leaf, leafText, mi, mn, mo,
    nodeAtPath, replaceAtPath, sameTree,
} from './model';
import {
    Anchor, CharAnchor, GapAnchor, anchorsOf, firstAnchor, hasEmptySlot, lastAnchor, sameAnchor,
    trailingAnchor,
} from './caret';
import { BUILTIN_FUNCTIONS, isDigitChar, isNameChar, isNameStart, isOperator, opSpec } from './grammar';
import { nameToNode, parseCalcpad } from './parser';
import { operandBracketed, printCalcpad, slotContext } from './printer';

export interface InsertResult {
    readonly node: MathNode;
    readonly anchor: Anchor;
}

export type StructureId =
    | 'frac' | 'power' | 'subscript' | 'sqrt' | 'cbrt' | 'nroot' | 'abs'
    | 'paren' | 'bracket' | 'vector' | 'matrix' | 'call';

export interface Structure {
    readonly id: StructureId;
    readonly label: string;
    readonly group: 'Structures' | 'Functions';
    readonly title: string;
    /** Consumes the text to the left of the caret as the structure's base. */
    readonly absorbsLeft: boolean;
}

export const STRUCTURES: readonly Structure[] = Object.freeze([
    { id: 'frac', label: 'a/b', group: 'Structures', title: 'Fraction', absorbsLeft: true },
    { id: 'power', label: 'x\u207F', group: 'Structures', title: 'Power', absorbsLeft: true },
    { id: 'subscript', label: 'x\u2099', group: 'Structures', title: 'Subscript', absorbsLeft: true },
    { id: 'sqrt', label: '\u221A', group: 'Structures', title: 'Square root', absorbsLeft: true },
    { id: 'cbrt', label: '\u221B', group: 'Structures', title: 'Cube root', absorbsLeft: true },
    { id: 'nroot', label: '\u207F\u221A', group: 'Structures', title: 'n-th root', absorbsLeft: true },
    { id: 'abs', label: 'abs', group: 'Structures', title: 'Absolute value', absorbsLeft: true },
    { id: 'paren', label: '( )', group: 'Structures', title: 'Parentheses', absorbsLeft: false },
    { id: 'bracket', label: '[ ]', group: 'Structures', title: 'Brackets', absorbsLeft: false },
    { id: 'vector', label: '[a; b]', group: 'Structures', title: 'Vector', absorbsLeft: false },
    { id: 'matrix', label: 'Matrix', group: 'Structures', title: 'Insert matrix', absorbsLeft: false },
    { id: 'call', label: 'f(x)', group: 'Functions', title: 'Function call', absorbsLeft: false },
]);

/**
 * Symbols offered beside the structures: the operators a Calcpad document uses and the Greek
 * letters its variable names are full of. Shared so the field's palette and the panel's toolbar
 * cannot drift apart.
 */
export const PALETTE_SYMBOLS: readonly string[] = Object.freeze([
    '+', '-', '*', '/', '^', '=', '<', '>', '\u2264', '\u2265', '\u2260', '\u2227', '\u2228', '\u29BC',
    '\u03C0', '\u03B1', '\u03B2', '\u03B8', '\u03BB', '\u03BC', '\u03C3', '\u03C4', '\u03C9', '\u00B0',
]);

const EMPTY = (): MathElement => el('mrow', []);
const OPENERS = new Set(['(', '[']);
const CLOSERS = new Set([')', ']']);
const LEAF_NAMES = new Set(['mi', 'mn', 'mo', 'mtext', 'mspace']);

/** Structures with exactly two branches, which collapse to the surviving branch when emptied. */
const BINARY_STRUCTURES = new Set(['mfrac', 'msup', 'msub', 'mroot', 'munder', 'mover', 'munderover']);

/**
 * Characters that are structure, not text: typing them inside an operand has no valid meaning,
 * so they are declined. `(` and `[` are handled earlier because they open a structure, and `,`
 * is deliberately absent — it is a name character (`B_0,0`).
 */
const DECLINED = new Set([';', '|', ')', ']', ' ', '\t']);

type CharKind = 'digit' | 'name' | 'operator' | 'declined';

function classifyChar(ch: string): CharKind {
    if (DECLINED.has(ch)) return 'declined';
    if (isOperator(ch) || ch === '!') return 'operator';
    if (isDigitChar(ch) || ch === '.') return 'digit';
    if (isNameStart(ch) || isNameChar(ch)) return 'name';
    return 'declined';
}

// ---------------------------------------------------------------------------------------
// Characters
// ---------------------------------------------------------------------------------------

export function applyCharacter(root: MathNode, anchor: Anchor, ch: string): InsertResult {
    return guard(root, anchor, bracketSlots(applyCharacterUnguarded(root, anchor, ch)));
}

function applyCharacterUnguarded(root: MathNode, anchor: Anchor, ch: string): InsertResult {
    if (anchor.kind === 'char') {
        if (ch === '/') return buildStructure(root, anchor, 'frac');
        if (ch === '^') return buildStructure(root, anchor, 'power');
        if (ch === '(') return buildStructure(root, anchor, 'paren');
        if (ch === '[') return buildStructure(root, anchor, 'bracket');
        return insertText(root, anchor, ch);
    }
    return insertLeafAtGap(root, anchor, ch);
}

/**
 * The one rule the editor has to obey: never hold a tree its own parser disagrees with.
 *
 * The per-character rules above decline what they can recognise, but enumerating every way an
 * operator can end up in the wrong place is exactly the kind of analysis that leaves a hole. So
 * the result is checked instead: if the text it prints to re-parses to a *different* tree, the
 * keystroke is refused. Text that does not parse at all is left alone — `a + ` on the way to
 * `a + b` is a legitimate intermediate, and `isCommittableText` keeps it out of the document.
 */
function guard(root: MathNode, anchor: Anchor, result: InsertResult): InsertResult {
    const printed = printCalcpad(result.node);
    if (printed === printCalcpad(root)) return { node: root, anchor };
    // An unfilled slot prints as nothing, so a structure being built (`x()`, `q/`) never
    // re-parses to itself. That is the "held open" state, not a drift.
    if (hasEmptySlot(result.node)) return result;
    const reparsed = parseCalcpad(printed);
    if (!reparsed.ok || !reparsed.node) return result;
    return sameTree(result.node, reparsed.node) ? result : { node: root, anchor };
}

/**
 * Give a slot the brackets the printer already prints for it.
 *
 * A compound operand is bracketed when printed (`x^(2 + 1)`), and the parser reads those brackets
 * back as nodes — so a tree holding the operand bare is one its own printer disagrees with, and
 * the keystroke that would complete it is refused. Adding the brackets at the caret's position is
 * what makes a slot accept a compound expression at all.
 */
function bracketSlots(result: InsertResult): InsertResult {
    let node = result.node;
    let anchor = result.anchor;
    // A group can expose another slot inside it, so this repeats until nothing is left to wrap.
    for (let pass = 0; pass < 8; pass++) {
        const slot = slotNeedingBrackets(node, []);
        if (!slot) break;
        const container = nodeAtPath(node, slot.path);
        if (!isElement(container)) break;
        const childPath = [...slot.path, slot.index];
        const child = container.children[slot.index];
        const group = delimitedGroup(child);
        const moved = rebaseAnchor(child, childPath, group, anchor);
        // No bracket spelling, or a caret that cannot be followed into it: leave the tree to the
        // guard, which declines rather than guesses.
        if (moved === null) break;
        const children = container.children.slice();
        children[slot.index] = group;
        node = replaceAtPath(node, slot.path, { name: container.name, attrs: container.attrs, children });
        anchor = moved;
    }
    return { node, anchor };
}

/** The shallowest slot whose child the printer brackets, or `null` when every slot is settled. */
function slotNeedingBrackets(node: MathNode, path: Path): { path: Path; index: number } | null {
    if (!isElement(node)) return null;
    for (let i = 0; i < node.children.length; i++) {
        const ctx = slotContext(node.name, i);
        if (ctx && operandBracketed(node.children[i], ctx)) return { path, index: i };
    }
    for (let i = 0; i < node.children.length; i++) {
        const deeper = slotNeedingBrackets(node.children[i], [...path, i]);
        if (deeper) return deeper;
    }
    return null;
}

/** The delimited group a slot holds: the parser's own reading of `(content)`, when it has one. */
function delimitedGroup(child: MathNode): MathElement {
    const parsed = parseCalcpad(`(${printCalcpad(child)})`);
    if (parsed.ok && isElement(parsed.node) && isDelimited(parsed.node)) return parsed.node;
    // An incomplete operand (`2 +`) has no reading, but it prints as `(2 + )` either way.
    return el('mrow', [mo('('), child, mo(')')]);
}

/** A row that carries its own delimiters — the shape the parser gives `(x + 1)` and `[1; 2]`. */
function isDelimited(node: MathElement): boolean {
    const first = node.children[0];
    const last = node.children[node.children.length - 1];
    if (!isElement(first) || first.name !== 'mo' || !isElement(last) || last.name !== 'mo') return false;
    return OPENERS.has(leafText(first) ?? '') && CLOSERS.has(leafText(last) ?? '');
}

/**
 * Move the caret into `group`, or `null` when it cannot be placed there.
 *
 * The group adds a `(` and a `)` — two anchors each — and keeps the content's order and text, so
 * the caret's ordinal among the content's anchors is the same on both sides.
 */
function rebaseAnchor(child: MathNode, childPath: Path, group: MathElement, anchor: Anchor): Anchor | null {
    if (!startsWith(anchor.path, childPath)) return anchor;
    const local: Anchor = anchor.kind === 'char'
        ? { kind: 'char', path: anchor.path.slice(childPath.length), offset: anchor.offset }
        : { kind: 'gap', path: anchor.path.slice(childPath.length), index: anchor.index };
    const before = innerAnchors(child);
    const ordinal = before.findIndex((candidate) => sameAnchor(candidate, local));
    const after = anchorsOf(group);
    if (ordinal < 0 || after.length !== before.length + 4) return null;
    return shift(after[ordinal + 2], childPath);
}

/** A subtree's anchors without its end-of-row position, which only the tree's own root has. */
function innerAnchors(node: MathNode): Anchor[] {
    const list = anchorsOf(node);
    return trailingAnchor(node) === null ? list : list.slice(0, -1);
}

function startsWith(path: Path, prefix: Path): boolean {
    return path.length >= prefix.length && prefix.every((index, at) => path[at] === index);
}

export function insertText(root: MathNode, anchor: CharAnchor, text: string): InsertResult {
    if (text.length !== 1) return { node: root, anchor };
    const kind = classifyChar(text);
    if (kind === 'declined') return { node: root, anchor };

    const target = nodeAtPath(root, anchor.path);
    // Typing into an operator would append to its text, so the character belongs to the row that
    // owns it — the operand slot beside it. Declining made `a + ` impossible to finish.
    if (isElement(target) && target.name === 'mo') return insertBesideOperator(root, anchor, text, kind);

    if (kind === 'operator') {
        // Operators are nodes, not characters appended to a name: `a` then `+` must build the
        // `mrow[mi(a), mo(+)]` the parser builds from `a+`.
        const exit = exitClosedSlot(root, anchor, text);
        if (exit) return exit;
        return spliceNode(root, anchor, mo(text));
    }

    const current = isLeafNode(target) ? leafText(target) ?? '' : '';
    const next = current.slice(0, anchor.offset) + text + current.slice(anchor.offset);
    if (extendsLeaf(target, kind, next)) {
        const replacement = makeLeaf(target, next);
        // Typing inside a name keeps the caret after the inserted character. Extending `a_` with
        // `b` is different: the name becomes a `msub`, whose end is inside the subscript, so the
        // caret follows the rebuilt node instead of a fixed offset.
        const caret: Anchor = isLeafNode(replacement)
            ? { kind: 'char', path: anchor.path, offset: anchor.offset + 1 }
            : shift(lastAnchor(replacement), anchor.path);
        return { node: replaceAtPath(root, anchor.path, replacement), anchor: caret };
    }

    // A digit after a name, or a name after a number, is juxtaposition (`2x`), not one token.
    // `.` and `_` are the exceptions: they exist only inside a number or a name, so they can
    // never begin a token and are declined.
    const leaf = leafFor(text);
    if (!leaf) return { node: root, anchor };
    return spliceNode(root, anchor, leaf);
}

/**
 * Where an operator goes when the caret sits in a slot that cannot hold one.
 *
 * A subscript prints bare after `_` (`q_1 + 2` is the row `msub[q, 1] + 2`), so an operator typed
 * inside one belongs to the row outside it — otherwise the tree would hold an operator the text
 * appears to place elsewhere.
 */
function exitClosedSlot(root: MathNode, anchor: CharAnchor, ch: string): InsertResult | null {
    for (let depth = anchor.path.length - 1; depth >= 0; depth--) {
        const ownerPath = anchor.path.slice(0, depth);
        const owner = nodeAtPath(root, ownerPath);
        if (!isElement(owner) || owner.name !== 'msub') continue;

        const child = leafFor(ch);
        if (!child) return null;

        return appendAfter(root, ownerPath, child);
    }
    return null;
}

/**
 * Put `child` immediately after the node at `path`, as a sibling in its own row.
 *
 * A delimited row keeps exactly three children `(`, body, `)`, so a sibling of its body is
 * appended to the body — and a slot whose content *is* the node gets a row of its own.
 */
function appendAfter(root: MathNode, path: Path, child: MathNode): InsertResult {
    const parentPath = path.slice(0, -1);
    const parent = path.length === 0 ? null : nodeAtPath(root, parentPath);

    if (isElement(parent) && parent.name === 'mrow') {
        const rowPath = isDelimited(parent) ? [...parentPath, 1] : parentPath;
        const row = nodeAtPath(root, rowPath);
        if (isElement(row) && row.name === 'mrow') {
            const index = isDelimited(parent) ? row.children.length : path[path.length - 1] + 1;
            // At the row's end the parser groups what precedes the operator, so use that rule.
            if (index >= row.children.length) {
                return appendAtRowEnd(root, { kind: 'gap', path: rowPath, index }, row, child);
            }
            return spliceIntoRow(root, rowPath, row, index, child);
        }
        if (row == null) return { node: root, anchor: { kind: 'gap', path: rowPath, index: 0 } };
        return wrapInRow(root, rowPath, row, child);
    }
    const node = nodeAtPath(root, path);
    return node ? wrapInRow(root, path, node, child) : { node: root, anchor: { kind: 'gap', path: [], index: 0 } };
}

function spliceIntoRow(root: MathNode, rowPath: Path, row: MathElement, index: number, child: MathNode): InsertResult {
    const children = row.children.slice();
    children.splice(index, 0, child);
    return {
        node: replaceAtPath(root, rowPath, { name: row.name, attrs: row.attrs, children }),
        anchor: { kind: 'char', path: [...rowPath, index], offset: (leafText(child) ?? '').length },
    };
}

/** Replace a node with `mrow[node, child]`, so two tokens can share one slot. */
function wrapInRow(root: MathNode, path: Path, node: MathNode, child: MathNode): InsertResult {
    return {
        node: replaceAtPath(root, path, el('mrow', [node, child])),
        anchor: { kind: 'char', path: [...path, 1], offset: (leafText(child) ?? '').length },
    };
}

/** Insert beside an operator, in the row that owns it, and leave the caret after the new leaf. */
function insertBesideOperator(root: MathNode, anchor: CharAnchor, text: string, kind: CharKind): InsertResult {
    const operator = nodeAtPath(root, anchor.path);
    const width = isLeafNode(operator) ? (leafText(operator) ?? '').length : 0;
    // Only the two edges of the operator's own text mean "beside it".
    if (anchor.offset !== 0 && anchor.offset !== width) return { node: root, anchor };

    const inserted = kind === 'operator' ? mo(text) : leafFor(text);
    if (!inserted) return { node: root, anchor };

    const parentPath = anchor.path.slice(0, -1);
    const parent = nodeAtPath(root, parentPath);
    if (!isElement(parent)) return { node: root, anchor };

    const at = anchor.path[anchor.path.length - 1] + (anchor.offset === 0 ? 0 : 1);
    const children = parent.children.slice();
    children.splice(at, 0, inserted);
    return {
        node: replaceAtPath(root, parentPath, { name: parent.name, attrs: parent.attrs, children }),
        anchor: { kind: 'char', path: [...parentPath, at], offset: (leafText(inserted) ?? '').length },
    };
}

/** Whether `next` is still one token of the same kind — a name stays a name, a number a number. */
function extendsLeaf(target: MathNode | null | undefined, kind: CharKind, next: string): boolean {
    if (!isElement(target)) return false;
    if (target.name === 'mn') return kind === 'digit' && /^[0-9]*\.?[0-9]*$/.test(next);
    if (target.name === 'mi') {
        // Digits continue a name (`ab3` is one name), so both kinds extend it.
        return (kind === 'name' || kind === 'digit') && next !== '' && isNameStart(next[0])
            && Array.from(next).every((c) => isNameChar(c));
    }
    return false;
}

/** Insert `node` at the caret, splitting the leaf it lands in. */
function spliceNode(root: MathNode, anchor: CharAnchor, node: MathNode): InsertResult {
    const target = nodeAtPath(root, anchor.path);
    const text = isLeafNode(target) ? leafText(target) ?? '' : '';
    const left = text.slice(0, anchor.offset);
    let right = text.slice(anchor.offset);
    let inserted = node;

    // A name absorbs the name characters that follow it: `a` typed inside `12` is `1a2`, which
    // the parser reads as `1` and the single name `a2` — leaving `mi('a')` beside `mn('2')` would
    // be a tree its own parser never builds.
    if (isElement(inserted) && inserted.name === 'mi') {
        let absorbed = 0;
        while (absorbed < right.length && isNameChar(right[absorbed])) absorbed++;
        if (absorbed > 0) {
            inserted = nameToNode((leafText(inserted) ?? '') + right.slice(0, absorbed));
            right = right.slice(absorbed);
        }
    }

    const children: MathNode[] = [];
    let nodeIndex = 0;
    if (left !== '') { children.push(makeLeaf(target, left)); nodeIndex = 1; }

    // With nothing to its left the operator becomes a *prefix*, and the parser only preserves a
    // prefix `-` (it wraps `-x` but drops `+x`). Anything else would be read back as a different
    // tree, or not at all, so it is declined.
    const glyph = isElement(inserted) && inserted.name === 'mo' ? leafText(inserted) ?? '' : '';
    if (glyph !== '' && left === '' && glyph !== '-') return { node: root, anchor };
    // `!` is postfix, so it binds to the operand before it: mid-leaf the parser nests
    // `mrow[mrow[a, !], b]` while a flat row would print the same text. Only the end of a leaf
    // is unambiguous.
    if (glyph === '!' && right !== '') return { node: root, anchor };

    children.push(inserted);
    if (right !== '') children.push(makeLeaf(target, right));

    const replacement = children.length === 1 ? children[0] : el('mrow', children);
    const base = children.length === 1 ? anchor.path : [...anchor.path, nodeIndex];
    return { node: replaceAtPath(root, anchor.path, replacement), anchor: shift(lastAnchor(inserted), base) };
}

function insertLeafAtGap(root: MathNode, anchor: Extract<Anchor, { kind: 'gap' }>, ch: string): InsertResult {
    const child = leafFor(ch);
    if (!child) return { node: root, anchor };
    const container = nodeAtPath(root, anchor.path);
    if (!isElement(container)) return { node: root, anchor };

    // An empty slot is replaced by the leaf outright. Splicing into the empty `mrow` instead
    // would leave a one-child wrapper, and `q/1` would print as `q/(1)` — a tree that no
    // longer matches what the parser builds from the same text.
    if (container.children.length === 0) {
        return {
            node: replaceAtPath(root, anchor.path, child),
            anchor: { kind: 'char', path: anchor.path, offset: 1 },
        };
    }

    // The end of a row is not another splice position: the parser groups what precedes the
    // caret into the operand it builds, so `a = 3 + 1` reads back as `mrow[a, =, mrow[3, +, 1]]`
    // and `sqrt(x) + 1` stays one flat row. Splicing flat here prints the same text and drifts
    // from the tree, which the gate then refuses.
    if (anchor.index >= container.children.length) {
        // An *operand* continues the last token, because that is how the text reads back: `x^2`
        // then `1` prints `x^21`, whose exponent is `21`, not a new leaf beside the power. An
        // operator is the case the row end exists for, so it stays outside the structure.
        const end = nodeLevel(child) === null ? lastCharAnchor(root) : null;
        if (end) {
            const attempt = insertText(root, end, ch);
            if (printCalcpad(attempt.node) !== printCalcpad(root)) return attempt;
        }
        return appendAtRowEnd(root, anchor, container, child);
    }

    const children = container.children.slice();
    children.splice(anchor.index, 0, child);
    return {
        node: replaceAtPath(root, anchor.path, { name: container.name, attrs: container.attrs, children }),
        anchor: { kind: 'char', path: [...anchor.path, anchor.index], offset: 1 },
    };
}

/** The precedence level of an operator node, or `null` for anything that is not one. */
function nodeLevel(node: MathNode): number | null {
    if (!isElement(node) || node.name !== 'mo') return null;
    const spec = opSpec(leafText(node) ?? '');
    return spec ? spec.level : null;
}

/**
 * Append at the end of a row, grouped the way the parser reads the same text back.
 *
 * An operator takes everything after the last *looser* operator as its left operand, wrapping
 * it once that operand is a sequence (`1 + 2` then `+` becomes `mrow[mrow[1, +, 2], +]`). An
 * operand joins the trailing operand, which is wrapped the moment it holds a sequence — but
 * only when a looser operator owns it, since `sqrt(x) 2` is otherwise one flat row.
 */
function appendAtRowEnd(treeRoot: MathNode, anchor: GapAnchor, element: MathElement, child: MathNode): InsertResult {
    // Only a row has an end to append to. A line that is one structure (`sqrt(x)`, `x^2`)
    // roots in that structure, and adding a second child to it is not a wider expression but
    // a malformed node — so the structure becomes the first entry of a row first.
    if (element.name !== 'mrow') {
        const wrapped = el('mrow', [element]);
        const inner: GapAnchor = { kind: 'gap', path: anchor.path, index: 1 };
        return appendAtRowEnd(replaceAtPath(treeRoot, anchor.path, wrapped), inner, wrapped, child);
    }

    const children = element.children.slice();
    const level = nodeLevel(child);

    if (level !== null) {
        let start = 0;
        for (let i = 0; i < children.length; i++) {
            const other = nodeLevel(children[i]);
            if (other !== null && other > level) start = i + 1;
        }
        const operand = children.slice(start);
        children.length = start;
        if (start > 0) {
            // A looser operator owns this operand, so the operand grows *inside* its row: `a = 3`
            // then `+` is `mrow[a, =, mrow[3, +]]`, not a flat four-child row.
            children.push(el('mrow', [...operand, child]));
            return rebuilt(treeRoot, anchor, element, children, [start, operand.length], 1);
        }
        if (operand.length > 1) {
            // A chain binds left, so what precedes becomes the new operator's left operand.
            children.push(el('mrow', operand), child);
            return rebuilt(treeRoot, anchor, element, children, [1], 1);
        }
        if (operand.length === 1) {
            children.push(operand[0], child);
            return rebuilt(treeRoot, anchor, element, children, [1], 1);
        }
        children.push(child);
        return rebuilt(treeRoot, anchor, element, children, [0], 1);
    }

    const last = children[children.length - 1];
    const owned = children.some((c) => nodeLevel(c) !== null);
    if (nodeLevel(last) !== null || !owned) {
        children.push(child);
        return rebuilt(treeRoot, anchor, element, children, [children.length - 1], leafWidth(child));
    }

    // An operand that joins a sequence the parser groups — the assignment's right-hand side.
    children[children.length - 1] = el('mrow', [last, child]);
    return rebuilt(treeRoot, anchor, element, children, [children.length - 1, 1], leafWidth(child));
}

function leafWidth(node: MathNode): number {
    return (leafText(node) ?? '').length;
}

/** The deepest last character position in the tree, skipping the row-end gaps. */
function lastCharAnchor(root: MathNode): CharAnchor | null {
    const list = anchorsOf(root);
    for (let i = list.length - 1; i >= 0; i--) {
        const candidate = list[i];
        if (candidate.kind === 'char') return candidate;
    }
    return null;
}

/** Rebuild the row and put the caret at `caret`, relative to the row's own path. */
function rebuilt(
    treeRoot: MathNode,
    anchor: GapAnchor,
    element: MathElement,
    children: MathNode[],
    caret: Path,
    offset: number,
): InsertResult {
    const node = replaceAtPath(treeRoot, anchor.path, { name: element.name, attrs: element.attrs, children });
    return { node, anchor: { kind: 'char', path: [...anchor.path, ...caret], offset } };
}

// ---------------------------------------------------------------------------------------
// Structures
// ---------------------------------------------------------------------------------------

/**
 * Insert a named call — what the palette's function buttons do.
 *
 * A value to the left would merge with the name: `b` then `sin()` prints `bsin()`, which Calcpad
 * reads as one identifier. An explicit `*` keeps the tree and the text in agreement.
 */
export function insertCall(root: MathNode, anchor: Anchor, name: string): InsertResult {
    // `nameToNode` is the parser's own reading, so `log_2` becomes the subscripted name it
    // would build from the same text instead of an identifier the printer cannot reproduce.
    const call = el('mrow', [nameToNode(name, true), mo('('), EMPTY(), mo(')')]);
    const slot: Anchor = { kind: 'gap', path: [2], index: 0 };

    if (anchor.kind === 'gap') {
        const container = nodeAtPath(root, anchor.path);
        if (!isElement(container)) return { node: root, anchor };
        const children = container.children.slice();
        const product = anchor.index > 0 && endsWithValue(container.children[anchor.index - 1]);
        const inserted = product ? [mo('*'), call] : [call];
        children.splice(anchor.index, 0, ...inserted);
        const index = anchor.index + inserted.length - 1;
        return {
            node: replaceAtPath(root, anchor.path, { name: container.name, attrs: container.attrs, children }),
            anchor: shift(slot, [...anchor.path, index]),
        };
    }

    const split = splitLeaf(root, anchor);
    const children: MathNode[] = [];
    if (split.base) {
        children.push(split.base);
        if (endsWithValue(split.base)) children.push(mo('*'));
    }
    const index = children.length;
    children.push(call);
    if (split.rest) children.push(split.rest);

    const replacement = children.length === 1 ? children[0] : el('mrow', children);
    const callPath = children.length === 1 ? split.path : [...split.path, index];
    return { node: replaceAtPath(root, split.path, replacement), anchor: shift(slot, callPath) };
}

/** Whether a token ends like a value, so a call beside it would be juxtaposition, not a product. */
function endsWithValue(node: MathNode): boolean {
    const text = leafText(node);
    if (text === null) return isElement(node);
    const last = text[text.length - 1] ?? '';
    return last !== '' && (isNameChar(last) || isDigitChar(last) || CLOSERS.has(last) || last === '|');
}

export interface StructureOptions {
    /** Callee for a `call`: the palette's `sin` button needs a name, not the letter `f`. */
    readonly name?: string;
    /** Shape for a `matrix`, chosen in the dialog; clamped to 1–16 and defaulting to 3×3. */
    readonly rows?: number;
    readonly cols?: number;
}

export function insertStructure(root: MathNode, anchor: Anchor, id: StructureId, options: StructureOptions = {}): InsertResult {
    return bracketSlots(buildStructure(root, anchor, id, options));
}

function buildStructure(root: MathNode, anchor: Anchor, id: StructureId, options: StructureOptions = {}): InsertResult {
    const spec = STRUCTURES.find((s) => s.id === id);
    const absorbing = spec?.absorbsLeft ?? false;
    const split = anchor.kind === 'char'
        ? splitLeaf(root, anchor)
        : { base: null as MathNode | null, rest: null as MathNode | null, path: anchor.path };

    // The text left of the caret becomes the structure's base; the text right of it flows into
    // the structure's first empty slot, so typing `/` inside `ab` yields `a/b`, not `a(b/c)`.
    let base = absorbing ? split.base : null;
    let rest = split.rest;
    if (absorbing && !base && rest) {
        base = rest;
        rest = null;
    }

    // A `(` immediately after a name is a *function call* in Calcpad's grammar, not a product.
    // Building a juxtaposition here would produce a tree the parser never builds from the same
    // text, so the name is absorbed as the callee.
    const callee = options.name === undefined && split.base && isElement(split.base) && split.base.name === 'mi'
        ? split.base
        : null;
    if ((id === 'paren' || id === 'call') && callee) {
        const name = leafText(callee) ?? '';
        const call = el('mrow', [
            mi(name, BUILTIN_FUNCTIONS.has(name) ? { 'data-cp': 'func' } : {}),
            mo('('),
            EMPTY(),
            mo(')'),
        ]);
        const caret: Anchor = { kind: 'gap', path: [2], index: 0 };
        if (anchor.kind === 'gap') {
            const container = nodeAtPath(root, anchor.path);
            if (!isElement(container)) return { node: root, anchor };
            const children = container.children.slice();
            children.splice(anchor.index, 0, call);
            return {
                node: replaceAtPath(root, anchor.path, { name: container.name, attrs: container.attrs, children }),
                anchor: shift(caret, [...anchor.path, anchor.index]),
            };
        }
        return { node: replaceAtPath(root, split.path, call), anchor: shift(caret, split.path) };
    }

    const { structure, slot } = structureNode(id, base, options);

    let finalStructure = structure;
    let caretInStructure: Anchor = slot;
    if (absorbing && rest && slot.kind === 'gap' && slot.path.length > 0) {
        finalStructure = replaceAtPath(structure, slot.path, rest);
        caretInStructure = shift(lastAnchor(rest), slot.path);
        rest = null;
    }

    if (anchor.kind === 'gap') {
        const container = nodeAtPath(root, anchor.path);
        if (!isElement(container)) return { node: root, anchor };
        const children = container.children.slice();
        children.splice(anchor.index, 0, finalStructure);
        return {
            node: replaceAtPath(root, anchor.path, { name: container.name, attrs: container.attrs, children }),
            anchor: shift(caretInStructure, [...anchor.path, anchor.index]),
        };
    }

    const children: MathNode[] = [];
    let structureIndex = 0;
    if (!absorbing && split.base) {
        children.push(split.base);
        structureIndex = 1;
    }
    children.push(finalStructure);
    if (rest) children.push(rest);

    const replacement = children.length === 1 ? children[0] : el('mrow', children);
    // When the structure *is* the replacement it sits at `split.path`; when it is one child of
    // a new row it sits one level deeper. Getting this wrong leaves the caret pointing at a
    // node that does not exist, so the next keystroke is silently dropped.
    const structurePath = children.length === 1 ? split.path : [...split.path, structureIndex];
    return {
        node: replaceAtPath(root, split.path, replacement),
        anchor: shift(caretInStructure, structurePath),
    };
}

interface SplitResult {
    readonly base: MathNode | null;
    readonly rest: MathNode | null;
    readonly path: Path;
}

function splitLeaf(root: MathNode, anchor: CharAnchor): SplitResult {
    const node = nodeAtPath(root, anchor.path);
    const text = isLeafNode(node) ? leafText(node) ?? '' : '';
    const left = text.slice(0, anchor.offset);
    const right = text.slice(anchor.offset);
    return {
        base: left === '' ? null : makeLeaf(node, left),
        rest: right === '' ? null : makeLeaf(node, right),
        path: anchor.path,
    };
}

/** Build a structure and describe where the caret should land inside it (path from its root). */
function structureNode(id: StructureId, base: MathNode | null, options: StructureOptions = {}): { structure: MathNode; slot: Anchor } {
    const name = options.name;
    const b = base ?? EMPTY();
    switch (id) {
        case 'frac':
            return { structure: el('mfrac', [b, EMPTY()]), slot: { kind: 'gap', path: [1], index: 0 } };
        case 'power':
            return { structure: el('msup', [b, EMPTY()]), slot: { kind: 'gap', path: [1], index: 0 } };
        case 'subscript':
            return { structure: el('msub', [b, EMPTY()]), slot: { kind: 'gap', path: [1], index: 0 } };
        case 'sqrt': {
            const structure = el('msqrt', [b]);
            return { structure, slot: firstSlot(structure) };
        }
        case 'cbrt': {
            const structure = elAttr('mroot', { 'data-cp': 'cbrt' }, [b, mn('3')]);
            return { structure, slot: firstSlot(structure) };
        }
        case 'nroot':
            return { structure: elAttr('mroot', { 'data-cp': 'root' }, [b, EMPTY()]), slot: { kind: 'gap', path: [1], index: 0 } };
        case 'abs': {
            const structure = elAttr('mrow', { 'data-cp': 'abs' }, [mo('|'), b, mo('|')]);
            // With a base absorbed, path [1] is the base itself, not a slot: the caret goes to its
            // end. A gap there would address nothing and the next keystroke would be dropped.
            return {
                structure,
                slot: base ? shift(lastAnchor(base), [1]) : { kind: 'gap', path: [1], index: 0 },
            };
        }
        case 'paren':
            return { structure: el('mrow', [mo('('), EMPTY(), mo(')')]), slot: { kind: 'gap', path: [1], index: 0 } };
        case 'bracket':
            return { structure: el('mrow', [mo('['), EMPTY(), mo(']')]), slot: { kind: 'gap', path: [1], index: 0 } };
        case 'vector':
            return {
                structure: el('mrow', [mo('['), EMPTY(), mo(';'), EMPTY(), mo(']')]),
                slot: { kind: 'gap', path: [1], index: 0 },
            };
        case 'matrix': {
            // The dialog offers 1–8; the clamp keeps a bad caller from building an unfillable wall.
            const size = (value: number | undefined): number =>
                Math.min(16, Math.max(1, Math.round(value ?? 3)));
            return {
                structure: matrix(size(options.rows), size(options.cols)),
                slot: { kind: 'gap', path: [1, 0, 0, 0], index: 0 },
            };
        }
        case 'call':
            return {
                structure: el('mrow', [mi(name ?? 'f', { 'data-cp': 'func' }), mo('('), EMPTY(), mo(')')]),
                slot: { kind: 'gap', path: [2], index: 0 },
            };
    }
}

function matrix(rows: number, columns: number): MathNode {
    return el('mrow', [
        mo('['),
        el('mtable', Array.from({ length: rows }, () =>
            el('mtr', Array.from({ length: columns }, () => el('mtd', [EMPTY()])))
        )),
        mo(']'),
    ]);
}

function firstSlot(node: MathNode): Anchor {
    if (isElement(node) && node.children.length === 0) return { kind: 'gap', path: [], index: 0 };
    if (isElement(node)) {
        for (let i = 0; i < node.children.length; i++) {
            const slot = firstSlot(node.children[i]);
            if (slot.kind === 'gap') return { kind: 'gap', path: [i, ...slot.path], index: slot.index };
        }
    }
    return firstAnchor(node);
}

function shift(anchor: Anchor, prefix: Path): Anchor {
    return anchor.kind === 'char'
        ? { kind: 'char', path: [...prefix, ...anchor.path], offset: anchor.offset }
        : { kind: 'gap', path: [...prefix, ...anchor.path], index: anchor.index };
}

// ---------------------------------------------------------------------------------------
// Deletion
// ---------------------------------------------------------------------------------------

export function deleteBackward(root: MathNode, anchor: Anchor): InsertResult {
    // The end-of-row position holds no character of its own, so Backspace takes the last one —
    // otherwise the key does nothing at all at the end of `x^2`.
    if (anchor.kind === 'gap') {
        const container = nodeAtPath(root, anchor.path);
        if (!isElement(container) || anchor.index < container.children.length) return { node: root, anchor };
        return removeCharacterBefore(root, anchor);
    }
    const node = nodeAtPath(root, anchor.path);
    const text = isLeafNode(node) ? leafText(node) ?? '' : '';

    if (text === '') return removeEmptyLeaf(root, anchor);
    if (anchor.offset > 0) return removeCharacter(root, anchor, anchor.offset - 1);

    // Offset 0: the character to delete lives in the previous leaf, so walk back to it. Without
    // this the first character of every leaf is undeletable and nothing can ever be merged.
    return removeCharacterBefore(root, anchor);
}

/** Delete the last character before `anchor`, wherever in the tree it lives. */
function removeCharacterBefore(root: MathNode, anchor: Anchor): InsertResult {
    const list = anchorsOf(root);
    const index = list.findIndex((a) => sameAnchor(a, anchor));
    for (let i = index - 1; i >= 0; i--) {
        const previous = list[i];
        if (previous.kind === 'char' && previous.offset > 0) return removeCharacter(root, previous, previous.offset - 1);
    }
    return { node: root, anchor };
}

export interface DeleteOptions {
    /**
     * Keep the operator whose operand is removed. A selection delete leaves the place where a
     * replacement goes — `a + ` keeps its sign, so the next keystroke fills the slot — while a
     * Backspace removes the operator with the operand it belonged to.
     */
    readonly keepOperator?: boolean;
}

export function deleteForward(root: MathNode, anchor: Anchor, options: DeleteOptions = {}): InsertResult {
    if (anchor.kind === 'gap') return { node: root, anchor };
    const node = nodeAtPath(root, anchor.path);
    const text = isLeafNode(node) ? leafText(node) ?? '' : '';

    if (text === '') return removeEmptyLeaf(root, anchor, options);
    if (anchor.offset < text.length) return removeCharacter(root, anchor, anchor.offset, options);
    return { node: root, anchor };
}

function removeCharacter(root: MathNode, anchor: CharAnchor, at: number, options: DeleteOptions = {}): InsertResult {
    const node = nodeAtPath(root, anchor.path);
    const text = isLeafNode(node) ? leafText(node) ?? '' : '';
    const next = text.slice(0, at) + text.slice(at + 1);

    // Emptying a leaf that sits *in a row* removes it: leaving `mo('')` behind would print as
    // nothing and re-parse to a different tree, so `a + b` minus its `+` would read `ab` while
    // the editor still held the operator.
    if (next === '' && inRow(root, anchor.path)) return removeChild(root, anchor.path, options);

    return {
        node: replaceAtPath(root, anchor.path, makeLeaf(node, next)),
        anchor: { kind: 'char', path: anchor.path, offset: Math.max(0, at) },
    };
}

/**
 * Delete an empty leaf. A two-branch structure collapses to the branch that is left, so deleting
 * the empty numerator of `1/` gives `1` instead of an unremovable hole; anything else drops the
 * child.
 */
function removeEmptyLeaf(root: MathNode, anchor: CharAnchor, options: DeleteOptions = {}): InsertResult {
    if (anchor.path.length === 0) return { node: root, anchor };

    const parentPath = anchor.path.slice(0, -1);
    const parent = nodeAtPath(root, parentPath);
    if (!isElement(parent)) return { node: root, anchor };
    const index = anchor.path[anchor.path.length - 1];

    if (BINARY_STRUCTURES.has(parent.name) && parent.children.length === 2) {
        const sibling = parent.children[index === 0 ? 1 : 0];
        return { node: replaceAtPath(root, parentPath, sibling), anchor: shift(firstAnchor(sibling), parentPath) };
    }
    return removeChild(root, anchor.path, options);
}

/** Remove the node at `path` from its parent, pruning a row left with a dangling operator. */
function removeChild(root: MathNode, path: Path, options: DeleteOptions = {}): InsertResult {
    const parentPath = path.slice(0, -1);
    const parent = nodeAtPath(root, parentPath);
    if (!isElement(parent)) return { node: root, anchor: { kind: 'gap', path: [], index: 0 } };
    const index = path[path.length - 1];

    let children = parent.children.filter((_, i) => i !== index);
    if (parent.name === 'mrow') children = pruneRow(children, options);

    return {
        node: replaceAtPath(root, parentPath, { name: parent.name, attrs: parent.attrs, children }),
        anchor: { kind: 'gap', path: parentPath, index: Math.min(index, children.length) },
    };
}

/** Drop emptied leaves and a trailing dangling operator, so `a + b` minus `b` reads `a`. */
function pruneRow(children: readonly MathNode[], options: DeleteOptions = {}): MathNode[] {
    let out = children.filter((c) => !(isLeafNode(c) && (leafText(c) ?? '') === ''));
    while (out.length > 1 && isDanglingOperator(out[out.length - 1]) && !options.keepOperator) {
        // `=` joins the line's two halves rather than two operands: dropping it when the right
        // side is deleted would leave `a`, where no keystroke can rebuild the assignment.
        if (leafText(out[out.length - 1]) === '=') break;
        out = out.slice(0, -1);
    }
    return out;
}

/** A trailing binary operator with no right operand — only safe to drop at the end of a row. */
function isDanglingOperator(node: MathNode): boolean {
    return isElement(node) && node.name === 'mo' && isOperator(leafText(node) ?? '');
}

function inRow(root: MathNode, path: Path): boolean {
    if (path.length === 0) return false;
    const parent = nodeAtPath(root, path.slice(0, -1));
    return isElement(parent) && parent.name === 'mrow' && parent.children.length > 1;
}

// ---------------------------------------------------------------------------------------

function isLeafNode(node: MathNode | null | undefined): node is MathElement {
    return node != null && isElement(node) && LEAF_NAMES.has(node.name);
}

/** Rebuild a leaf of the same kind, so typing into `mn` keeps it a number. */
function makeLeaf(node: MathNode | null | undefined, text: string): MathNode {
    if (isElement(node) && (node.name === 'mn' || node.name === 'mo' || node.name === 'mtext')) {
        return leaf(node.name, text, node.attrs);
    }
    // A name follows the parser's own rule, so `a_b` becomes the `msub` the parser builds —
    // not a plain identifier that round-trips to a different tree.
    if (text !== '' && isNameStart(text[0]) && Array.from(text).every((c) => isNameChar(c))) {
        return nameToNode(text);
    }
    return leafFor(text) ?? mi(text);
}

/**
 * The leaf a character belongs in, or `null` when it cannot begin a token at all.
 *
 * `_` and `,` are name *characters* but not name *starters*, and `.` belongs to a number — so
 * none of them can open a token and each is declined instead of producing an unreadable node.
 */
function leafFor(ch: string): MathNode | null {
    if (isOperator(ch) || ch === '!') return mo(ch);
    if (isNameStart(ch)) return mi(ch);
    if (isDigitChar(ch)) return mn(ch);
    return null;
}
