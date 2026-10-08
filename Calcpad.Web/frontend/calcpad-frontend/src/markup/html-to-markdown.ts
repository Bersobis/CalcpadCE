import { parseFragment } from './fragment';

/**
 * HTML → Markdown for the subset the rich-text editor can produce.
 *
 * The editor renders a `#markdown` block as HTML, lets the user edit it, and has
 * to write Markdown back. That direction is lossy in general — Markdown has no
 * spelling for most of HTML — so this converter handles a known subset and
 * returns `null` for anything outside it. `null` means "do not commit", which is
 * the same rule the math editor's gate follows: decline rather than corrupt.
 *
 * The subset is deliberately the one the editor can *produce*: the toolbar only
 * offers these constructs, and the surface sanitizes on open, so a conversion
 * that fails means something reached the DOM that the editor does not model.
 *
 * Pure apart from the DOM, so it is testable under jsdom.
 */

export const MARKDOWN_BLOCK_TAGS = new Set([
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'ul', 'ol', 'li', 'blockquote', 'pre', 'hr',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
]);

/** Inline elements that have a Markdown spelling. */
export const MARKDOWN_INLINE_TAGS = new Set([
    'strong', 'b', 'em', 'i', 'del', 's', 'strike', 'ins', 'u',
    'sub', 'sup', 'code', 'a', 'img', 'br', 'input',
]);

/** Every tag the editor models, block or inline. */
export function isModelledTag(tag: string): boolean {
    const name = tag.toLowerCase();
    return MARKDOWN_BLOCK_TAGS.has(name) || MARKDOWN_INLINE_TAGS.has(name);
}

/** Attributes worth keeping per tag. Anything else is dropped by the sanitizer. */
export const ALLOWED_ATTRIBUTES: Readonly<Record<string, readonly string[]>> = {
    a: ['href', 'title'],
    img: ['src', 'alt', 'title'],
    th: ['align'],
    td: ['align'],
    input: ['type', 'checked', 'disabled'],
    ol: ['start'],
};

/** Text that Markdown would read as markup, escaped so it stays literal. */
function escapeInline(text: string): string {
    return text
        .replace(/([\\`*_[\]])/g, '\\$1')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        // Doubled `~`, `^` and `+` are the emphasis extras; a single one is literal.
        .replace(/(~~|\^\^|\+\+)/g, match => match.split('').map(ch => `\\${ch}`).join(''));
}

/** Text at the start of a block line, where a leading marker would start a block. */
function escapeBlockStart(text: string): string {
    return text.replace(/^(\s*)([#>|]|[-+*]\s|\d+\.\s)/, (_m, pad: string, marker: string) => `${pad}\\${marker}`);
}

function escapeTableCell(text: string): string {
    return text.replace(/\|/g, '\\|').replace(/\n+/g, ' ');
}

function attr(element: Element, name: string): string | null {
    const value = element.getAttribute(name);
    return value === null || value === '' ? null : value;
}

/** The Markdown for a run of nodes read as inline content. `null` on anything unmodelled. */
function inlineRun(nodes: readonly Node[]): string | null {
    let out = '';
    for (const node of nodes) {
        const piece = inlineNode(node);
        if (piece === null) return null;
        out += piece;
    }
    return out;
}

function inlineChildren(parent: Node): string | null {
    return inlineRun(Array.from(parent.childNodes));
}

/**
 * Whether a child starts a block of its own rather than joining the paragraph
 * around it. A table cell is excluded because it is handled by the table reader,
 * not as a standalone block.
 */
function isBlockLevel(node: Node): boolean {
    if (node.nodeType !== 1) return false;
    const tag = (node as Element).tagName.toLowerCase();
    return MARKDOWN_BLOCK_TAGS.has(tag) && tag !== 'td' && tag !== 'th';
}

function inlineNode(node: Node): string | null {
    if (node.nodeType === 3 /* TEXT_NODE */) return escapeInline(node.nodeValue ?? '');
    if (node.nodeType !== 1 /* ELEMENT_NODE */) return null;

    const element = node as Element;
    const tag = element.tagName.toLowerCase();
    const inner = (): string | null => inlineChildren(element);

    switch (tag) {
        case 'strong': case 'b': {
            const text = inner();
            return text === null ? null : `**${text}**`;
        }
        case 'em': case 'i': {
            const text = inner();
            return text === null ? null : `*${text}*`;
        }
        case 'del': case 's': case 'strike': {
            const text = inner();
            return text === null ? null : `~~${text}~~`;
        }
        case 'ins': case 'u': {
            const text = inner();
            return text === null ? null : `++${text}++`;
        }
        case 'sub': {
            const text = inner();
            return text === null ? null : `~${text}~`;
        }
        case 'sup': {
            const text = inner();
            return text === null ? null : `^${text}^`;
        }
        case 'code': {
            const text = element.textContent ?? '';
            // A backtick inside a code span needs a longer fence than the run it holds.
            const longest = (text.match(/`+/g) ?? []).reduce((a, b) => (b.length > a.length ? b : a), '');
            const fence = '`'.repeat(longest.length + 1);
            const pad = text.startsWith('`') || text.endsWith('`') ? ' ' : '';
            return `${fence}${pad}${text}${pad}${fence}`;
        }
        case 'a': {
            const href = attr(element, 'href');
            if (href === null) return null;
            const text = inner();
            if (text === null) return null;
            const title = attr(element, 'title');
            return `[${text}](${href}${title ? ` "${title}"` : ''})`;
        }
        case 'img': {
            const src = attr(element, 'src');
            if (src === null) return null;
            const alt = element.getAttribute('alt') ?? '';
            const title = attr(element, 'title');
            return `![${alt}](${src}${title ? ` "${title}"` : ''})`;
        }
        case 'br':
            return '\\\n';
        case 'input': {
            // Only a task-list checkbox is representable.
            if (element.getAttribute('type') !== 'checkbox') return null;
            return element.hasAttribute('checked') ? '[x] ' : '[ ] ';
        }
        default:
            // An unmodelled inline element is a decline, not something to flatten.
            return null;
    }
}

/** One line of a blockquote or list item, prefixed and continued correctly. */
function prefixLines(text: string, prefix: string, continuation: string): string {
    return text
        .replace(/\n+$/, '')
        .split('\n')
        .map((line, i) => (i === 0 ? `${prefix}${line}` : `${continuation}${line}`))
        .join('\n');
}

function listItem(element: Element, marker: string): string | null {
    const text = blockChildren(element);
    if (text === null) return null;
    const body = text.replace(/\n+$/, '');
    if (body === '') return null;
    // A checkbox is an inline prefix on the item's first line.
    const indent = ' '.repeat(marker.length);
    return prefixLines(body, `${marker}`, indent);
}

function tableToMarkdown(element: Element): string | null {
    const rows = Array.from(element.querySelectorAll('tr'));
    if (rows.length === 0) return null;

    const cells = rows.map(row => Array.from(row.children).map(cell => {
        const text = blockChildren(cell);
        return text === null ? null : escapeTableCell(text.replace(/\n+$/, '').trim());
    }));
    if (cells.some(row => row.some(cell => cell === null))) return null;

    const width = Math.max(...cells.map(row => row.length));
    if (width === 0) return null;
    const pad = (row: (string | null)[]): string[] =>
        Array.from({ length: width }, (_v, i) => row[i] ?? '');

    const [head, ...body] = cells.map(pad);
    const aligns = Array.from(element.querySelectorAll('tr'))[0]
        ? Array.from(Array.from(element.querySelectorAll('tr'))[0].children)
            .map(cell => cell.getAttribute('align'))
        : [];
    const rule = Array.from({ length: width }, (_v, i) => {
        switch (aligns[i]) {
            case 'left': return ':---';
            case 'right': return '---:';
            case 'center': return ':---:';
            default: return '---';
        }
    });

    return [
        `| ${head.join(' | ')} |`,
        `| ${rule.join(' | ')} |`,
        ...body.map(row => `| ${row.join(' | ')} |`),
    ].join('\n');
}

/**
 * The Markdown for a run of child nodes in a block context.
 *
 * Loose inline content becomes a paragraph of its own, which is what makes a
 * list item holding a task-list checkbox read as `[x] done` rather than losing
 * the checkbox to a separate inline walk.
 */
function blockChildren(parent: Node): string | null {
    const parts: string[] = [];
    let run: Node[] = [];

    const flush = (): string | null => {
        if (run.length === 0) return '';
        const text = inlineRun(run);
        run = [];
        if (text === null) return null;
        // HTML collapses runs of whitespace when it renders, so the Markdown has
        // to as well: a task-list checkbox arrives as `<input> done`, and keeping
        // both spaces would write `- [x]  done` and change the block on commit.
        const trimmed = text.replace(/\s+/g, ' ').trim();
        return trimmed === '' ? '' : escapeBlockStart(trimmed);
    };

    for (const child of Array.from(parent.childNodes)) {
        if (!isBlockLevel(child)) {
            run.push(child);
            continue;
        }
        const inline = flush();
        if (inline === null) return null;
        if (inline !== '') parts.push(inline);

        const block = blockNode(child);
        if (block === null) return null;
        if (block !== '') parts.push(block);
    }

    const tail = flush();
    if (tail === null) return null;
    if (tail !== '') parts.push(tail);
    return parts.join('\n\n');
}

function blockNode(node: Node): string | null {
    if (node.nodeType === 3 /* TEXT_NODE */) {
        const text = (node.nodeValue ?? '').replace(/\s+/g, ' ').trim();
        return text === '' ? '' : escapeBlockStart(escapeInline(text));
    }
    if (node.nodeType !== 1 /* ELEMENT_NODE */) return null;

    const element = node as Element;
    const tag = element.tagName.toLowerCase();

    switch (tag) {
        case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6': {
            const text = inlineChildren(element);
            return text === null ? null : `${'#'.repeat(Number(tag[1]))} ${text}`;
        }
        case 'p': {
            const text = inlineChildren(element);
            return text === null ? null : escapeBlockStart(text);
        }
        case 'blockquote': {
            const text = blockChildren(element);
            return text === null ? null : prefixLines(text, '> ', '> ');
        }
        case 'hr':
            return '---';
        case 'pre': {
            const code = element.querySelector('code');
            const text = (code ?? element).textContent ?? '';
            const language = (code?.className.match(/language-([\w+-]+)/) ?? [])[1] ?? '';
            // A fence longer than any run inside, so the content cannot close it early.
            const longest = (text.match(/`{3,}/g) ?? []).reduce((a, b) => (b.length > a.length ? b : a), '');
            const fence = '`'.repeat(Math.max(3, longest.length + 1));
            return `${fence}${language}\n${text.replace(/\n$/, '')}\n${fence}`;
        }
        case 'table':
            return tableToMarkdown(element);
        case 'ul': case 'ol': {
            const items: string[] = [];
            let index = Number(element.getAttribute('start') ?? '1') || 1;
            for (const child of Array.from(element.children)) {
                if (child.tagName.toLowerCase() !== 'li') return null;
                const marker = tag === 'ol' ? `${index}. ` : '- ';
                const item = listItem(child, marker);
                if (item === null) return null;
                items.push(item);
                index++;
            }
            return items.length === 0 ? null : items.join('\n');
        }
        default: {
            // A bare inline element at block level is a paragraph.
            if (MARKDOWN_INLINE_TAGS.has(tag)) {
                const text = inlineChildren(element);
                return text === null ? null : escapeBlockStart(text);
            }
            return null;
        }
    }
}

/**
 * Convert an HTML fragment to Markdown, or `null` when it holds anything the
 * subset cannot spell faithfully.
 */
export function htmlToMarkdown(html: string): string | null {
    const fragment = parseFragment(html);
    if (!fragment) return null;
    const text = blockChildren(fragment);
    if (text === null) return null;
    return text.replace(/\n{3,}/g, '\n\n').replace(/\n+$/, '') + '\n';
}
