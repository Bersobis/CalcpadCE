/**
 * The gate for HTML the rich-text editor is allowed to open.
 *
 * The editor renders a `#markdown` block as HTML and later converts it back. If
 * the block holds anything the converter cannot spell, committing would silently
 * drop it — so the block is checked *before* it is opened and declined if it
 * holds anything unmodelled, exactly as the math editor declines a line its
 * bridge cannot round-trip.
 *
 * This doubles as the security check. The modelled set contains no `script`,
 * `style`, `iframe` or `form`, and no event-handler attribute is allowed, so a
 * fragment that passes has nothing dangerous to strip — validating *is*
 * sanitizing. The desktop CSP allows inline scripts, which makes that
 * equivalence the thing worth relying on rather than a separate filter.
 */

import { ALLOWED_ATTRIBUTES, MARKDOWN_BLOCK_TAGS, MARKDOWN_INLINE_TAGS } from './html-to-markdown';
import { parseFragment } from './fragment';

export interface MarkupCheck {
    ok: boolean;
    /** Set when `ok` is false: what stopped the check. */
    reason?: string;
}

/** Schemes a link or image source may use. Anything else is refused. */
const SAFE_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'file:', 'data:', '']);

/**
 * The `class` values the engine itself writes, and what they mean.
 *
 * Markdig tags a task list and a fenced code block's language with a class, so
 * refusing `class` outright would decline output the engine produces. Only these
 * exact values are accepted: any other class carries meaning Markdown cannot
 * spell, and dropping it silently would be a quiet edit.
 */
const ENGINE_CLASSES: Readonly<Record<string, readonly (string | RegExp)[]>> = {
    ul: ['contains-task-list'],
    li: ['task-list-item'],
    code: [/^language-[\w+#-]+$/],
};

function isEngineClass(tag: string, value: string): boolean {
    const allowed = ENGINE_CLASSES[tag] ?? [];
    const names = value.trim().split(/\s+/);
    return names.length > 0 && names.every(name =>
        allowed.some(entry => (typeof entry === 'string' ? entry === name : entry.test(name))));
}

function isSafeUrl(value: string): boolean {
    const trimmed = value.trim();
    // A relative path or an in-page anchor has no scheme.
    if (/^[#/?]/.test(trimmed) || !/^[a-zA-Z][\w+.-]*:/.test(trimmed)) return true;
    const scheme = trimmed.slice(0, trimmed.indexOf(':') + 1).toLowerCase();
    return SAFE_SCHEMES.has(scheme);
}

/** Check one element, returning the reason it is refused. */
function checkElement(element: Element): string | null {
    const tag = element.tagName.toLowerCase();
    const modelled = MARKDOWN_BLOCK_TAGS.has(tag) || MARKDOWN_INLINE_TAGS.has(tag);
    if (!modelled) return `the <${tag}> element`;

    const allowed = ALLOWED_ATTRIBUTES[tag] ?? [];
    for (const attribute of Array.from(element.attributes)) {
        const name = attribute.name.toLowerCase();
        if (name === 'class' && isEngineClass(tag, attribute.value)) continue;
        // `class` and `style` otherwise carry no Markdown meaning, so they are
        // refused rather than dropped: silently losing them would be a quiet edit.
        if (!allowed.includes(name)) return `the "${name}" attribute on <${tag}>`;
        if ((name === 'href' || name === 'src') && !isSafeUrl(attribute.value)) {
            return `the "${attribute.value}" URL`;
        }
    }

    // A task-list checkbox is the only `input` Markdown can express.
    if (tag === 'input' && element.getAttribute('type') !== 'checkbox') {
        return 'the <input> element';
    }
    return null;
}

function walk(node: Node): string | null {
    for (const child of Array.from(node.childNodes)) {
        if (child.nodeType === 1 /* ELEMENT_NODE */) {
            const problem = checkElement(child as Element);
            if (problem !== null) return problem;
            const nested = walk(child);
            if (nested !== null) return nested;
        } else if (child.nodeType !== 3 /* TEXT_NODE */) {
            return 'a comment or processing instruction';
        }
    }
    return null;
}

/**
 * Whether a fragment is entirely within the Markdown subset. A fragment that
 * passes can be opened for graphical editing; one that does not falls back to
 * the source editor.
 */
export function checkMarkupHtml(html: string): MarkupCheck {
    const fragment = parseFragment(html);
    if (!fragment) return { ok: false, reason: 'no DOM available' };
    const problem = walk(fragment);
    return problem === null ? { ok: true } : { ok: false, reason: problem };
}
