/* Entry point of _markdown-card.min.js, which defines window.MarkdownCard.
 *
 * On its own it is the Markdown note type: every [data-part] element of the
 * card is a Markdown field, with read-only code blocks and nothing to type.
 *
 * It is also what _code-card.min.js is built on. CodeMirror can only be on a
 * page once, so the code card's script does not bundle it, nor any module of
 * src it shares with this one: the build points those imports at `modules`
 * below instead (see scripts/build.ts). This script has to load first. */
import * as code from "./code.ts";
import * as config from "./config.ts";
import * as editor from "./editor.ts";
import * as fieldText from "./field-text.ts";
import * as markdown from "./markdown.ts";
import * as regions from "./regions.ts";

declare const __VERSION__: string;   // filled in by the build

declare global {
    interface Window {
        MarkdownCard?: typeof MarkdownCard;
    }
}

/* Keyed by file name, as the modules are imported in src. */
const modules = {
    "code.ts": code,
    "config.ts": config,
    "editor.ts": editor,
    "field-text.ts": fieldText,
    "markdown.ts": markdown,
    "regions.ts": regions,
};

const MarkdownCard = {render, config: config.CONFIG, version: __VERSION__, modules};
window.MarkdownCard ??= MarkdownCard;

function render(root: HTMLElement) {
    editor.destroyViews();
    for (const part of root.querySelectorAll<HTMLElement>("[data-part]")) {
        editor.readOnlyBlocks(markdown.renderMarkdown(part, false).blocks);
    }
    root.classList.remove("cc-raw");
}
