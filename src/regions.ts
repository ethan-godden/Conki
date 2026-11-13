/* Which part of a code block is typed, and what the editor starts with. */
import {normalizeCode} from "./code.ts";
import {fieldText} from "./field-text.ts";

/* [start, end) offsets into a block's code. */
export type Span = [start: number, end: number];

/* The typed part of a block. */
export interface Region {
    /* "all": the whole block is typed, in an editor that is all editable;
     * "lines": whole lines inside the block, a gap in read-only code;
     * "inline": part of one line, a gap in read-only code */
    kind: "all" | "lines" | "inline";
    /* the whole block as it should end up, normalised for comparing */
    expected: string;
    /* what the editor starts with: the block less the typed part, or (kind
     * "all") nothing, or the starter code */
    doc: string;
    /* where the cursor starts in doc; for a gap, also where it is */
    caret: number;
    /* the block's code that is typed (whole lines for kind "lines", indentation included) */
    gap: Span;
    /* only with starter code: the parts of the block left out of doc */
    holes?: Span[];
}

/* A code block; region is set if (part of) it is typed. */
export interface CodeBlock {
    code: string;
    lang: string;
    region: Region | null;
}

/* The runs of "1" in a mask. */
export function maskRuns(mask: string): Span[] {
    return [...mask.matchAll(/1+/g)].map((m) => [m.index, m.index + m[0].length]);
}

/* True if `s` is empty or holds only whitespace. */
const isBlank = (s: string) => s.trim() === "";

/* [start, end) of `code`, with end capped at the code's length, less any
 * whitespace at either end; null if nothing else is in it. */
function trimmed(code: string, start: number, end: number): Span | null {
    const part = code.slice(start, end);
    const body = part.trim();
    if (!body) return null;
    start += part.indexOf(body);   // where the leading whitespace ends
    return [start, start + body.length];
}

/* The leading whitespace that every non-blank line of `text` starts with. */
function sharedIndent(text: string): string {
    const indents = text.split("\n").filter((line) => !isBlank(line)).map((line) => /^[ \t]*/.exec(line)![0]);
    return indents.reduce((shared, indent) => {
        let i = 0;
        while (i < shared.length && shared[i] === indent[i]) i++;
        return shared.slice(0, i);
    }, indents[0] ?? "");
}

/* The part [start, end) is typed, from `at` on: what comes before `at` stays in
 * the code. For the whole block, [0, code.length), the editor starts empty. */
function gapRegion(kind: Region["kind"], code: string, start: number, end: number, at = start): Region {
    return {
        kind,
        expected: normalizeCode(code),
        doc: code.slice(0, at) + code.slice(end),
        caret: at,
        gap: [start, end]
    };
}

/* Turn a raw range of `code` into the typed part of the block.
 * A part of one line is typed in place. A part that spans several lines is
 * widened to whole lines; the indentation they share is left in the code, so
 * the editor starts where the first line's text would. If that leaves nothing
 * else in the block, the whole block is typed.
 * Returns null when the range holds nothing but whitespace. */
export function makeRegion(code: string, from: number, to: number): Region | null {
    const range = trimmed(code, from, to);
    if (!range) return null;
    const [start, end] = range;
    const lineStart = code.lastIndexOf("\n", start - 1) + 1;
    let lineEnd = code.indexOf("\n", end);
    if (lineEnd < 0) lineEnd = code.length;
    const wholeLines = isBlank(code.slice(lineStart, start)) && isBlank(code.slice(end, lineEnd));
    const multiLine = code.slice(start, end).includes("\n");

    if (!wholeLines && !multiLine) return gapRegion("inline", code, start, end);
    if (isBlank(code.slice(0, lineStart)) && isBlank(code.slice(lineEnd))) return gapRegion("all", code, 0, code.length);
    return gapRegion("lines", code, lineStart, lineEnd, lineStart + sharedIndent(code.slice(lineStart, lineEnd)).length);
}

/* A block flagged `type`: one editor for the whole block. With nothing
 * underlined it starts empty. With parts underlined, only those parts are
 * left out: the rest is put in the editor as starter code, which can be
 * edited like anything else typed there. */
export function typedBlock(code: string, runs: Span[]): Region | null {
    const region = makeRegion(code, 0, code.length);
    if (!region) return null;
    const holes = runs.map(([start, end]) => trimmed(code, start, end)).filter((hole) => hole !== null);
    // cut from the last hole to the first, so the offsets of the others stay right
    const starter = holes.reduceRight((rest, [start, end]) => rest.slice(0, start) + rest.slice(end), code);
    if (holes.length && !isBlank(starter)) Object.assign(region, {doc: starter, caret: holes[0][0], holes});
    return region;
}

/* The Answer field: its whole content is one typed block, shown under the
 * prompt. Underlining works as in a `type` block: underlined parts are left
 * to type and the rest is starter code; with nothing underlined, everything
 * is typed. `region` is null when the field has no code in it. */
export function answerField(el: Element): CodeBlock {
    const {text, mask} = fieldText(el, {marks: true});
    const start = /^\n*/.exec(text)![0].length;
    const end = Math.max(start, text.trimEnd().length);
    const code = text.slice(start, end);
    return {code, lang: "", region: typedBlock(code, maskRuns(mask.slice(start, end)))};
}
