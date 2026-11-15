/* Markdown fields: text -> markdown-it tokens -> HTML, with code blocks handed
 * back to the caller to build. */
import markdownit from "markdown-it";
import {EMBED_TOKENS, fieldText} from "./field-text.ts";

/* A code block of a rendered field; holder is the marker element where it goes. */
export interface Block {
    holder: HTMLElement;
    code: string;
    lang: string;
}

// html:false  -> anything that looks like HTML in the text is shown literally
// breaks:true -> a line break typed in Anki is a line break on the card
const md = markdownit({html: false, breaks: true, linkify: true, typographer: false});
md.linkify.set({fuzzyLink: false, fuzzyEmail: false});   // only real URLs, not "main.py"

// Leave \( ... \) and \[ ... \] alone so Anki's MathJax still sees them.
md.inline.ruler.before("escape", "anki_math", (state, silent) => {
    const {src, pos} = state;
    const open = src.slice(pos, pos + 2);
    const close = open === "\\(" ? "\\)" : open === "\\[" ? "\\]" : null;
    if (!close) return false;
    const end = src.indexOf(close, pos + 2);
    if (end < 0 || end + 2 > state.posMax) return false;
    if (!silent) state.push("text", "", 0).content = src.slice(pos, end + 2);
    state.pos = end + 2;
    return true;
});

// Code blocks are built as DOM afterwards; leave a marker where each goes.
md.renderer.rules.fence = md.renderer.rules.code_block = () => "<div data-cc-block></div>\n";

/* The language after the opening fence: its first word, if any. */
export function parseInfo(info = "") {
    return info.trim().split(/\s+/)[0];
}

/* Put images, audio buttons and the like back where their placeholders are. */
function restoreEmbeds(root: Element, embeds: Element[]) {
    if (!embeds.length) return;
    const walker = document.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
    const hits: Text[] = [];
    while (walker.nextNode()) if ((walker.currentNode as Text).data.includes("\uE000")) hits.push(walker.currentNode as Text);
    for (const node of hits) {
        node.replaceWith(...node.data.split(EMBED_TOKENS).map((part, i) => (i % 2 ? embeds[+part] : part)).filter(Boolean));
    }
}

/* Render a Markdown field in place. Returns its code blocks, for the caller
 * to build (see editor.ts). */
export function renderMarkdown(el: HTMLElement): Block[] {
    const {text, embeds} = fieldText(el, {embeds: true});
    const tokens = md.parse(text, {});
    const found: { code: string, lang: string }[] = [];   // in token order, which is the order of the markers
    for (const token of tokens) {
        if (token.type !== "fence" && token.type !== "code_block") continue;
        found.push({code: token.content.replace(EMBED_TOKENS, "").replace(/\n$/, ""), lang: parseInfo(token.info)});
    }

    el.innerHTML = md.renderer.render(tokens, md.options, {});
    restoreEmbeds(el, embeds);
    return [...el.querySelectorAll<HTMLElement>("[data-cc-block]")].map((holder, i) => ({holder, ...found[i]}));
}
