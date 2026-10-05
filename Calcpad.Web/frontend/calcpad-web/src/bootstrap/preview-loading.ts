import type { AppInstance } from '../editor/app-instance';

const PREVIEW_LOADING_DELAY_MS = 400;
const PREVIEW_LOADING_MIN_MS = 300;

/**
 * Simplified preview loading tracker using request IDs instead of sequence maps.
 * Each group has a monotonically increasing request ID; only the latest request
 * can show or hide the loading overlay.
 */
export class PreviewLoadingTracker {
    private readonly requestIds = new Map<string, number>();
    private readonly shownAt = new Map<string, number>();

    constructor(private readonly appInstance: AppInstance) {}

    /** Begin tracking a new request for a group. Returns a closer function. */
    begin(groupId: string): () => Promise<void> {
        const id = (this.requestIds.get(groupId) ?? 0) + 1;
        this.requestIds.set(groupId, id);

        let timer: ReturnType<typeof setTimeout> | null = null;
        let shown = false;

        timer = setTimeout(() => {
            if (this.requestIds.get(groupId) !== id) return;
            shown = true;
            this.shownAt.set(groupId, performance.now());
            this.appInstance.setPreviewLoading(groupId, true);
        }, PREVIEW_LOADING_DELAY_MS);

        return async () => {
            if (timer) clearTimeout(timer);
            if (this.requestIds.get(groupId) !== id) return;

            if (shown) {
                const elapsed = performance.now() - (this.shownAt.get(groupId) ?? 0);
                if (elapsed < PREVIEW_LOADING_MIN_MS) {
                    await new Promise(r => setTimeout(r, PREVIEW_LOADING_MIN_MS - elapsed));
                }
            }
            this.appInstance.setPreviewLoading(groupId, false);
        };
    }

    /** Cancel all pending requests for a group (e.g. on dispose). */
    cancelAll(groupId: string): void {
        this.requestIds.delete(groupId);
        this.shownAt.delete(groupId);
    }
}
