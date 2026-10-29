/* Entry point. The card templates load the built script and call
 * CodeCard.render(root) with the card's root element. */
import { renderBack } from "./answer.js";
import { CONFIG } from "./config.js";
import { destroyViews } from "./editor.js";
import { renderFront } from "./question.js";

function render(root) {
  destroyViews();
  if (root.getAttribute("data-side") === "back") renderBack(root);
  else renderFront(root);
  root.classList.remove("cc-raw");
}

if (!window.CodeCard) {
  window.CodeCard = {
    render,
    config: CONFIG,
    version: typeof __VERSION__ === "string" ? __VERSION__ : "dev",   // filled in by the build
  };
}
