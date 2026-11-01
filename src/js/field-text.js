/* Field HTML -> plain text.
 *
 * Anki stores every field as HTML. fieldText() walks the parsed DOM (no regexes
 * on markup, no dependence on layout) and returns the text a person would read:
 *
 *   <br>                -> line break
 *   block elements      -> start and end on their own line
 *   <pre>               -> contents kept verbatim
 *   entities            -> already decoded by the HTML parser
 *   &nbsp;              -> ordinary space
 *
 * A line break in the HTML source next to a <br> or a block edge is source
 * formatting and is dropped; any other source line break is kept.
 *
 * Returns { text, mask, embeds }:
 *   mask    one character per character of text: "1" where the text was inside
 *           an element matching CONFIG.typeSelector (underlined), else "0".
 *           Only filled in when options.marks is set.
 *   embeds  images, audio buttons and the like. With options.embeds each one is
 *           replaced in the text by \uE000<n>\uE001 and returned here, so it can
 *           be put back after Markdown rendering; otherwise they are dropped.
 */
import { CONFIG } from "./config.js";

const BLOCK_TAGS = /^(ADDRESS|ARTICLE|ASIDE|BLOCKQUOTE|DD|DETAILS|DIV|DL|DT|FIELDSET|FIGCAPTION|FIGURE|FOOTER|FORM|H[1-6]|HEADER|HR|LI|MAIN|NAV|OL|P|PRE|SECTION|SUMMARY|TABLE|TBODY|TFOOT|THEAD|TR|UL)$/;
const SKIP_TAGS = /^(SCRIPT|STYLE|TEMPLATE|NOSCRIPT)$/;
const EMBED_TAGS = /^(IMG|AUDIO|VIDEO|SVG|CANVAS|IFRAME|OBJECT|EMBED|BUTTON)$/;

export const EMBED_TOKEN = /\uE000(\d+)\uE001/;

export function fieldText(root, options = {}) {
  const markSelector = options.marks ? CONFIG.typeSelector : null;
  const embeds = [];
  let text = "";
  let mask = "";
  // How the text ends: "break" (nothing emitted yet, or <br> / a block edge),
  // "soft" (a line break that came from the HTML source) or "text".
  let tail = "break";

  function emit(s, marked) {
    s = s.replace(/[\u200B\uFEFF]/g, "").replace(/\u00A0/g, " ");
    if (!s) return;
    text += s;
    mask += (marked ? "1" : "0").repeat(s.length);
  }
  function hardBreak(marked) {
    if (tail === "soft") {
      text = text.slice(0, -1);
      mask = mask.slice(0, -1);
    }
    emit("\n", marked);
    tail = "break";
  }
  function blockEdge() {
    if (text && !text.endsWith("\n")) emit("\n", false);
    tail = "break";
  }
  function sourceText(s, marked) {
    if (tail === "break" && s.startsWith("\n")) s = s.slice(1);
    if (!s) return;
    emit(s, marked);
    tail = s.endsWith("\n") ? "soft" : "text";
  }
  function preText(s, marked) {
    emit(s, marked);
    tail = "text";
  }
  function walk(node, pre, marked) {
    for (let n = node.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3) {
        const s = n.data.replace(/\r\n?/g, "\n");
        if (pre) preText(s, marked);
        else sourceText(s, marked);
        continue;
      }
      if (n.nodeType !== 1) continue;
      const tag = n.tagName.toUpperCase();
      if (SKIP_TAGS.test(tag)) continue;
      if (tag === "BR") {
        hardBreak(marked);
        continue;
      }
      if (EMBED_TAGS.test(tag) || (tag === "A" && n.classList.contains("replay-button"))) {
        if (options.embeds) {
          emit("\uE000" + embeds.length + "\uE001", false);
          embeds.push(n);
          tail = "text";
        }
        continue;
      }
      const block = BLOCK_TAGS.test(tag);
      if (block) blockEdge();
      if ((tag === "TD" || tag === "TH") && n.previousElementSibling) emit("\t", false);
      walk(n, pre || tag === "PRE" || tag === "TEXTAREA",
           marked || !!(markSelector && n.matches(markSelector)));
      if (block) blockEdge();
    }
  }

  walk(root, false, false);
  return { text, mask, embeds };
}
