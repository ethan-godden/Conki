/* Answer side: the typed part compared with what was expected. */
import { CONFIG } from "./config.js";
import { dedent, normalizeCode } from "./code.js";
import { diffNodes } from "./diff.js";
import { codeBlock, el, label, splice } from "./dom.js";
import { renderMarkdown } from "./markdown.js";
import { answerField } from "./regions.js";
import { loadTyped } from "./storage.js";

function regionNode(r, className) {
  return el("span", "cc-region " + className + (r.kind === "lines" ? " cc-lines" : ""));
}

/* What was typed, brought to the same form as region.expected. */
function typedFor(region, raw) {
  if (raw == null) return "";
  let typed = normalizeCode(raw);
  if (region.kind === "lines") typed = dedent(typed).text;
  if (region.kind === "inline") typed = typed.replace(/^\s+/, "");
  return typed;
}

/* What replaces a typeable block on the answer side:
 *   nothing typed (or starter code left unchanged) -> "Answer"
 *   typed text equals the expected text            -> "Correct"
 *   otherwise                                      -> "You typed" + "Expected" */
function answerBlock(block, rawTyped) {
  const r = block.region;
  const labels = CONFIG.labels;
  const frag = document.createDocumentFragment();
  const whole = r.kind === "all";
  const code = whole && !r.holes ? r.expected : block.code;
  const typed = typedFor(r, rawTyped);
  const untouched = !typed || (r.starter != null && typed === normalizeCode(r.starter));
  let pre;
  let node;

  if (untouched || typed === r.expected) {
    frag.appendChild(label(untouched ? labels.answer : labels.correct));
    pre = codeBlock(code, block.lang);
    if (untouched && r.holes) {
      // starter code was given: tint the parts that were left to type (last first, so offsets stay valid)
      for (const hole of r.holes.slice().reverse()) {
        splice(pre.firstChild, hole[0], hole[1], el("span", "cc-region c-answer"), true);
      }
    } else if (!untouched || !whole) {
      node = regionNode(r, untouched ? "c-answer" : "c-good");
      splice(pre.firstChild, whole ? 0 : r.start, whole ? code.length : r.cut, node, true);
    }
    frag.appendChild(pre);
    return frag;
  }

  const d = diffNodes(typed, r.expected);
  frag.appendChild(label(labels.typed));
  pre = el("pre", "code");
  pre.appendChild(d.mine);
  frag.appendChild(pre);

  frag.appendChild(label(labels.expected));
  if (whole) {
    pre = el("pre", "code");
    pre.appendChild(d.want);
  } else {
    pre = codeBlock(code, block.lang);
    node = regionNode(r, "c-expected");
    if (r.kind === "lines") node.style.paddingLeft = r.indent + "ch";
    node.appendChild(d.want);
    if (r.cut > r.end) node.appendChild(document.createTextNode("\n"));   // the line break that was cut with the lines
    splice(pre.firstChild, r.start, r.cut, node, false);
  }
  frag.appendChild(pre);
  return frag;
}

export function renderBack(root) {
  const prompt = root.querySelector('[data-part="prompt"]');
  const rendered = renderMarkdown(prompt, true);
  const typed = loadTyped(rendered.key);
  let result = null;

  for (const block of rendered.blocks) {
    const node = block.region ? answerBlock(block, typed) : codeBlock(block.code, block.lang);
    if (block.region) result = node.firstChild;
    block.holder.parentNode.replaceChild(node, block.holder);
  }

  // Answer field: graded here, unless the Prompt already has its typeable block.
  const answer = root.querySelector('[data-part="answer"]');
  if (answer) {
    const field = answerField(answer);
    let node;
    if (field.region && !result) {
      node = answerBlock(field, typed);
    } else {
      node = document.createDocumentFragment();
      if (field.region) {
        node.appendChild(label(CONFIG.labels.answer));
        node.appendChild(codeBlock(field.region.expected, ""));
      }
    }
    answer.parentNode.replaceChild(node, answer);
  }

  const back = root.querySelector('[data-part="back"]');
  if (back) {
    for (const block of renderMarkdown(back, false).blocks) {
      block.holder.parentNode.replaceChild(codeBlock(block.code, block.lang), block.holder);
    }
  }

  // Anki scrolls to #answer; when the result sits inside the Prompt, point it there.
  if (result) {
    const marker = root.querySelector("#answer");
    if (marker) marker.removeAttribute("id");
    result.id = "answer";
  }
}
