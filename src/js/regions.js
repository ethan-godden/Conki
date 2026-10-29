/* Which part of a code block is typed, and what the editor starts with.
 *
 * The typed part of a block is described by a region:
 *   kind      "all": the whole block is typed
 *             "lines": whole lines inside the block
 *             "inline": part of one line
 *   expected  the whole block as it should end up, normalised for comparing
 *   doc       what the editor starts with: the block less the typed part, or
 *             (kind "all") nothing, or the starter code
 *   edit      [from, to) of doc that can be edited: the empty spot where the
 *             typed part goes, or all of doc
 *   caret     where the cursor starts in doc
 *   gap       [start, end) of the block's code that is typed (whole lines for
 *             kind "lines", indentation included)
 *   holes     only with starter code: the parts of the block left out of doc
 */
import { normalizeCode } from "./code.js";
import { fieldText } from "./field-text.js";

/* The runs of "1" in a mask, as [start, end) pairs. */
export function maskRuns(mask) {
  const runs = [];
  let open = -1;
  for (let k = 0; k <= mask.length; k++) {
    const on = k < mask.length && mask.charAt(k) === "1";
    if (on && open < 0) open = k;
    if (!on && open >= 0) {
      runs.push([open, k]);
      open = -1;
    }
  }
  return runs;
}

/* The leading whitespace that every non-blank line of `text` starts with. */
function sharedIndent(text) {
  let shared = null;
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const indent = /^[ \t]*/.exec(line)[0];
    if (shared === null) {
      shared = indent;
    } else {
      let i = 0;
      while (i < shared.length && shared.charAt(i) === indent.charAt(i)) i++;
      shared = shared.slice(0, i);
    }
  }
  return shared || "";
}

/* The whole block is typed, from an empty editor. */
export function wholeRegion(code) {
  return { kind: "all", expected: normalizeCode(code), doc: "", edit: [0, 0], caret: 0, gap: [0, code.length] };
}

/* The part [start, end) is typed, from `at` on: what comes before `at` stays in the code. */
function gapRegion(kind, code, start, end, at = start) {
  return { kind, expected: normalizeCode(code), doc: code.slice(0, at) + code.slice(end),
           edit: [at, at], caret: at, gap: [start, end] };
}

/* Turn a raw range of `code` into the typed part of the block.
 * A part of one line is typed in place. A part that spans several lines is
 * widened to whole lines; the indentation they share is left in the code, so
 * the editor starts where the first line's text would. If that leaves nothing
 * else in the block, the whole block is typed.
 * Returns null when the range holds nothing but whitespace. */
export function makeRegion(code, start, end) {
  while (start < end && /\s/.test(code.charAt(start))) start++;
  while (end > start && /\s/.test(code.charAt(end - 1))) end--;
  if (start >= end) return null;
  const lineStart = code.lastIndexOf("\n", start - 1) + 1;
  let lineEnd = code.indexOf("\n", end);
  if (lineEnd < 0) lineEnd = code.length;
  const wholeLines = !/\S/.test(code.slice(lineStart, start)) && !/\S/.test(code.slice(end, lineEnd));
  const multiLine = code.slice(start, end).indexOf("\n") >= 0;

  if (!wholeLines && !multiLine) return gapRegion("inline", code, start, end);
  if (!/\S/.test(code.slice(0, lineStart)) && !/\S/.test(code.slice(lineEnd))) return wholeRegion(code);
  return gapRegion("lines", code, lineStart, lineEnd, lineStart + sharedIndent(code.slice(lineStart, lineEnd)).length);
}

/* A block flagged `type`: one editor for the whole block. With nothing
 * underlined it starts empty. With parts underlined, only those parts are
 * left out: the rest is put in the editor as starter code, which can be
 * edited like anything else typed there. */
export function typedBlock(code, runs) {
  const region = makeRegion(code, 0, code.length);
  if (!region) return null;
  const holes = [];
  for (const run of runs) {
    let start = run[0];
    let end = Math.min(run[1], code.length);
    while (start < end && /\s/.test(code.charAt(start))) start++;
    while (end > start && /\s/.test(code.charAt(end - 1))) end--;
    if (start < end) holes.push([start, end]);
  }
  let starter = "";
  let pos = 0;
  for (const hole of holes) {
    starter += code.slice(pos, hole[0]);
    pos = hole[1];
  }
  starter += code.slice(pos);
  if (holes.length && /\S/.test(starter)) {
    region.doc = starter;
    region.edit = [0, starter.length];
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
