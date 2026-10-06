import { reactive, watch } from 'vue';

/**
 * Collapse state for a list of sections, remembered across mounts in localStorage.
 *
 * `CalcpadApp` renders its tabs with `v-if`, so a plain `ref` would reset on every tab
 * switch; the state has to outlive the component. The Export and Settings tabs had each
 * grown their own copy of the same parse / deep-watch / persist cycle, differing only in
 * the storage key. It lives here once.
 */
export function usePersistentCollapse(storageKey: string): {
    collapsed: Record<string, boolean>;
    isCollapsed: (id: string) => boolean;
    toggle: (id: string) => void;
} {
    const collapsed = reactive<Record<string, boolean>>({});
    try {
        Object.assign(collapsed, JSON.parse(localStorage.getItem(storageKey) || '{}'));
    } catch {
        // ignore unavailable/corrupt storage
    }
    watch(collapsed, () => {
        try {
            localStorage.setItem(storageKey, JSON.stringify(collapsed));
        } catch {
            // ignore unavailable storage
        }
    }, { deep: true });

    const isCollapsed = (id: string): boolean => !!collapsed[id];
    const toggle = (id: string): void => { collapsed[id] = !collapsed[id]; };

    return { collapsed, isCollapsed, toggle };
}
