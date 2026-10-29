/* Question side: read-only blocks, plus the editor for the typed part. */
import { readOnlyView, typedView } from "./editor.js";
import { renderMarkdown } from "./markdown.js";
import { answerField, wholeRegion } from "./regions.js";
import { saveTyped } from "./storage.js";

export function renderFront(root) {
  const rendered = renderMarkdown(root.querySelector('[data-part="prompt"]'), true);
  let typed = null;   // the block that is typed: { lang, region }

  const edit = (parent, block) => {
    typed = block;
    typedView(parent, block, {
      onChange: (doc) => saveTyped(rendered.key, doc),
      onSubmit: () => { if (typeof window.pycmd === "function") window.pycmd("ans"); },
    });
  };

  for (const block of rendered.blocks) {
    if (block.region) edit(block.holder, block);
    else readOnlyView(block.holder, block.code, block.lang);
  }

  // Answer field: the code to type, unless the Prompt already has a typeable block.
  const answer = root.querySelector('[data-part="answer"]');
  if (answer) {
    const field = answerField(answer);
    answer.parentNode.removeChild(answer);        // the solution does not stay in the question's page
    if (!typed && field.region) edit(root, field);
  } else if (!typed && root.getAttribute("data-answer")) {
    // Front Template from before the Answer field could carry starter code: empty box
    edit(root, { lang: "", region: wholeRegion("") });
  }

  saveTyped(rendered.key, typed ? typed.region.doc : "");
}
