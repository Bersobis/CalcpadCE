// Calcpad tokenizer.
//
// The rules are taken from `Calcpad.Core/Validator.cs` and `MathParser.Input.cs`:
// `,` and `_` are *name* characters, `;` separates arguments, `|` is a row divisor inside
// square brackets and a unit target everywhere else, and `!` is a postfix operator.

import { SHORTCUTS, isDigitChar, isNameChar, isNameStart, isOperator } from './grammar';

export type TokenType =
    | 'number' | 'name' | 'operator' | 'postfix'
    | 'lparen' | 'rparen' | 'lbracket' | 'rbracket'
    | 'semicolon' | 'rowdivisor' | 'unit' | 'string' | 'solver' | 'error';

export interface Token {
    readonly type: TokenType;
    readonly text: string;
    readonly pos: number;
    /** For `string`, whether the closing quote was present. */
    readonly closed?: boolean;
}

export interface TokenizeResult {
    readonly tokens: readonly Token[];
    readonly ok: boolean;
    readonly error?: { message: string; pos: number };
}

export function tokenize(source: string): TokenizeResult {
    const tokens: Token[] = [];
    let i = 0;
    let bracketDepth = 0;
    const n = source.length;

    const fail = (message: string, pos: number): TokenizeResult => ({
        tokens,
        ok: false,
        error: { message, pos },
    });

    while (i < n) {
        const ch = source[i];

        if (ch === ' ' || ch === '\t') {
            i++;
            continue;
        }

        // String literal / label — `'text'` or "text".
        if (ch === "'" || ch === '"') {
            const start = i;
            const quote = ch;
            i++;
            while (i < n && source[i] !== quote) i++;
            const closed = i < n;
            if (closed) i++;
            tokens.push({ type: 'string', text: source.slice(start, i), pos: start, closed });
            continue;
        }

        // Solver / drawing call — kept opaque so a line that carries one is never rewritten.
        if (ch === '$') {
            const start = i;
            let depth = 0;
            while (i < n) {
                const c = source[i];
                if (c === '{') depth++;
                else if (c === '}') {
                    depth--;
                    if (depth === 0) { i++; break; }
                }
                i++;
            }
            tokens.push({ type: 'solver', text: source.slice(start, i), pos: start });
            continue;
        }

        if (ch === '#') {
            // A directive reached the expression tokenizer: the line is not an expression.
            return fail('directive', i);
        }

        // Inside square brackets `|` is always the row divisor, and `||` must not be folded
        // into the logical-or shortcut there.
        if (ch === '|' && bracketDepth > 0) {
            tokens.push({ type: 'rowdivisor', text: ch, pos: i++ });
            continue;
        }

        // Shortcuts are matched before names and numbers: `%%` starts with a name character,
        // so scanning the name first would swallow the modulo operator.
        const shortcut = matchShortcut(source, i);
        if (shortcut) {
            tokens.push({ type: 'operator', text: shortcut[1], pos: i });
            i += shortcut[0].length;
            continue;
        }

        if (isDigitChar(ch) || (ch === '.' && isDigitChar(source[i + 1] ?? ''))) {
            const start = i;
            while (i < n && (isDigitChar(source[i]) || source[i] === '.')) i++;
            tokens.push({ type: 'number', text: source.slice(start, i), pos: start });
            continue;
        }

        if (isNameStart(ch)) {
            const start = i;
            i++;
            while (i < n && isNameChar(source[i])) i++;
            // A `$` suffix marks an SVG drawing function (`line$(…)`, `circle$(…)`). Its
            // arguments are coordinates and style objects, not expressions, so the whole call
            // is kept opaque and the line is never offered as a math field.
            if (source[i] === '$') {
                i++;
                if (source[i] === '(') {
                    let depth = 0;
                    while (i < n) {
                        const c = source[i];
                        if (c === '(') depth++;
                        else if (c === ')') { depth--; if (depth === 0) { i++; break; } }
                        i++;
                    }
                }
                tokens.push({ type: 'solver', text: source.slice(start, i), pos: start });
                continue;
            }
            tokens.push({ type: 'name', text: source.slice(start, i), pos: start });
            continue;
        }

        if (ch === '(') { tokens.push({ type: 'lparen', text: ch, pos: i++ }); continue; }
        if (ch === ')') { tokens.push({ type: 'rparen', text: ch, pos: i++ }); continue; }
        if (ch === '[') { bracketDepth++; tokens.push({ type: 'lbracket', text: ch, pos: i++ }); continue; }
        if (ch === ']') {
            if (bracketDepth > 0) bracketDepth--;
            tokens.push({ type: 'rbracket', text: ch, pos: i++ });
            continue;
        }
        if (ch === ';') { tokens.push({ type: 'semicolon', text: ch, pos: i++ }); continue; }
        if (ch === '|') { tokens.push({ type: 'unit', text: ch, pos: i++ }); continue; }
        if (ch === '!') { tokens.push({ type: 'postfix', text: ch, pos: i++ }); continue; }

        if (isOperator(ch)) {
            tokens.push({ type: 'operator', text: ch, pos: i++ });
            continue;
        }

        return fail(`Unexpected character "${ch}"`, i);
    }

    return { tokens, ok: true };
}

function matchShortcut(source: string, index: number): readonly [string, string] | null {
    for (const entry of SHORTCUTS) {
        if (source.startsWith(entry[0], index)) return entry;
    }
    return null;
}
