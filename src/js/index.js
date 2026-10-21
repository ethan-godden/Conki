/* Entry point. The card templates load the built script and call
 * CodeCard.render(root) with the card's root element. */
import { renderBack } from "./answer.js";
import { CONFIG } from "./config.js";
import { loadLibs } from "./libs.js";
import { renderFront } from "./question.js";

function render(root) {
  return loadLibs().then(() => {
    if (root.getAttribute("data-side") === "back") renderBack(root);
    else renderFront(root);
    root.classList.remove("cc-raw");
  });
}

if (!window.CodeCard) window.CodeCard = { render, config: CONFIG };
