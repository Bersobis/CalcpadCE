/**
 * A narrow HTML sanitizer for Calcpad render output.
 *
 * The live editor shows a line's rendered form beside its number, and Calcpad's output
 * is only as trustworthy as the document: a comment can carry arbitrary HTML, and the
 * preview iframe is sandboxed without `allow-same-origin` for exactly that reason. The
 * sidebar has no such sandbox — it shares the window with the message bridge and the
 * API client — so render HTML is stripped to the elements and attributes that layout
 * needs before it is injected. Pure string work, so the extension host can run it too.
 */

/** Elements the sanitizer keeps. Anything else is unwrapped: its children stay. */
const ALLOWED_TAGS = new Set([
    // Structure and text
    'p', 'div', 'span', 'br', 'hr', 'pre', 'blockquote', 'code', 'wbr', 'small', 'big',
    'b', 'i', 'u', 's', 'em', 'strong', 'sub', 'sup', 'var', 'kbd', 'samp', 'q', 'cite',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'figure',
    'figcaption', 'address', 'article', 'section', 'main', 'header', 'footer', 'aside', 'nav',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption', 'colgroup', 'col',
    // Links and images
    'a', 'img',
    // MathML
    'math', 'mrow', 'mi', 'mn', 'mo', 'ms', 'mtext', 'mspace', 'mpadded', 'mphantom',
    'mfrac', 'msqrt', 'mroot', 'mstyle', 'merror', 'menclose', 'mfenced', 'maction',
    'msup', 'msub', 'msubsup', 'munder', 'mover', 'munderover', 'mmultiscripts', 'mprescripts',
    'semantics', 'annotation', 'annotation-xml',
    // SVG, for plots
    'svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text',
    'tspan', 'defs', 'clippath', 'use', 'lineargradient', 'radialgradient', 'stop',
]);

/** Elements dropped with everything inside them. */
const DROP_WITH_CONTENT = new Set([
    'script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'form',
    'input', 'button', 'select', 'option', 'optgroup', 'textarea', 'label', 'fieldset',
    'template', 'noscript', 'title', 'meta', 'link', 'base', 'audio', 'video', 'source',
    'track', 'canvas', 'map', 'area', 'dialog', 'slot', 'portal',
]);

/** Attributes kept. Everything else — every `on*`, every `style`, every `srcdoc` — goes. */
const ALLOWED_ATTRS = new Set([
    'class', 'id', 'title', 'colspan', 'rowspan', 'charset', 'encoding', 'definitionurl',
    'xmlns', 'version', 'viewbox', 'width', 'height', 'x', 'y', 'x1', 'y1', 'x2', 'y2',
    'cx', 'cy', 'r', 'rx', 'ry', 'dx', 'dy', 'd', 'points', 'transform', 'fill', 'stroke',
    'fill-opacity', 'stroke-opacity', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
    'stroke-dasharray', 'opacity', 'text-anchor', 'dominant-baseline', 'font-size',
    'font-family', 'font-style', 'font-weight', 'letter-spacing', 'clip-path',
    'preserveaspectratio', 'offset', 'stop-color', 'stop-opacity', 'gradientunits',
    'gradienttransform', 'spreadmethod', 'marker-end', 'marker-start', 'display',
    'href', 'src', 'alt',
]);

/** Attributes whose value is a URL, so it can be checked for a scheme. */
const URL_ATTRS = new Set(['href', 'src', 'xlink:href']);

const SAFE_URL = /^(?:https:|mailto:|tel:|data:image\/(?:png|jpe?g|gif|webp|bmp);|#)/i;

/**
 * Strips everything from `html` that could execute or restructure the page, keeping the
 * layout-bearing markup. Text and entities pass through untouched.
 */
export function sanitizeRenderedHtml(html: string): string {
    let out = '';
    let i = 0;

    while (i < html.length) {
        const lt = html.indexOf('<', i);
        if (lt < 0) {
            out += html.slice(i);
            break;
        }
        out += html.slice(i, lt);

        const after = html[lt + 1];
        if (after === undefined) {
            out += html.slice(lt);
            break;
        }
        // Comments and processing instructions are dropped whole.
        if (after === '!' || after === '?') {
            const end = html.indexOf('>', lt);
            i = end < 0 ? html.length : end + 1;
            continue;
        }
        if (after === '/') {
            const end = html.indexOf('>', lt);
            if (end < 0) {
                out += html.slice(lt);
                break;
            }
            const name = html.slice(lt + 2, end).trim().toLowerCase();
            if (ALLOWED_TAGS.has(name)) out += `</${name}>`;
            i = end + 1;
            continue;
        }
        if (!/[a-zA-Z]/.test(after)) {
            // A stray '<' in text. Emit it and move on rather than swallowing the rest.
            out += '<';
            i = lt + 1;
            continue;
        }

        // Opening tag: find its '>' without stepping into a quoted attribute value.
        let j = lt + 1;
        let quote = '';
        while (j < html.length) {
            const c = html[j];
            if (quote) {
                if (c === quote) quote = '';
            } else if (c === '"' || c === "'") {
                quote = c;
            } else if (c === '>') {
                break;
            }
            ++j;
        }
        if (j >= html.length) {
            out += html.slice(lt);
            break;
        }
        const tagEnd = j;
        const nameMatch = /^([a-zA-Z][a-zA-Z0-9:-]*)/.exec(html.slice(lt + 1));
        const name = nameMatch ? nameMatch[1].toLowerCase() : '';
        const selfClosing = html[tagEnd - 1] === '/';

        if (name === '') {
            out += html.slice(lt, tagEnd + 1);
            i = tagEnd + 1;
            continue;
        }

        if (DROP_WITH_CONTENT.has(name)) {
            // Skip to the matching close tag so its contents go too.
            i = skipElement(html, name, tagEnd + 1);
            continue;
        }

        if (ALLOWED_TAGS.has(name)) {
            out += sanitizeOpenTag(html.slice(lt, tagEnd + 1), name, selfClosing);
        }
        // A disallowed element that is not dropped outright is unwrapped, keeping its
        // children: dropping the tag alone is what makes `<font>` or `<marquee>` inert
        // without losing the text inside.
        i = tagEnd + 1;
    }

    return out;
}

/** Index just past the element's close tag, falling back to just past the opening tag. */
function skipElement(html: string, name: string, from: number): number {
    const openRe = new RegExp(`<${name}(?=[\\s/>])`, 'gi');
    const closeRe = new RegExp(`</${name}\\s*>`, 'gi');
    openRe.lastIndex = from;
    closeRe.lastIndex = from;
    let depth = 1;
    for (;;) {
        const nextOpen = openRe.exec(html);
        const nextClose = closeRe.exec(html);
        if (nextClose == null) return from;
        if (nextOpen != null && nextOpen.index < nextClose.index) {
            ++depth;
            continue;
        }
        if (--depth === 0) return nextClose.index + nextClose[0].length;
    }
}

/** Rebuilds an opening tag from its allowed attributes only. */
function sanitizeOpenTag(tag: string, name: string, selfClosing: boolean): string {
    const body = tag.slice(tag.indexOf(name) + name.length, selfClosing ? tag.length - 2 : tag.length - 1);
    let out = `<${name}`;
    const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'`=<>]+))?/g;
    let match: RegExpExecArray | null;
    while ((match = attrRe.exec(body)) != null) {
        const key = match[1].toLowerCase();
        if (!ALLOWED_ATTRS.has(key)) continue;
        let value = match[2] ?? '';
        const quoted = value.startsWith('"') || value.startsWith("'");
        if (quoted) value = value.slice(1, -1);
        if (/[<>]/.test(value)) continue;
        if (URL_ATTRS.has(key) && !SAFE_URL.test(value.trim())) continue;
        const encoded = value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
        out += ` ${key}="${encoded}"`;
    }
    return selfClosing ? `${out}/>` : `${out}>`;
}
