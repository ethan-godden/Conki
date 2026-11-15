/* Entry point of _code-card.min.js, which defines window.CodeCard: the Code
 * note type. Prompt and Back are ordinary Anki fields; the Answer field's
 * code is typed on the question side and graded on the answer side.
 *
 * Built on _codemirror.min.js, which has to load first: the modules of src
 * this imports other than answer.ts, and CodeMirror with them, come from
 * there (see codemirror.ts and scripts/build.ts). Only this file, answer.ts
 * and @codemirror/merge's diff are in this script. */
import {presentableDiff} from "@codemirror/merge";
import {type Answer, answerField, type Span} from "./answer.ts";
import {normalizeCode, squeezeSpacing} from "./code.ts";
import {CONFIG} from "./config.ts";
import {destroyViews, type Mark, mark, readOnlyView, returnSign, typedView} from "./editor.ts";

declare const __VERSION__: string;   // filled in by the build

declare global {
    interface Window {
        CodeCard?: typeof CodeCard;
        pycmd?: (command: string) => void;   // Anki's bridge
    }
}

const CodeCard = {render, config: CONFIG, version: __VERSION__};
window.CodeCard ??= CodeCard;

/* Question side: an editor under the prompt to type the answer in.
 * Answer side: how it went, in place of the Answer field. */
function render(root: HTMLElement) {
    destroyViews();
    const field = root.querySelector<HTMLElement>('[data-part="answer"]');
    const answer = field && answerField(field);
    if (!field || !answer) return;
    // identifies the card, so a typed answer is only used on the card it was typed on
    const key = root.querySelector('[data-part="prompt"]')!.innerHTML + "\0" + answer.code;
    if (root.dataset.side === "back") {
        field.textContent = "";
        showResult(field, answer, loadTyped(key));
    } else {
        field.remove();        // the solution does not stay in the question's page
        typedView(root, answer.starter, answer.caret, (doc) => saveTyped(key, doc), () => window.pycmd?.("ans"));
        saveTyped(key, answer.starter);
    }
}

/* A caption with a read-only block under it. */
function captioned(parent: HTMLElement, text: string, code: string, marks?: Mark[]) {
    const caption = document.createElement("div");
    caption.className = "code-label";
    caption.textContent = text;
    parent.appendChild(caption);
    readOnlyView(parent, code, "", marks);
}

/* Marks over the ranges of `text` that differ, each with its class name, with
 * a return sign on each line break among them so a wrong or missing one can be seen. */
function changeMarks(text: string, ranges: [...Span, string][]) {
    const marks: Mark[] = [];
    for (const [from, to, className] of ranges) {
        if (to <= from) continue;
        marks.push(mark(className, from, to));
        for (let i = text.indexOf("\n", from); i >= 0 && i < to; i = text.indexOf("\n", i + 1)) {
            marks.push(returnSign(className, i));
        }
    }
    return marks;
}

/* How the typed answer went, shown in `parent`.
 *   nothing typed (or starter code left unchanged) -> "Answer"
 *   typed text equals the expected text            -> "Correct"
 *   the same apart from spacing inside lines       -> "Correct, apart from spacing" + "Expected"
 *   otherwise                                      -> "You typed" + "Expected"
 * While spacing does not count (CONFIG.ignoreSpacing), a change that only
 * moves spacing about is marked as such, not as a mistake. */
function showResult(parent: HTMLElement, {code, expected, holes, ...answer}: Answer, raw: string | null) {
    const {labels} = CONFIG;
    const starter = normalizeCode(answer.starter);
    const typed = raw === null ? starter : normalizeCode(raw);

    if (typed === starter) {
        // What was left to type is tinted; for an answer typed from scratch that is all of it, so nothing is.
        captioned(parent, labels.answer, code, holes.map(([from, to]) => mark("c-answer", from, to)));
        return;
    }
    if (typed === expected) {
        captioned(parent, labels.correct, code, [mark("c-good", 0, code.length)]);
        return;
    }

    const changes = presentableDiff(typed, expected);
    const squeezed = CONFIG.ignoreSpacing ? squeezeSpacing(typed) : null;
    const correct = squeezed !== null && squeezed === squeezeSpacing(expected);
    // a change is only spacing if making it on its own leaves the squeezed text as it was
    const spacing = changes.map((c) => correct || (squeezed !== null &&
        squeezeSpacing(typed.slice(0, c.fromA) + expected.slice(c.fromB, c.toB) + typed.slice(c.toA)) === squeezed));
    captioned(parent, correct ? labels.spacing : labels.typed, typed,
        changeMarks(typed, changes.map((c, i) => [c.fromA, c.toA, spacing[i] ? "c-spacing" : "c-bad"])));
    captioned(parent, labels.expected, expected,
        changeMarks(expected, changes.map((c, i) => [c.fromB, c.toB, spacing[i] ? "c-spacing" : "c-missed"])));
}

/* What was typed on the question side, for the answer side to read back. The
 * page and this script stay between a card's two sides, so it is kept here;
 * sessionStorage is the fallback for a reviewer that reloads the page. */
let saved: string | null = null;

function saveTyped(key: string, value: string) {
    saved = JSON.stringify({k: key, v: value});
    try {
        sessionStorage.setItem(CONFIG.storageKey, saved);
    } catch { /* storage unavailable */
    }
}

function loadTyped(key: string): string | null {
    try {
        const {k, v} = JSON.parse(saved ?? sessionStorage.getItem(CONFIG.storageKey)!);
        return k === key && typeof v === "string" ? v : null;
    } catch {
        return null;   // nothing saved, or storage unavailable
    }
}
