/* What "the same code" means when comparing: line endings, non-breaking
 * spaces, tabs, trailing spaces and blank lines at either end are ignored. */
import {CONFIG} from "./config.js";

const INVISIBLE = {"\r\n": "\n", "\r": "\n", "\u00A0": " ", "\u200B": "", "\uFEFF": ""};

/* Differences no one can see: line endings become "\n", non-breaking spaces
 * become spaces and zero-width characters are dropped. Used on field text as
 * it is read (field-text.js), and on code before it is compared. */
export function cleanText(s) {
    return s.replace(/\r\n?|[\u00A0\u200B\uFEFF]/g, (ch) => INVISIBLE[ch]);
}

export function normalizeCode(s) {
    return cleanText(String(s))
        .replace(/\t/g, CONFIG.indent)
        .normalize("NFC")
        .replace(/[^\S\n]+(?=\n|$)/g, "")   // whitespace at the end of each line
        .replace(/^\n+|\n+$/g, "");          // blank lines at either end
}
