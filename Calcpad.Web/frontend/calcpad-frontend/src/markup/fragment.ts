/**
 * Parsing an HTML fragment without moving anything.
 *
 * `DOMParser` with `text/html` is the obvious tool and the wrong one here: it
 * builds a whole document, so a fragment that begins with `<script>` or `<style>`
 * is placed in `<head>` and disappears from `body`. A checker that looked at
 * `body` would then pass a fragment containing a script — and the desktop CSP
 * allows inline scripts, so that is not a theoretical hole.
 *
 * A `<template>` element parses its content as a fragment, leaves it exactly
 * where it was written, and never executes anything. Everything that inspects
 * author markup goes through here.
 */

/** Parse an HTML fragment, or `null` where there is no DOM (plain Node). */
export function parseFragment(html: string): DocumentFragment | null {
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') return null;
    const template = document.createElement('template');
    template.innerHTML = html;
    return template.content;
}

/** The element children of a fragment, for callers that want them directly. */
export function fragmentChildren(html: string): Element[] {
    const fragment = parseFragment(html);
    if (!fragment) return [];
    return Array.from(fragment.children);
}
