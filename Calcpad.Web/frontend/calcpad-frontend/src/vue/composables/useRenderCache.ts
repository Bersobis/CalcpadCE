/**
 * Memoised rendering caches for the live editor.
 *
 * Sanitising rendered HTML and building slot maps are both expensive enough
 * that repeating them on every list update is wasteful. These caches are sized
 * so they stay fast without growing without bound.
 */

import { ref, computed } from 'vue'
import type { SlotMap } from '../services/math-slots'
import { annotateSlots } from '../services/math-slots'
import { sanitizeRenderedHtml } from '../../services/html-sanitize'

const MAX_SANITIZE_CACHE = 400
const MAX_SLOT_CACHE = 200

export interface UseRenderCacheOptions {
    /** Maximum entries in the sanitize cache before it is cleared. */
    sanitizeLimit?: number
    /** Maximum entries in the slot-map cache before it is cleared. */
    slotLimit?: number
}

/**
 * Provides memoised sanitisation and slot-map building.
 *
 * The slot map depends on both the source text and the rendered HTML, so its
 * cache key is the concatenation of the two separated by a NUL byte.
 */
export function useRenderCache(options: UseRenderCacheOptions = {}) {
    const sanitizeLimit = options.sanitizeLimit ?? MAX_SANITIZE_CACHE
    const slotLimit = options.slotLimit ?? MAX_SLOT_CACHE

    const sanitizeCache = new Map<string, string>()
    const slotCache = new Map<string, SlotMap | null>()

    /**
     * Returns sanitised HTML, using a cache keyed by the raw HTML string.
     */
    function getSanitized(rawHtml: string): string {
        const cached = sanitizeCache.get(rawHtml)
        if (cached !== undefined) return cached
        if (sanitizeCache.size >= sanitizeLimit) sanitizeCache.clear()
        const safe = sanitizeRenderedHtml(rawHtml)
        sanitizeCache.set(rawHtml, safe)
        return safe
    }

    /**
     * Returns a slot map for the given rendered HTML and source text, or null
     * when there is nothing editable. Uses a cache keyed by both strings.
     */
    function getSlotMap(renderedHtml: string, sourceText: string): SlotMap | null {
        const key = `${sourceText}\u0000${renderedHtml}`
        const cached = slotCache.get(key)
        if (cached !== undefined) return cached
        if (slotCache.size >= slotLimit) slotCache.clear()
        const map = annotateSlots(renderedHtml, sourceText)
        slotCache.set(key, map)
        return map
    }

    /** Clears both caches. Call when the document is closed or reset. */
    function clear(): void {
        sanitizeCache.clear()
        slotCache.clear()
    }

    return {
        getSanitized,
        getSlotMap,
        clear,
    }
}
