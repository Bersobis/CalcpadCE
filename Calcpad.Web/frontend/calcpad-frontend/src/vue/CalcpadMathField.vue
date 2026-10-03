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
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { calcpadToAst } from '../math/calcpad';
import { astToLatex, latexToCalcpad } from '../math/latex';

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
}>();

/** MathLive upgrades `MathfieldElement` globally when the custom element is defined. */
type MathfieldElement = HTMLElement & {
    value: string;
    focus(): void;
    blur(): void;
    executeCommand(command: string): void;
    setValue(value?: string, options?: Record<string, unknown>): void;
    getValue(format?: string): string;
};

const host = ref<HTMLElement | null>(null);
const editing = ref(false);
const latex = ref('');

/** Set by `setValue` to suppress the `input` event it would otherwise cause. */
let writing = false;

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

    const next = latexToCalcpad(el.value).trim();
    if (!next) {
        emit('invalid', next, 'empty expression');
        refresh();
        return;
    }
    if (next === props.modelValue.trim()) {
        refresh();
        return;
    }

    emit('update:modelValue', next);
    emit('commit', next);
}

function onInput(): void {
    if (writing || !editing.value) return;
    // Keep the visible LaTeX in step while typing without emitting on every keystroke.
    const el = field();
    if (el) latex.value = el.value;
}

onMounted(() => {
    refresh();
    const el = field();
    el?.addEventListener('input', onInput);
});

onBeforeUnmount(() => {
    field()?.removeEventListener('input', onInput);
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