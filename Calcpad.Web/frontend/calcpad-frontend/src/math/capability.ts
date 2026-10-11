// Runtime capability probe.
//
// The whole rendering approach rests on the host having a MathML engine. That is true in
// Chromium 109+, Firefox and Safari 16.4+, but *not* on every target: macOS 11 ships Safari 14
// and older WebKitGTK lacks MathML Core, and the desktop shell pins `minimumSystemVersion`
// to 11.0. So the capability is *measured* — typeset a fraction and check that the numerator
// actually stacks above the denominator — never inferred from a user-agent string.

import { MATHML_NS } from './serialize';

let cached: boolean | null = null;

export function supportsMathMlCore(doc?: Document): boolean {
    if (cached === true) return true;
    // `doc` is not defaulted to `document` in the signature: that would throw
    // `ReferenceError: document is not defined` in Node before the guard could run.
    const target = doc ?? (typeof document === 'undefined' ? null : document);
    if (!target) return false;

    const supported = probe(target);
    // Only a positive result is cached. A probe that ran before `body` existed must not disable
    // the graphical view for the rest of the session.
    if (supported) cached = true;
    return supported;
}

/** Reset the memo — used by tests that install a fake document. */
export function resetCapabilityCache(): void {
    cached = null;
}

function probe(doc: Document): boolean {
    if (typeof doc === 'undefined' || !doc.body) return false;

    const host = doc.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;';
    host.innerHTML = `<math xmlns="${MATHML_NS}"><mfrac><mi>x</mi><mi>y</mi></mfrac></math>`;
    doc.body.appendChild(host);

    try {
        const fraction = host.querySelector('mfrac');
        if (!fraction || fraction.children.length < 2) return false;
        const numerator = fraction.children[0].getBoundingClientRect();
        const denominator = fraction.children[1].getBoundingClientRect();
        if (numerator.height === 0 || denominator.height === 0) return false;
        // A stacked fraction puts the numerator strictly above the denominator.
        return numerator.bottom <= denominator.top + 1;
    } catch {
        return false;
    } finally {
        host.remove();
    }
}
