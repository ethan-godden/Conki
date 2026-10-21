/* Text-level helpers for code. */
import { CONFIG } from "./config.js";

/* What "the same code" means when comparing: line endings, non-breaking
 * spaces, tabs, trailing spaces and blank lines at either end are ignored. */
export function normalizeCode(s) {
  s = String(s).replace(/\r\n?/g, "\n").replace(/[\u200B\uFEFF]/g, "")
    .replace(/\u00A0/g, " ").replace(/\t/g, CONFIG.indent);
  if (s.normalize) s = s.normalize("NFC");
  return s.split("\n").map((line) => line.replace(/\s+$/, ""))
    .join("\n").replace(/^\n+|\n+$/g, "");
}

/* Removes the indentation shared by every non-blank line. */
export function dedent(s) {
  const lines = s.split("\n");
  let min = Infinity;
  for (const line of lines) {
    if (line.trim()) min = Math.min(min, /^ */.exec(line)[0].length);
  }
  if (!isFinite(min)) min = 0;
  return { indent: min, text: lines.map((line) => line.slice(min)).join("\n") };
}
