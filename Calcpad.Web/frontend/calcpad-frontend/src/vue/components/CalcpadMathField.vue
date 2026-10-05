<script setup lang="ts">
/**
 * A Calcpad expression edited as maths.
 *
 * Wraps MathLive's `<math-field>` custom element and keeps it in sync with Calcpad
 * source text in both directions. Read mode renders the expression typeset; click or
 * focus switches it to an editable field whose contents become Calcpad text again on
 * commit, which is the whole point of the canvas: the user types maths, the document
 * still stores Calcpad.
 *
 * MathLive is loaded by the host application (`import 'mathlive'`), not here, so this
 * component stays usable in tests and in hosts that render statically. The package's
 * own `mathlive/vue` export is a Vue 2 shim with no MathJSON or event forwarding, so
 * the binding is written out rather than inherited.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { calcpadToAst } from '../../math/calcpad';
import { astToLatex, latexToCalcpad } from '../../math/latex';
import { applyMatrixOp, matrixSize } from '../../math/matrixOps';
import type { MatrixOp } from '../../math/matrixOps';
import { checkCommit } from '../../math/commitGuard';
import { wrapInsert, stripProvisionalTimes, TIMES } from '../../math/insertMultiply';
import type { MathFieldHandle } from '../../math/mathFieldTools';

const props = withDefaults(defineProps<{
    /** Calcpad source for this expression, e.g. `A = 0.01m^2`. */
    modelValue: string;
    /** Render typeset and only edit on click. */
    readonly?: boolean;
    /** Show the generated LaTeX next to the field, for debugging a round-trip. */
    showSource?: boolean;
}>(), { readonly: false, showSource: false });

const emit = defineEmits<{
    'update:modelValue': [value: string];
    commit: [value: string];
    invalid: [value: string, error: string];
    /** Something worth saying that is not a failure, e.g. an inserted template's empty slot. */
    hint: [text: string];
    /**
     * This field has started or stopped being the toolbar's target. The handle is always
     * sent, so the host can tell *which* field withdrew and ignore a stale one.
     */
    active: [handle: MathFieldHandle, active: boolean];
}>();

/** MathLive upgrades `MathfieldElement` globally when the custom element is defined. */
type MathfieldElement = HTMLElement & {
    value: string;
    focus(): void;
    blur(): void;
    executeCommand(command: string): void;
    /** A command with arguments, e.g. `['insert', '\\sqrt{#0}']`. */
    executeCommand(command: [string, string]): void;
    setValue(value?: string, options?: Record<string, unknown>): void;
    getValue(format?: string): string;
    /** Caret offsets, as the `(start, end)` pairs of the selection. */
    readonly selection: { ranges: [number, number][]; direction: string };
};

const host = ref<HTMLElement | null>(null);
const editing = ref(false);
const latex = ref('');

/** Set by `setValue` to suppress the `input` event it would otherwise cause. */
let writing = false;

/** Set when the last insert ended with a multiplication sign this editor added. */
let provisionalTimes = false;

function field(): MathfieldElement | null {
    return (host.value?.querySelector('math-field') as MathfieldElement | null) ?? null;
}

/** Typeset when not editing, so the same element serves both states. */
function fieldIsReadonly(): boolean {
    return props.readonly || !editing.value;
}

function toLatexOrEmpty(source: string): string {
    try {
        return astToLatex(calcpadToAst(source));
    } catch {
        // An expression the parser cannot represent still needs to display; showing it
        // as plain text beats showing nothing.
        return `\\text{${source.replace(/([\\{}])/g, '\\$1')}}`;
    }
}

function refresh(): void {
    // The field is being rebuilt from the document, so any sign an insert left provisional
    // is gone with it. Clearing here stops a later edit losing a `·` the user typed.
    provisionalTimes = false;
    latex.value = toLatexOrEmpty(props.modelValue);
    const el = field();
    if (!el || writing) return;
    writing = true;
    // LaTeX is MathLive's native format; no conversion marker needed.
    el.setValue(latex.value, { silenceNotifications: true });
    writing = false;
}

function beginEdit(): void {
    if (props.readonly || editing.value) return;
    editing.value = true;
    field()?.focus();
}

function endEdit(commit: boolean): void {
    if (!editing.value) return;
    const el = field();
    editing.value = false;
    if (!commit || !el) {
        refresh();
        return;
    }

    const source = withoutProvisionalTimes(el);
    const next = latexToCalcpad(source).trim();
    if (!next) {
        emit('invalid', next, 'empty expression');
        refresh();
        return;
    }
    // The reader is forgiving, so `next` is not automatically a line worth writing: a
    // half-typed `a +` comes back as `a + 0`, and an unfilled template as `sqrt(())`.
    // Both are valid Calcpad carrying a value nobody asked for, and there is no error
    // afterwards to show that it happened. The field stays open and the user is told why.
    const verdict = checkCommit(source, next);
    if (!verdict.ok) {
        emit('invalid', next, verdict.reason ?? 'that is not a complete expression');
        editing.value = true;
        return;
    }
    if (sameMeaning(next, props.modelValue)) {
        refresh();
        return;
    }

    emit('update:modelValue', next);
    emit('commit', next);
}

/**
 * Printing canonicalises whitespace (`A = 1` → `A=1`), so comparing text would fire a
 * commit for a line the user only clicked into. Node spans are dropped: they record
 * positions in the original text, which differ for inputs that differ only that way.
 */
function sameMeaning(a: string, b: string): boolean {
    const shape = (text: string): string => {
        try {
            return JSON.stringify(calcpadToAst(text), (key, value) => (key === 'source' ? undefined : value));
        } catch {
            return text.trim();
        }
    };
    return shape(a) === shape(b);
}

function onInput(): void {
    if (writing || !editing.value) return;
    // Keep the visible LaTeX in step while typing without emitting on every keystroke.
    const el = field();
    if (el) latex.value = el.value;
}

/** The size of the bracketed literal, or null when the expression holds none. */
const size = computed(() => matrixSize(props.modelValue));

/** Dispatches a MathLive command, which is where its undo history lives. */
function command(name: string): void {
    const el = field();
    if (!el) return;
    el.focus();
    el.executeCommand(name);
    latex.value = el.value;
}

/**
 * Inserts a template at the caret. The field is left in edit mode with the slot selected so
 * the user types straight into it -- an inserted-but-empty template is a syntax error
 * (`Invalid syntax: "( )"`), and committing one would write a broken line to the document.
 *
 * MathLive would otherwise glue the template to whatever already sits at the caret, which
 * is read as multiplication by MathLive and not always by Calcpad: `a` with `2` inserted
 * after it comes out as `a2`, one variable rather than a product. An explicit `·` is added
 * on whichever side has an operand, so what the user sees is what the document keeps.
 */
function insert(latexTemplate: string): void {
    const el = field();
    if (!el) return;
    beginEdit();
    el.focus();
    const wrapped = wrapInsert(latexTemplate, ...aroundCaret(el));
    // Remembered so a commit can tell a `·` this editor put there from one the user typed.
    // Left dangling it would read as `* 0`, so the guard would refuse the commit; that is
    // right for a half-typed `+` and wrong for a sign nobody asked to finish.
    provisionalTimes = wrapped.trimEnd().endsWith(TIMES);
    el.executeCommand(['insert', wrapped]);
    latex.value = el.value;
    emit('hint', 'Inserted — fill in the empty slot, or press Esc to cancel. Nothing is written until it is.');
}

/** The field's LaTeX with a still-unused trailing sign from an insert taken off. */
function withoutProvisionalTimes(el: MathfieldElement): string {
    if (!provisionalTimes) return el.value;
    provisionalTimes = false;
    return stripProvisionalTimes(el.value);
}

/** The LaTeX before and after the caret, for `wrapInsert` to judge. */
function aroundCaret(el: MathfieldElement): [string, string] {
    const range = el.selection.ranges[0] ?? [0, 0];
    const source = el.value;
    return [source.slice(0, range[0]), source.slice(range[1])];
}

/**
 * Reshapes the matrix and commits it at once, rather than leaving the field waiting for
 * a blur the user may not make. The document is still the source of truth: this is the
 * same write-back path a typed edit takes.
 */
function reshape(op: MatrixOp): void {
    if (props.readonly) return;
    const next = applyMatrixOp(props.modelValue, op);
    if (next === props.modelValue) return;

    latex.value = toLatexOrEmpty(next);
    const el = field();
    if (el) {
        writing = true;
        el.setValue(latex.value, { silenceNotifications: true });
        writing = false;
        el.focus();
    }
    emit('update:modelValue', next);
    emit('commit', next);
}

/** True while this field is the one the docked toolbar should act on. */
const isTarget = computed(() => !props.readonly && editing.value);

/**
 * What the docked toolbar calls. Built once and stable, so the toolbar can hold it across
 * renders; `size` stays a getter because a resize changes it in place.
 */
const handle: MathFieldHandle = {
    get size() {
        return size.value;
    },
    insert,
    command,
    reshape,
};

/**
 * Becoming the toolbar's target follows edit mode, so the controls arrive with the caret
 * and leave with it. The handle travels with the flag: watchers run in creation order, so
 * moving between two fields has the old one releasing *after* the new one claims, and a
 * bare null would let that stale release cancel the toolbar the user is now looking at.
 */
watch(isTarget, (on) => emit('active', handle, on));

onMounted(() => {
    refresh();
    field()?.addEventListener('input', onInput);
});

onBeforeUnmount(() => {
    field()?.removeEventListener('input', onInput);
    // Re-keying the region list destroys this field and builds another in its place. The
    // toolbar holds a direct reference, so without this it would keep driving a detached
    // element and the buttons would silently do nothing.
    if (isTarget.value) emit('active', handle, false);
});

watch(() => props.modelValue, refresh);
</script>

<template>
    <span class="calcpad-math" :class="{ 'is-editing': editing }">
        <!-- The field lives inside `host`: `field()` reaches it with `querySelector`, and
             `host` is the click and focus target that starts an edit. -->
        <span
            ref="host"
            class="calcpad-math__host"
            :role="readonly ? 'presentation' : 'button'"
            :tabindex="readonly ? -1 : 0"
            @click="beginEdit"
            @focusin="beginEdit"
            @keydown.enter.prevent="beginEdit"
            @keydown.esc.prevent="endEdit(false)"
        >
            <math-field
                class="calcpad-math__field"
                :readonly="fieldIsReadonly()"
                @blur="endEdit(true)"
            />
        </span>
        <code v-if="showSource && !editing" class="calcpad-math__latex">{{ latex }}</code>
    </span>
</template>

<style scoped>
.calcpad-math {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
}

.calcpad-math__host math-field,
.calcpad-math__field {
    font-size: 1em;
}

.calcpad-math__latex {
    font-size: 0.8em;
    opacity: 0.6;
    font-family: ui-monospace, monospace;
}
</style>