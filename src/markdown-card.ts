/* Entry point of _markdown-card.min.js, which defines window.MarkdownCard: the
 * Markdown note type. Every [data-part] element of the card is a Markdown
 * field, with read-only code blocks and nothing to type.
 *
 * Built on _codemirror.min.js, which has to load first: the modules of src
 * this imports other than markdown.ts, and CodeMirror with them, come from
 * there (see codemirror.ts and scripts/build.ts). */
import {CONFIG} from "./config.ts";
import {destroyViews, readOnlyView} from "./editor.ts";
import {renderMarkdown} from "./markdown.ts";

declare const __VERSION__: string;   // filled in by the build

declare global {
    interface Window {
        MarkdownCard?: typeof MarkdownCard;
    }
}

const MarkdownCard = {render, config: CONFIG, version: __VERSION__};
window.MarkdownCard ??= MarkdownCard;

function render(root: HTMLElement) {
    destroyViews();
    for (const part of root.querySelectorAll<HTMLElement>("[data-part]")) {
        for (const block of renderMarkdown(part)) readOnlyView(block.holder, block.code, block.lang);
    }
}
