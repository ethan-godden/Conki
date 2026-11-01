/* Answer side: the typed block compared with what was expected. */
import { presentableDiff } from "@codemirror/merge";
import { normalizeCode } from "./code.js";
import { CONFIG } from "./config.js";
import { mark, readOnlyBlocks, readOnlyView, returnSign } from "./editor.js";
import { renderMarkdown } from "./markdown.js";
import { answerField } from "./regions.js";
import { loadTyped } from "./storage.js";

/* A caption with a read-only block under it. Returns the caption. */
function captioned(parent, text, code, lang, marks) {
  const caption = document.createElement("div");
  caption.className = "code-label";
  caption.textContent = text;
  parent.appendChild(caption);
  readOnlyView(parent, code, lang, marks);
  return caption;
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

  if (typed === normalizeCode(region.doc)) {
    // What was left to type is tinted; for a block typed from scratch that is all of it, so nothing is.
    const left = region.holes || (region.kind === "all" ? [] : [region.gap]);
    return captioned(parent, labels.answer, code, lang, left.map(([from, to]) => mark("c-answer", from, to)));
  }
  if (typed === region.expected) {
    return captioned(parent, labels.correct, code, lang, [mark("c-good", ...region.gap)]);
  }

  const changes = presentableDiff(typed, region.expected);
  const first = captioned(parent, labels.typed, typed, lang, changeMarks(typed, changes.map((c) => [c.fromA, c.toA]), "c-bad"));
  captioned(parent, labels.expected, region.expected, lang, changeMarks(region.expected, changes.map((c) => [c.fromB, c.toB]), "c-missed"));
  return first;
}

export function renderBack(root) {
  const rendered = renderMarkdown(root.querySelector('[data-part="prompt"]'), true);
  const typed = loadTyped(rendered.key);
  const block = readOnlyBlocks(rendered.blocks);
  const result = block ? showResult(block.holder, block, typed) : null;

  // Answer field: graded here, unless the Prompt already has its typeable block.
  const answer = root.querySelector('[data-part="answer"]');
  if (answer) {
    const field = answerField(answer);
    answer.textContent = "";
    if (field.region && !result) {
      showResult(answer, field, typed);
    } else if (field.region) {
      captioned(answer, CONFIG.labels.answer, field.region.expected, "");
    }
  }

  const back = root.querySelector('[data-part="back"]');
  if (back) readOnlyBlocks(renderMarkdown(back, false).blocks);

  // Anki scrolls to #answer; when the result sits inside the Prompt, point it there.
  if (result) {
    const marker = root.querySelector("#answer");
    if (marker) marker.removeAttribute("id");
    result.id = "answer";
  }
}
