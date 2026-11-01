/* Which part of a code block is typed, and what the editor starts with.
 *
 * The typed part of a block is described by a region:
 *   kind      "all": the whole block is typed, in an editor that is all editable
 *             "lines": whole lines inside the block, a gap in read-only code
 *             "inline": part of one line, a gap in read-only code
 *   expected  the whole block as it should end up, normalised for comparing
 *   doc       what the editor starts with: the block less the typed part, or
 *             (kind "all") nothing, or the starter code
 *   caret     where the cursor starts in doc; for a gap, also where it is
 *   gap       [start, end) of the block's code that is typed (whole lines for
 *             kind "lines", indentation included)
 *   holes     only with starter code: the parts of the block left out of doc
 */
import { normalizeCode } from "./code.js";
import { fieldText } from "./field-text.js";

/* The runs of "1" in a mask, as [start, end) pairs. */
export function maskRuns(mask) {
  const runs = [];
  const run = /1+/g;
  let match;
  while ((match = run.exec(mask))) runs.push([match.index, match.index + match[0].length]);
  return runs;
}

/* [start, end) of `code`, with end capped at the code's length, less any
 * whitespace at either end; null if nothing else is in it. */
function trimmed(code, start, end) {
  end = Math.min(end, code.length);
  while (start < end && /\s/.test(code.charAt(start))) start++;
  while (end > start && /\s/.test(code.charAt(end - 1))) end--;
  return start < end ? [start, end] : null;
}

/* The leading whitespace that every non-blank line of `text` starts with. */
function sharedIndent(text) {
  const indents = text.split("\n").filter((line) => line.trim()).map((line) => /^[ \t]*/.exec(line)[0]);
  return indents.reduce((shared, indent) => {
    let i = 0;
    while (i < shared.length && shared.charAt(i) === indent.charAt(i)) i++;
    return shared.slice(0, i);
  }, indents[0] || "");
}

/* The part [start, end) is typed, from `at` on: what comes before `at` stays in
 * the code. For the whole block, [0, code.length), the editor starts empty. */
function gapRegion(kind, code, start, end, at = start) {
  return { kind, expected: normalizeCode(code), doc: code.slice(0, at) + code.slice(end), caret: at, gap: [start, end] };
}

/* Turn a raw range of `code` into the typed part of the block.
 * A part of one line is typed in place. A part that spans several lines is
 * widened to whole lines; the indentation they share is left in the code, so
 * the editor starts where the first line's text would. If that leaves nothing
 * else in the block, the whole block is typed.
 * Returns null when the range holds nothing but whitespace. */
export function makeRegion(code, from, to) {
  const range = trimmed(code, from, to);
  if (!range) return null;
  const [start, end] = range;
  const lineStart = code.lastIndexOf("\n", start - 1) + 1;
  let lineEnd = code.indexOf("\n", end);
  if (lineEnd < 0) lineEnd = code.length;
  const wholeLines = !/\S/.test(code.slice(lineStart, start)) && !/\S/.test(code.slice(end, lineEnd));
  const multiLine = code.slice(start, end).indexOf("\n") >= 0;

  if (!wholeLines && !multiLine) return gapRegion("inline", code, start, end);
  if (!/\S/.test(code.slice(0, lineStart)) && !/\S/.test(code.slice(lineEnd))) return gapRegion("all", code, 0, code.length);
  return gapRegion("lines", code, lineStart, lineEnd, lineStart + sharedIndent(code.slice(lineStart, lineEnd)).length);
}

/* A block flagged `type`: one editor for the whole block. With nothing
 * underlined it starts empty. With parts underlined, only those parts are
 * left out: the rest is put in the editor as starter code, which can be
 * edited like anything else typed there. */
export function typedBlock(code, runs) {
  const region = makeRegion(code, 0, code.length);
  if (!region) return null;
  const holes = runs.map(([start, end]) => trimmed(code, start, end)).filter(Boolean);
  // cut from the last hole to the first, so the offsets of the others stay right
  const starter = holes.reduceRight((rest, [start, end]) => rest.slice(0, start) + rest.slice(end), code);
  if (holes.length && /\S/.test(starter)) {
    region.doc = starter;
    region.caret = holes[0][0];
    region.holes = holes;
  }
  return region;
}

/* The Answer field: its whole content is one typed block, shown under the
 * prompt. Underlining works as in a `type` block: underlined parts are left
 * to type and the rest is starter code; with nothing underlined, everything
 * is typed. `region` is null when the field has no code in it. */
export function answerField(el) {
  const src = fieldText(el, { marks: true });
  const start = /^\n*/.exec(src.text)[0].length;
  const end = Math.max(start, src.text.replace(/\s+$/, "").length);
  const code = src.text.slice(start, end);
  return { code, lang: "", region: typedBlock(code, maskRuns(src.mask.slice(start, end))) };
}
