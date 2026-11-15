/* The Answer field: the code that is typed, and what the editor starts with. */
import {normalizeCode} from "./code.ts";
import {fieldText} from "./field-text.ts";

/* [start, end) offsets into the code. */
export type Span = [start: number, end: number];

export interface Answer {
    /* the code, as written in the field */
    code: string;
    /* the code as it should end up, normalised for comparing */
    expected: string;
    /* what the editor starts with: nothing, or the starter code */
    starter: string;
    /* where the cursor starts in starter */
    caret: number;
    /* the parts of code left out of starter (none without starter code) */
    holes: Span[];
}

/* [start, end) of `code`, less any whitespace at either end; null if nothing
 * else is in it. */
function trimmed(code: string, start: number, end: number): Span | null {
    const part = code.slice(start, end);
    const body = part.trim();
    if (!body) return null;
    start += part.indexOf(body);   // where the leading whitespace ends
    return [start, start + body.length];
}

/* The Answer field: its whole content is the code to type, in a box under the
 * prompt. With nothing underlined the box starts empty. With parts underlined,
 * only those parts are left out: the rest is put in the box as starter code,
 * which can be edited like anything else typed there. Null when the field has
 * no code in it. */
export function answerField(el: Element): Answer | null {
    const {text, mask} = fieldText(el, {marks: true});
    const start = /^\n*/.exec(text)![0].length;
    const end = Math.max(start, text.trimEnd().length);
    const code = text.slice(start, end);
    if (!code.trim()) return null;

    const holes = [...mask.slice(start, end).matchAll(/1+/g)]
        .map((run) => trimmed(code, run.index, run.index + run[0].length))
        .filter((hole) => hole !== null);
    // cut from the last hole to the first, so the offsets of the others stay right
    const starter = holes.reduceRight((rest, [from, to]) => rest.slice(0, from) + rest.slice(to), code);
    const expected = normalizeCode(code);
    if (!holes.length || !starter.trim()) return {code, expected, starter: "", caret: 0, holes: []};
    return {code, expected, starter, caret: holes[0][0], holes};
}
