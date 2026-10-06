import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue';

/** Viewport coordinates a menu is anchored at. `MouseEvent` satisfies this directly. */
export interface MenuAnchor {
    x: number;
    y: number;
}

/** A menu's own payload — the row it was opened on — plus the anchor. */
export type AnchoredMenu<T> = T & MenuAnchor;

/**
 * A right-click menu that closes when the document is clicked or Escape is pressed.
 *
 * The Errors, Files and Variables tabs had each grown their own copy of this: the same
 * `contextMenu` ref, the same `closeContextMenu`, the same two document listeners with
 * the same Escape guard, and the same mount/unmount wiring. Only the payload differed.
 * Written once here, so the dismissal rule cannot drift between tabs.
 *
 * `T` is whatever the menu needs to render; the anchor is added by `openContextMenu`.
 * The menu markup itself stays in each component, including its `@mousedown.stop` —
 * that is what keeps a click on a menu item from reaching the document listener below
 * and closing the menu before the item's own click handler runs.
 */
export function useContextMenu<T>(): {
    contextMenu: Ref<AnchoredMenu<T> | null>;
    openContextMenu: (anchor: MenuAnchor, data: T) => void;
    closeContextMenu: () => void;
} {
    const contextMenu = ref<AnchoredMenu<T> | null>(null) as Ref<AnchoredMenu<T> | null>;

    function closeContextMenu(): void {
        contextMenu.value = null;
    }

    function openContextMenu(anchor: MenuAnchor, data: T): void {
        contextMenu.value = { ...data, x: anchor.x, y: anchor.y };
    }

    function onDocumentInteraction(event: MouseEvent | KeyboardEvent): void {
        if (!contextMenu.value) return;
        // Only Escape dismisses on a keypress; every other key is left to the editor.
        if (event instanceof KeyboardEvent && event.key !== 'Escape') return;
        closeContextMenu();
    }

    onMounted(() => {
        document.addEventListener('mousedown', onDocumentInteraction);
        document.addEventListener('keydown', onDocumentInteraction);
    });

    onBeforeUnmount(() => {
        document.removeEventListener('mousedown', onDocumentInteraction);
        document.removeEventListener('keydown', onDocumentInteraction);
    });

    return { contextMenu, openContextMenu, closeContextMenu };
}
