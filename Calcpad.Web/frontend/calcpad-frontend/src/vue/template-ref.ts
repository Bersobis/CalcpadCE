/**
 * Reading a template ref that lives inside `v-for`.
 *
 * Vue collects a `ref` used inside `v-for` into an **array**, because there could
 * be one element per iteration — even when a `v-if` means only one is ever
 * rendered. A ref that is always a single instance therefore still arrives
 * wrapped, and code that treats it as the instance fails at the one moment it
 * matters:
 *
 * ```ts
 * // mathEditor.value is [instance], which is truthy and has no applyPalette
 * if (useGraphical.value && mathEditor.value) mathEditor.value.applyPalette(a)
 * // TypeError: mathEditor.value.applyPalette is not a function
 * ```
 *
 * That is not hypothetical — it is why every palette button did nothing in the
 * graphical editor, and why the caret placement that uses the same ref threw.
 * Nothing in the type system catches it, because a `ref<T>` is declared `T | null`
 * whatever Vue actually assigns.
 *
 * A function ref (`:ref="setMathEditor"`) receives the instance itself and is the
 * supported way out; this normaliser keeps both shapes safe so the call sites can
 * read as if there were one instance, which is what there is.
 */

/** The single live instance behind a template ref, or `null` when there is none. */
export function singleTemplateRef<T>(value: unknown): T | null {
    if (Array.isArray(value)) return (value[0] as T) ?? null;
    return (value as T) ?? null;
}
