/* Which part of a code block is typed, and how it is presented. */
import { dedent, normalizeCode } from "./code.js";
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

/* Turn a raw range into the typeable region of a block.
 *   all    : the whole block is typed            -> a text box replaces it
 *   lines  : whole lines inside the block        -> multi-line gap
 *   inline : part of one line                    -> single-line gap
 * A part that spans several lines is widened to whole lines. For "lines" the
 * shared indentation is not typed: the gap is shifted right instead.
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

  if (!wholeLines && !multiLine) {
    return { kind: "inline", start, end, cut: end, indent: 0,
             expected: normalizeCode(code.slice(start, end)) };
  }
  if (!/\S/.test(code.slice(0, lineStart)) && !/\S/.test(code.slice(lineEnd))) {
    return { kind: "all", start: 0, end: code.length, cut: code.length, indent: 0,
             expected: normalizeCode(code) };
  }
  const d = dedent(normalizeCode(code.slice(lineStart, lineEnd)));
  return { kind: "lines", start: lineStart, end: lineEnd,
           cut: lineEnd + (code.charAt(lineEnd) === "\n" ? 1 : 0),
           indent: d.indent, expected: d.text };
}

/* A block flagged `type`: one text box for the whole block. With nothing
 * underlined the box starts empty. With parts underlined, only those parts
 * are left out: the rest is put in the box as starter code, which can be
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
    region.starter = starter;
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
