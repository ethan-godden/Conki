/* Question side: read-only blocks, plus the text box or gap for the typed part. */
import { CONFIG } from "./config.js";
import { codeBlock, el, splice } from "./dom.js";
import { renderMarkdown } from "./markdown.js";
import { answerField } from "./regions.js";
import { saveTyped } from "./storage.js";

function inputAttributes(node) {
  node.spellcheck = false;
  node.setAttribute("autocomplete", "off");
  node.setAttribute("autocorrect", "off");
  node.setAttribute("autocapitalize", "off");
  node.setAttribute("aria-label", "Your answer");
  return node;
}

function fullTextarea() {
  const ta = inputAttributes(el("textarea", "code"));
  ta.id = "code-input";
  ta.setAttribute("wrap", "off");
  ta.placeholder = CONFIG.placeholder;
  return ta;
}

/* The element shown for a typeable block: { node, input, caret }. */
function questionBlock(block) {
  const r = block.region;
  let input;
  if (r.kind === "all") {
    input = fullTextarea();
    if (r.starter != null) {
      input.value = r.starter;
      input.rows = r.starter.split("\n").length + 3;
    }
    return { node: input, input, caret: r.starter != null ? r.holes[0][0] : null };
  }
  const pre = codeBlock(block.code, block.lang);
  if (r.kind === "lines") {
    input = inputAttributes(el("textarea", "code-gap"));
    input.rows = 1;
    input.setAttribute("wrap", "off");
    input.style.marginLeft = r.indent + "ch";
    input.style.width = "calc(100% - " + r.indent + "ch)";
  } else {
    input = inputAttributes(el("input", "code-gap"));
    input.type = "text";
  }
  input.id = "code-input";
  input.placeholder = CONFIG.gapPlaceholder;
  splice(pre.firstChild, r.start, r.cut, input, false);
  return { node: pre, input, caret: null };
}

function wireInput(input, key, caret) {
  const multiLine = input.tagName === "TEXTAREA";
  const gap = input.classList.contains("code-gap");
  const fit = () => {
    if (!gap) return;
    if (multiLine) {
      input.style.height = "auto";
      input.style.height = (input.scrollHeight + 2) + "px";
    } else {
      input.style.width = Math.max(6, input.value.length + 2) + "ch";
    }
  };
  const store = () => saveTyped(key, input.value);

  input.addEventListener("input", () => {
    store();
    fit();
  });
  input.addEventListener("keydown", (e) => {
    if (e.isComposing) return;
    const bare = !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey;
    if (e.key === "Tab" && bare && multiLine) {
      e.preventDefault();
      if (!document.execCommand("insertText", false, CONFIG.indent)) {
        input.setRangeText(CONFIG.indent, input.selectionStart, input.selectionEnd, "end");
      }
      store();
      fit();
    } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey || !multiLine)) {
      e.preventDefault();
      store();
      if (typeof window.pycmd === "function") window.pycmd("ans");
    }
  });
  fit();
  window.setTimeout(() => {
    input.focus();
    if (caret != null) input.setSelectionRange(caret, caret);
    fit();
  }, 0);
}

export function renderFront(root) {
  const prompt = root.querySelector('[data-part="prompt"]');
  const rendered = renderMarkdown(prompt, true);
  let input = null;
  let caret = null;
  for (const block of rendered.blocks) {
    if (block.region) {
      const built = questionBlock(block);
      block.holder.parentNode.replaceChild(built.node, block.holder);
      input = built.input;
      caret = built.caret;
    } else {
      block.holder.parentNode.replaceChild(codeBlock(block.code, block.lang), block.holder);
    }
  }

  // Answer field: the code to type, unless the Prompt already has a typeable block.
  const answer = root.querySelector('[data-part="answer"]');
  if (answer) {
    const field = answerField(answer);
    answer.parentNode.removeChild(answer);        // the solution does not stay in the question's page
    if (!input && field.region) {
      const box = questionBlock(field);
      root.appendChild(box.node);
      input = box.input;
      caret = box.caret;
    }
  } else if (!input && root.getAttribute("data-answer")) {
    // Front Template from before the Answer field could carry starter code: empty box
    input = fullTextarea();
    root.appendChild(input);
  }

  saveTyped(rendered.key, "");
  if (input) wireInput(input, rendered.key, caret);
}
