/* What "the same code" means when comparing: line endings, non-breaking
 * spaces, tabs, trailing spaces and blank lines at either end are ignored. */
import {CONFIG} from "./config.ts";

const INVISIBLE: Record<string, string> = {"\r\n": "\n", "\r": "\n", "\u00A0": " ", "\u200B": "", "\uFEFF": ""};

/* Differences no one can see: line endings become "\n", non-breaking spaces
 * become spaces and zero-width characters are dropped. Used on field text as
 * it is read (field-text.ts), and on code before it is compared. */
export function cleanText(s: string): string {
    return s.replace(/\r\n?|[\u00A0\u200B\uFEFF]/g, (ch) => INVISIBLE[ch]);
}

export function normalizeCode(s: string): string {
    return cleanText(s)
        .replace(/\t/g, CONFIG.indent)
        .normalize("NFC")
        .replace(/[^\S\n]+(?=\n|$)/g, "")   // whitespace at the end of each line
        .replace(/^\n+|\n+$/g, "");          // blank lines at either end
}

// A quoted string (to the end of the line if it is not closed), or a run of spacing.
const QUOTED_OR_SPACING = /(["'`])(?:\\[\s\S]|(?!\1)[^\\])*\1?|\s+/g;
const WORD = /[\p{L}\p{N}_$]/u;
// Characters that make a longer operator when written together, so spacing
// between them counts: `a - -b` is not `a--b`, but `x = -1` is `x =-1`.
const JOINS = new Set("== != <= >= => -> <- ++ -- += -= *= /= %= &= |= ^= := && || << >> ** // /* */ :: .. ?. ?? =~ !~ <> |>".split(" "));

/* `code` (normalised) with the spacing inside each line squeezed out where it
 * cannot change what the code means, so that `x=1` and `x = 1` compare equal.
 * Indentation and quoted strings are kept as they are, and spacing between two
 * words (`int x`) or two characters in JOINS (`a - -b`) becomes one space. */
export function squeezeSpacing(code: string): string {
    return code.split("\n").map((line) => {
        const rest = line.trimStart();
        const indent = line.slice(0, line.length - rest.length);
        return indent + rest.replace(QUOTED_OR_SPACING, (match: string, quote: string | undefined, at: number) => {
            if (quote) return match;
            const before = rest.charAt(at - 1);
            const after = rest.charAt(at + match.length);
            const joins = (WORD.test(before) && WORD.test(after)) || JOINS.has(before + after);
            return joins ? " " : "";
        });
    }).join("\n");
}
