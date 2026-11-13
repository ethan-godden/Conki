/* Entry point. The card templates load the built script and call
 * CodeCard.render(root) with the card's root element. */
import {presentableDiff} from "@codemirror/merge";
import {normalizeCode, squeezeSpacing} from "./code.ts";
import {CONFIG} from "./config.ts";
import {destroyViews, type Mark, mark, readOnlyBlocks, readOnlyView, returnSign, typedView} from "./editor.ts";
import {renderMarkdown} from "./markdown.ts";
import {answerField, type CodeBlock, type Region, type Span} from "./regions.ts";

declare const __VERSION__: string;   // filled in by the build

declare global {
    interface Window {
        CodeCard?: typeof CodeCard;
        pycmd?: (command: string) => void;   // Anki's bridge
    }
}

const CodeCard = {render, config: CONFIG, version: __VERSION__};
window.CodeCard ??= CodeCard;

function render(root: HTMLElement) {
    destroyViews();
    if (root.dataset.side === "back") renderBack(root);
    else renderFront(root);
    root.classList.remove("cc-raw");
}

const part = (root: HTMLElement, name: string) => root.querySelector<HTMLElement>(`[data-part="${name}"]`);

/* Question side: read-only blocks, plus the editor for the typed part. */
function renderFront(root: HTMLElement) {
    const {key, blocks} = renderMarkdown(part(root, "prompt")!, true);
    let typed = readOnlyBlocks(blocks);

    // Answer field: the code to type, unless the Prompt already has a typeable block.
    const answer = part(root, "answer");
    if (answer) {
        const field = answerField(answer);
        answer.remove();        // the solution does not stay in the question's page
        if (!typed && field.region) typed = {...field, holder: root};   // typed in a box under the prompt
    }

    const region = typed?.region;
    if (typed && region) typedView(typed.holder, typed.lang, region, (doc) => saveTyped(key, doc), () => window.pycmd?.("ans"));
    saveTyped(key, region?.doc ?? "");
}

/* Answer side: how the typed block went, and the rest read-only. */
function renderBack(root: HTMLElement) {
    const {key, blocks} = renderMarkdown(part(root, "prompt")!, true);
    const typed = loadTyped(key);
    const block = readOnlyBlocks(blocks);
    const result = block?.region ? showResult(block.holder, block, block.region, typed) : null;

    // Answer field: graded here, unless the Prompt already has its typeable block.
    const answer = part(root, "answer");
    if (answer) {
        const field = answerField(answer);
        answer.textContent = "";
        if (field.region && !result) showResult(answer, field, field.region, typed);
        else if (field.region) captioned(answer, CONFIG.labels.answer, field.region.expected, "");
    }

    const back = part(root, "back");
    if (back) readOnlyBlocks(renderMarkdown(back, false).blocks);

    // Anki scrolls to #answer; when the result sits inside the Prompt, point it there.
    if (result) {
        root.querySelector("#answer")?.removeAttribute("id");
        result.id = "answer";
    }
}

/* A caption with a read-only block under it. Returns the caption. */
function captioned(parent: HTMLElement, text: string, code: string, lang: string, marks?: Mark[]) {
    const caption = document.createElement("div");
    caption.className = "code-label";
    caption.textContent = text;
    parent.appendChild(caption);
    readOnlyView(parent, code, lang, marks);
    return caption;
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

/* How a typeable block went, shown in `parent`. Returns the first element.
 *   nothing typed (or starter code left unchanged) -> "Answer"
 *   typed text equals the expected text            -> "Correct"
 *   the same apart from spacing inside lines       -> "Correct, apart from spacing" + "Expected"
 *   otherwise                                      -> "You typed" + "Expected"
 * While spacing does not count (CONFIG.ignoreSpacing), a change that only
 * moves spacing about is marked as such, not as a mistake. */
function showResult(parent: HTMLElement, {code, lang}: CodeBlock, region: Region, raw: string | null) {
    const {labels} = CONFIG;
    const {expected} = region;
    const starter = normalizeCode(region.doc);
    const typed = raw === null ? starter : normalizeCode(raw);

    if (typed === starter) {
        // What was left to type is tinted; for a block typed from scratch that is all of it, so nothing is.
        const left = region.holes ?? (region.kind === "all" ? [] : [region.gap]);
        return captioned(parent, labels.answer, code, lang, left.map(([from, to]) => mark("c-answer", from, to)));
    }
    if (typed === expected) {
        return captioned(parent, labels.correct, code, lang, [mark("c-good", ...region.gap)]);
    }

    const changes = presentableDiff(typed, expected);
    const squeezed = CONFIG.ignoreSpacing ? squeezeSpacing(typed) : null;
    const correct = squeezed !== null && squeezed === squeezeSpacing(expected);
    // a change is only spacing if making it on its own leaves the squeezed text as it was
    const spacing = changes.map((c) => correct || (squeezed !== null &&
        squeezeSpacing(typed.slice(0, c.fromA) + expected.slice(c.fromB, c.toB) + typed.slice(c.toA)) === squeezed));
    const first = captioned(parent, correct ? labels.spacing : labels.typed, typed, lang,
        changeMarks(typed, changes.map((c, i) => [c.fromA, c.toA, spacing[i] ? "c-spacing" : "c-bad"])));
    captioned(parent, labels.expected, expected, lang,
        changeMarks(expected, changes.map((c, i) => [c.fromB, c.toB, spacing[i] ? "c-spacing" : "c-missed"])));
    return first;
}

/* What was typed on the question side, for the answer side to read back. The
 * page and this script stay between a card's two sides, so it is kept here;
 * sessionStorage is the fallback for a reviewer that reloads the page. */
let saved: string | null = null;

function saveTyped(key: string, value: string) {
    saved = JSON.stringify({k: key, v: value});
    try {
        sessionStorage.setItem(CONFIG.storageKey, saved);
    } catch { /* storage unavailable */ }
}

function loadTyped(key: string): string | null {
    try {
        const {k, v} = JSON.parse(saved ?? sessionStorage.getItem(CONFIG.storageKey)!);
        return k === key && typeof v === "string" ? v : null;
    } catch {
        return null;   // nothing saved, or storage unavailable
    }
}
