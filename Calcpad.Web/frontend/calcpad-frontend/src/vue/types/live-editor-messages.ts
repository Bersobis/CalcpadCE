/**
 * Typed message protocol for the live editor panel and its host.
 *
 * The host (VS Code extension, web app bridge, or Tauri backend) sends
 * `liveDocument` and `liveLineWritten`. The panel sends `getLiveDocument`,
 * `liveEditLine`, and `goToLine`.
 */

import type { LiveLine } from '../../services/live-document';

// ---- Host → Panel ----------------------------------------------------------

/** The host has re-rendered the document; the panel should refresh its view. */
export interface LiveDocumentMessage {
    type: 'liveDocument';
    lines: LiveLine[];
    totalLines: number;
    editableCount: number;
}

/** The host reports success or failure of a `liveEditLine` write. */
export interface LiveLineWrittenMessage {
    type: 'liveLineWritten';
    line: number;
    ok: boolean;
    error?: string;
}

/** Union of all messages the host sends to the live editor panel. */
export type LiveEditorHostMessage = LiveDocumentMessage | LiveLineWrittenMessage;

// ---- Panel → Host ----------------------------------------------------------

/** The panel asks the host for the current live document. */
export interface GetLiveDocumentMessage {
    type: 'getLiveDocument';
}

/** The panel asks the host to replace one line of source. */
export interface LiveEditLineMessage {
    type: 'liveEditLine';
    line: number;
    text: string;
}

/** The panel asks the host to scroll its editor to a line. */
export interface GoToLineMessage {
    type: 'goToLine';
    line: number;
}

/** Union of all messages the live editor panel sends to the host. */
export type LiveEditorPanelMessage = GetLiveDocumentMessage | LiveEditLineMessage | GoToLineMessage;

// ---- Type guards -----------------------------------------------------------

export function isLiveDocumentMessage(msg: unknown): msg is LiveDocumentMessage {
    return (
        typeof msg === 'object' &&
        msg !== null &&
        (msg as Record<string, unknown>).type === 'liveDocument' &&
        Array.isArray((msg as Record<string, unknown>).lines)
    );
}

export function isLiveLineWrittenMessage(msg: unknown): msg is LiveLineWrittenMessage {
    return (
        typeof msg === 'object' &&
        msg !== null &&
        (msg as Record<string, unknown>).type === 'liveLineWritten' &&
        typeof (msg as Record<string, unknown>).line === 'number'
    );
}

export function isLiveEditorHostMessage(msg: unknown): msg is LiveEditorHostMessage {
    return isLiveDocumentMessage(msg) || isLiveLineWrittenMessage(msg);
}
