import type { AppInstance } from '../editor/app-instance';
import type { EditorGroup } from '../editor/editor-group';
import type { EditorBridge } from '../editor/bridge';
import type { ResultMode } from '../services/workspace-state';
import type { PlatformBridge } from '../services/platform';
import { buildApiSettings } from 'calcpad-frontend/types/settings';
import {
    extractUiControls,
    previewSizeLimitChars,
    previewLimitNoticeHtml,
    formatSize,
    DEFAULT_PREVIEW_SIZE_MB,
    MAX_INLINE_IMAGE_TOTAL_BYTES,
    type InlineImageBudget,
} from 'calcpad-frontend';
import { PreviewLoadingTracker } from './preview-loading';

export interface PreviewDependencies {
    appInstance: AppInstance;
    editorBridge: EditorBridge;
    platform: PlatformBridge;
    getActiveGroup: () => EditorGroup;
    getResultMode: () => ResultMode;
    isPreviewVisible: () => boolean;
    resolvePreviewTheme: () => 'light' | 'dark';
    getUiOverrides: (docKey: string) => Record<string, string> | undefined;
    syncUiOverrides: (group: EditorGroup, content: string) => void;
    refreshUiPrint: (group: EditorGroup, content: string, apiSettings: unknown, sourceFilePath: string | undefined, theme: 'light' | 'dark') => Promise<void>;
    onConvertErrors: (errors: unknown[]) => void;
}

export class PreviewRenderer {
    private readonly loadingTracker: PreviewLoadingTracker;

    constructor(private readonly deps: PreviewDependencies) {
        this.loadingTracker = new PreviewLoadingTracker(deps.appInstance);
    }

    private previewSizeLimit(): number {
        const stored = Number(this.deps.editorBridge.getExtraSetting('maxPreviewSizeMB'));
        return previewSizeLimitChars(Number.isFinite(stored) && stored > 0 ? stored : DEFAULT_PREVIEW_SIZE_MB);
    }

    private previewImageBudget(group: EditorGroup): InlineImageBudget {
        return {
            maxTotalBytes: MAX_INLINE_IMAGE_TOTAL_BYTES,
            onExceeded: 'skip',
            onSkip: (skipped) => this.deps.appInstance.appendOutput('warn',
                `Image budget of ${formatSize(MAX_INLINE_IMAGE_TOTAL_BYTES)} reached — ${skipped} image(s) left unembedded in the preview.`,
                'preview', group.id),
        };
    }

    private previewTooLarge(group: EditorGroup, html: string, uiPrint = false): boolean {
        const limit = this.previewSizeLimit();
        if (html.length <= limit) return false;

        this.deps.appInstance.appendOutput('warn',
            `Preview blocked: this document rendered to ${formatSize(html.length)}, over the ${formatSize(limit)} limit.`,
            'preview', group.id);
        const notice = previewLimitNoticeHtml({
            chars: html.length,
            limitChars: limit,
            theme: this.deps.resolvePreviewTheme(),
        });
        if (uiPrint) void this.deps.appInstance.setUiPrintHtml(group.id, notice, undefined);
        else void this.deps.appInstance.setPreviewHtml(group.id, notice, undefined, undefined);
        return true;
    }

    async refreshPreviewFor(group: EditorGroup): Promise<void> {
        if (!this.deps.isPreviewVisible()) return;
        if (this.deps.getResultMode() === 'ui' && group !== this.deps.getActiveGroup()) return;

        const content = group.editor.getValue();
        const settings = this.deps.editorBridge.getSettings();
        const apiSettings = buildApiSettings(settings);
        const mode = this.deps.getResultMode() as ResultMode;
        const theme = this.deps.resolvePreviewTheme();

        if (!content.trim()) {
            void this.deps.appInstance.setPreviewHtml(group.id, '', undefined, undefined);
            return;
        }

        const hideLoading = this.loadingTracker.begin(group.id);
        let result;
        try {
            const overrideMode = mode === 'ui' || mode === 'report';
            if (overrideMode) this.deps.syncUiOverrides(group, content);
            const ui = overrideMode
                ? { enableUi: mode === 'ui', uiOverrides: this.deps.getUiOverrides(group.id) }
                : undefined;
            const write = this.deps.platform.bridge.mayWrite(mode === 'report', mode === 'ui');
            result = mode === 'unwrapped'
                ? await this.deps.platform.bridge.api.convertUnwrapped(content, apiSettings, undefined, theme, { key: `preview:${group.id}`, write })
                : await this.deps.platform.bridge.api.convert(
                    content, apiSettings, 'html', mode === 'report', undefined, theme, ui,
                    mode === 'report' ? true : undefined, { key: `preview:${group.id}`, write });
        } catch (err) {
            void hideLoading();
            throw err;
        }

        if (result && !(result instanceof ArrayBuffer)) {
            if (this.previewTooLarge(group, result.html)) {
                await hideLoading();
                return;
            }
            const finalHtml = this.deps.platform.capabilities.isTauri
                ? await this.deps.platform.inlineDocumentImages(result.html, this.previewImageBudget(group))
                : result.html;
            const committed = this.deps.appInstance.setPreviewHtml(group.id, finalHtml, undefined, group.id);
            if (mode === 'ui') {
                const controls = extractUiControls(result.html);
                this.deps.appInstance.appendOutput('debug', `Extracted ${controls.length} UI controls`);
            }
            this.deps.onConvertErrors(result.errors);
            await committed;
        }
        await hideLoading();

        if (mode === 'ui' && this.deps.appInstance.isUiPrintVisible()) {
            await this.deps.refreshUiPrint(group, content, apiSettings, undefined, theme);
        }
    }

    cancelLoadingFor(groupId: string): void {
        this.loadingTracker.cancelAll(groupId);
    }
}
