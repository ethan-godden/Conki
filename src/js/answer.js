/* Answer side: the typed block compared with what was expected. */
import { presentableDiff } from "@codemirror/merge";
import { normalizeCode } from "./code.js";
import { CONFIG } from "./config.js";
import { mark, readOnlyView, returnSign } from "./editor.js";
import { renderMarkdown } from "./markdown.js";
import { answerField } from "./regions.js";
import { loadTyped } from "./storage.js";

function label(parent, text) {
  const node = document.createElement("div");
  node.className = "code-label";
  node.textContent = text;
  return parent.appendChild(node);
}

/* Marks over the [from, to) ranges of `text` that differ, with a return sign
 * on each line break among them so a wrong or missing one can be seen. */
function changeMarks(text, ranges, className) {
  const marks = [];
  for (const [from, to] of ranges) {
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
 *   otherwise                                      -> "You typed" + "Expected" */
function showResult(parent, { code, lang, region }, raw) {
  const labels = CONFIG.labels;
  const typed = normalizeCode(raw == null ? region.doc : raw);
  const untouched = typed === normalizeCode(region.doc);

  if (untouched || typed === region.expected) {
    // What was left to type is tinted (for a block typed from scratch, only once it is Correct).
    const tint = untouched ? region.holes || (region.kind === "all" ? [] : [region.gap]) : [region.gap];
    const first = label(parent, untouched ? labels.answer : labels.correct);
    readOnlyView(parent, code, lang, tint.map(([from, to]) => mark(untouched ? "c-answer" : "c-good", from, to)));
    return first;
  }

  const changes = presentableDiff(typed, region.expected);
  const first = label(parent, labels.typed);
  readOnlyView(parent, typed, lang, changeMarks(typed, changes.map((c) => [c.fromA, c.toA]), "c-bad"));
  label(parent, labels.expected);
  readOnlyView(parent, region.expected, lang, changeMarks(region.expected, changes.map((c) => [c.fromB, c.toB]), "c-missed"));
  return first;
}

export function renderBack(root) {
  const rendered = renderMarkdown(root.querySelector('[data-part="prompt"]'), true);
  const typed = loadTyped(rendered.key);
  let result = null;

  for (const block of rendered.blocks) {
    if (block.region) result = showResult(block.holder, block, typed);
    else readOnlyView(block.holder, block.code, block.lang);
  }

  // Answer field: graded here, unless the Prompt already has its typeable block.
  const answer = root.querySelector('[data-part="answer"]');
  if (answer) {
    const field = answerField(answer);
    answer.textContent = "";
    if (field.region && !result) {
      showResult(answer, field, typed);
    } else if (field.region) {
      label(answer, CONFIG.labels.answer);
      readOnlyView(answer, field.region.expected, "");
    }
  }

  const back = root.querySelector('[data-part="back"]');
  if (back) {
    for (const block of renderMarkdown(back, false).blocks) readOnlyView(block.holder, block.code, block.lang);
  }

  // Anki scrolls to #answer; when the result sits inside the Prompt, point it there.
  if (result) {
    const marker = root.querySelector("#answer");
    if (marker) marker.removeAttribute("id");
    result.id = "answer";
  }
}
