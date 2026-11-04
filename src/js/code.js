/* What "the same code" means when comparing: line endings, non-breaking
 * spaces, tabs, trailing spaces and blank lines at either end are ignored. */
import {CONFIG} from "./config.js";

export function normalizeCode(s) {
    s = String(s)
        .replace(/\r\n?/g, "\n")
        .replace(/[\u200B\uFEFF]/g, "")
        .replace(/\u00A0/g, " ")
        .replace(/\t/g, CONFIG.indent);
    if (s.normalize) s = s.normalize("NFC");
    return s.split("\n")
        .map((line) => line.replace(/\s+$/, ""))
        .join("\n")
        .replace(/^\n+|\n+$/g, "");
}
