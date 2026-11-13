/* Markdown fields: text -> markdown-it tokens -> HTML, with code blocks handed
 * back to the caller to build. */
import type {Token} from "markdown-it";
import markdownit from "markdown-it";
import {CONFIG} from "./config.ts";
import {EMBED_TOKENS, fieldText} from "./field-text.ts";
import {type CodeBlock, makeRegion, maskRuns, type Region, type Span, typedBlock} from "./regions.ts";

/* A code block of a rendered field; holder is the marker element where it goes. */
export type Block = CodeBlock & { holder: HTMLElement };

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

/* The words after the opening fence: a language and/or the `type` flag. */
export function parseInfo(info = "") {
    let lang = "";
    let type = false;
    for (const word of info.split(/\s+/)) {
        if (word.toLowerCase() === CONFIG.typeFlag) type = true;
        else if (!lang) lang = word;
    }
    return {lang, type};
}

/* Which characters of a top-level fenced block were underlined in the field.
 * Returns the underlined runs (an empty list if nothing is underlined), or
 * null when the offsets cannot be trusted. The block's content is rebuilt
 * from the source lines and compared with what markdown-it produced, so
 * offsets are only used when they are known to be exact. */
function underlinedRuns(token: Token, lines: string[], mask: string): Span[] | null {
    if (token.level !== 0 || !token.map) return null;
    const first = token.map[0] + 1;
    const count = token.content.split("\n").length - 1;
    const indent = (line: string) => /^ */.exec(line)![0].length;   // spaces only, as markdown-it strips them
    const fenceIndent = indent(lines[token.map[0]]);
    let at = 0;   // where each line starts in the field's text, and so in mask
    for (let i = 0; i < first; i++) at += lines[i].length + 1;
    let rebuilt = "";
    let inner = "";   // the mask of each line as it is in token.content, line break included
    for (const line of lines.slice(first, first + count)) {
        const cut = Math.min(fenceIndent, indent(line));
        rebuilt += line.slice(cut) + "\n";
        inner += mask.slice(at + cut, at + line.length + 1);
        at += line.length + 1;
    }
    return rebuilt === token.content ? maskRuns(inner) : null;
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

function hash(s: string): string {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return String(h);
}

/* Render a Markdown field in place.
 *
 * Returns the field's code blocks, of which at most one has a region (is
 * typed); blocks are only made typeable when allowType is set. key
 * identifies the field's content, so a typed answer can be matched to the
 * card it was typed on. */
export function renderMarkdown(el: HTMLElement, allowType: boolean): { key: string, blocks: Block[] } {
    let {text, mask, embeds} = fieldText(el, {marks: allowType, embeds: true});
    if (!text.endsWith("\n")) {
        text += "\n";
        mask += "0";
    }

    const tokens = md.parse(text, {});
    const lines = text.split("\n");
    const found: CodeBlock[] = [];   // in token order, which is the order of the markers

    let typeable = false;
    for (const token of tokens) {
        if (token.type !== "fence" && token.type !== "code_block") continue;
        const {lang, type} = parseInfo(token.info);
        let runs: Span[] | null = null;
        if (token.content.includes("\uE000")) {
            token.content = token.content.replace(EMBED_TOKENS, "");
        } else if (allowType && !typeable && token.type === "fence") {
            runs = underlinedRuns(token, lines, mask) ?? [];
        }
        const code = token.content.replace(/\n$/, "");
        let region: Region | null = null;
        if (runs && type) region = typedBlock(code, runs);
        else if (runs?.length) region = makeRegion(code, runs[0][0], runs[runs.length - 1][1]);
        if (region) typeable = true;
        found.push({code, lang, region});
    }

    el.innerHTML = md.renderer.render(tokens, md.options, {});
    restoreEmbeds(el, embeds);

    const blocks = [...el.querySelectorAll<HTMLElement>("[data-cc-block]")]
        .map((holder, i) => ({holder, ...found[i]}));
    return {key: hash(text), blocks};
}
