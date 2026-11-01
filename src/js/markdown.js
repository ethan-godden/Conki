/* Markdown fields: text -> markdown-it tokens -> HTML, with code blocks handed
 * back to the caller to build. */
import markdownit from "markdown-it";
import { CONFIG } from "./config.js";
import { EMBED_TOKEN, fieldText } from "./field-text.js";
import { makeRegion, maskRuns, typedBlock } from "./regions.js";

// html:false  -> anything that looks like HTML in the text is shown literally
// breaks:true -> a line break typed in Anki is a line break on the card
const md = markdownit({ html: false, breaks: true, linkify: true, typographer: false });
md.linkify.set({ fuzzyLink: false, fuzzyEmail: false });   // only real URLs, not "main.py"

// Leave \( ... \) and \[ ... \] alone so Anki's MathJax still sees them.
md.inline.ruler.before("escape", "anki_math", (state, silent) => {
  const src = state.src;
  const pos = state.pos;
  if (src.charCodeAt(pos) !== 0x5C) return false;
  const open = src.charAt(pos + 1);
  const close = open === "(" ? "\\)" : open === "[" ? "\\]" : null;
  if (!close) return false;
  const end = src.indexOf(close, pos + 2);
  if (end < 0 || end + 2 > state.posMax) return false;
  if (!silent) state.push("text", "", 0).content = src.slice(pos, end + 2);
  state.pos = end + 2;
  return true;
});

// Code blocks are built as DOM afterwards; leave a marker where they go.
md.renderer.rules.fence = md.renderer.rules.code_block = (tokens, idx, opts, env) => {
  env.blocks.push(tokens[idx].meta);
  return '<div data-cc-block="' + (env.blocks.length - 1) + '"></div>\n';
};

/* The words after the opening fence: a language and/or the `type` flag. */
export function parseInfo(info) {
  let lang = "";
  let type = false;
  for (const word of String(info || "").trim().split(/\s+/)) {
    if (!word) continue;
    if (word.toLowerCase() === CONFIG.typeFlag) type = true;
    else if (!lang) lang = word;
  }
  return { lang, type };
}

/* Which characters of a top-level fenced block were underlined in the field.
 * Returns the underlined runs as [start, end) offsets into token.content
 * (an empty list if nothing is underlined), or null when the offsets cannot
 * be trusted. The block's content is rebuilt from the source lines and
 * compared with what markdown-it produced, so offsets are only used when
 * they are known to be exact. */
function underlinedRuns(token, lines, lineStart, mask) {
  if (token.level !== 0 || !token.map) return null;
  const first = token.map[0] + 1;
  const count = (token.content.match(/\n/g) || []).length;
  const fenceIndent = /^ */.exec(lines[token.map[0]])[0].length;
  let rebuilt = "";
  let inner = "";   // the mask of each line as it is in token.content, line break included
  for (let i = first; i < first + count; i++) {
    const line = lines[i];
    if (line === undefined) return null;
    const cut = Math.min(fenceIndent, /^ */.exec(line)[0].length);
    rebuilt += line.slice(cut) + "\n";
    inner += mask.slice(lineStart[i] + cut, lineStart[i] + line.length + 1);
  }
  return rebuilt === token.content ? maskRuns(inner) : null;
}

/* Put images, audio buttons and the like back where their placeholders are. */
function restoreEmbeds(root, embeds) {
  if (!embeds.length) return;
  const walker = document.createTreeWalker(root, window.NodeFilter.SHOW_TEXT);
  const hits = [];
  let n;
  while ((n = walker.nextNode())) if (n.data.indexOf("\uE000") >= 0) hits.push(n);
  for (const node of hits) {
    const frag = document.createDocumentFragment();
    node.data.split(EMBED_TOKEN).forEach((part, i) => {
      if (i % 2) {
        if (embeds[+part]) frag.appendChild(embeds[+part]);
      } else if (part) {
        frag.appendChild(document.createTextNode(part));
      }
    });
    node.parentNode.replaceChild(frag, node);
  }
}

function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return String(h);
}

/* Render a Markdown field in place.
 *
 * Returns { key, blocks }. Each block is { holder, code, lang, region }: holder
 * is the marker element to replace, and region is set on the one block (at
 * most) that is typed. Blocks are only made typeable when allowType is set.
 * key identifies the field's content, so a typed answer can be matched to the
 * card it was typed on. */
export function renderMarkdown(el, allowType) {
  const src = fieldText(el, { marks: allowType, embeds: true });
  let text = src.text;
  let mask = src.mask;
  if (text.slice(-1) !== "\n") {
    text += "\n";
    mask += "0";
  }

  const env = { blocks: [] };
  const tokens = md.parse(text, env);

  const lines = text.split("\n");
  const lineStart = [];
  let pos = 0;
  for (const line of lines) {
    lineStart.push(pos);
    pos += line.length + 1;
  }

  let typeable = null;
  for (const token of tokens) {
    if (token.type !== "fence" && token.type !== "code_block") continue;
    const info = parseInfo(token.info);
    let runs = null;
    if (EMBED_TOKEN.test(token.content)) {
      token.content = token.content.replace(new RegExp(EMBED_TOKEN.source, "g"), "");
    } else if (allowType && !typeable && token.type === "fence") {
      runs = underlinedRuns(token, lines, lineStart, mask) || [];
    }
    const code = token.content.replace(/\n$/, "");
    let region = null;
    if (runs && info.type) {
      region = typedBlock(code, runs);
    } else if (runs && runs.length) {
      region = makeRegion(code, runs[0][0], runs[runs.length - 1][1]);
    }
    if (region) typeable = token;
    token.meta = { code, lang: info.lang, region };
  }

  el.innerHTML = md.renderer.render(tokens, md.options, env);
  restoreEmbeds(el, src.embeds);

  const blocks = [...el.querySelectorAll("[data-cc-block]")]
    .map((holder) => ({ holder, ...env.blocks[+holder.getAttribute("data-cc-block")] }));
  return { key: hash(text), blocks };
}
