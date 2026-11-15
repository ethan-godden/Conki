/* A stand-in for Anki's reviewer, for testing the built files end to end.
 *
 * It fills the built card templates the way Anki does, puts the result in a
 * page, runs the template's script, and serves the scripts in dist/media when
 * the page asks for them. One Reviewer is one Anki session: the page stays
 * between cards and between a card's two sides, as it does in Anki desktop. */
import { readFile } from "node:fs/promises";
import { EditorView } from "@codemirror/view";
import { type DOMWindow, JSDOM, requestInterceptor, VirtualConsole } from "jsdom";

const dist = new URL("../../dist/", import.meta.url);
const read = (name: string) => readFile(new URL(name, dist), "utf8");

export const CODEMIRROR_SCRIPT = "_codemirror.min.js";
export const MARKDOWN_SCRIPT = "_markdown-card.min.js";
export const CODE_SCRIPT = "_code-card.min.js";

export const built = {
  code: { front: await read("code/front.html"), back: await read("code/back.html") },
  markdown: { front: await read("markdown/front.html"), back: await read("markdown/back.html") },
  style: await read("style.css"),
  codemirrorScript: await read(`media/${CODEMIRROR_SCRIPT}`),
  markdownScript: await read(`media/${MARKDOWN_SCRIPT}`),
  codeScript: await read(`media/${CODE_SCRIPT}`),
};

/* Every script, by file name. */
export const scripts: Record<string, string> = {
  [CODEMIRROR_SCRIPT]: built.codemirrorScript,
  [MARKDOWN_SCRIPT]: built.markdownScript,
  [CODE_SCRIPT]: built.codeScript,
};

/* Anki's rule: a field is empty if it holds only whitespace and <br> / <div> tags. */
const isEmpty = (value: string) => /^(?:\s|<\/?(?:br|div) ?\/?>)*$/i.test(value);

/* Anki's template substitution, as far as these templates use it:
 * {{Field}}, {{#Field}}...{{/Field}} and {{^Field}}...{{/Field}}. */
export function fill(template: string, fields: Record<string, string>) {
  const value = (name: string) => {
    if (!(name in fields)) throw new Error(`template uses unknown field "${name}"`);
    return fields[name];
  };
  return template
    .replace(/\{\{([#^])([^}]+)\}\}([\s\S]*?)\{\{\/\2\}\}/g,
      (match, sign: string, name: string, inner: string) => ((sign === "#") !== isEmpty(value(name)) ? inner : ""))
    .replace(/\{\{([^}#^/]+)\}\}/g, (match, name: string) => value(name));
}

/* jsdom does no layout and has no Range geometry, which CodeMirror measures text with. */
function withoutLayout(window: DOMWindow) {
  window.Range.prototype.getClientRects = () => Object.assign([], { item: () => null }) as unknown as DOMRectList;
  window.Range.prototype.getBoundingClientRect = () => new window.DOMRect(0, 0, 0, 0);
}

export class Reviewer {
  /* What collection.media holds, by file name: the built scripts, unless a
   * test removes or replaces one. */
  media: Record<string, string>;
  commands: string[] = [];   // what the card sent to Anki with pycmd()
  requests: string[] = [];   // file names the page asked the media server for
  window: DOMWindow;
  document: Document;

  /* missing: scripts that are not in collection.media. */
  constructor({ missing = [] as string[] } = {}) {
    this.media = { ...scripts };
    for (const name of missing) delete this.media[name];
    const dom = new JSDOM('<!doctype html><html><head></head><body class="card"><div id="qa"></div></body></html>', {
      url: "http://127.0.0.1:40000/",
      runScripts: "dangerously",
      pretendToBeVisual: true,                // requestAnimationFrame, which CodeMirror measures in
      beforeParse: withoutLayout,
      virtualConsole: new VirtualConsole(),   // failed loads are asserted on, not printed
      resources: {
        interceptors: [requestInterceptor((request) => {
          const name = decodeURIComponent(new URL(request.url).pathname.slice(1));
          this.requests.push(name);
          if (Object.hasOwn(this.media, name)) {
            return new Response(this.media[name], { headers: { "Content-Type": "application/javascript" } });
          }
          return new Response("", { status: 404 });
        })],
      },
    });
    this.window = dom.window;
    this.document = dom.window.document;
    this.window.pycmd = (command: string) => { this.commands.push(command); };
    this.window.onUpdateHook = [];
  }

  /* Shows one side of a card and waits until it has rendered, like Anki's _updateQA. */
  async show(template: string, fields: Record<string, string>) {
    const { window, document } = this;
    const qa = document.getElementById("qa")!;
    window.onUpdateHook.length = 0;
    qa.innerHTML = fill(template, { Prompt: "", Answer: "", Back: "", Front: "", ...fields });
    for (const old of [...qa.querySelectorAll("script")]) {     // Anki re-creates each script so that it runs
      const script = document.createElement("script");
      script.textContent = old.textContent;
      old.replaceWith(script);
    }
    await Promise.allSettled(window.onUpdateHook.map((hook: () => unknown) => hook()));
    for (let i = 0; i < 2; i++) await new Promise((resolve) => window.setTimeout(resolve, 0));   // focus, caret
    return document.getElementById("cc")!;
  }

  /* A side of a card of the Code note type. */
  question(fields: Record<string, string>) { return this.show(built.code.front, fields); }
  answer(fields: Record<string, string>) { return this.show(built.code.back, fields); }

  /* A side of a card of the Markdown note type. */
  markdownQuestion(fields: Record<string, string>) { return this.show(built.markdown.front, fields); }
  markdownAnswer(fields: Record<string, string>) { return this.show(built.markdown.back, fields); }

  /* The element that is typed into (CodeMirror's content element). */
  get input() { return this.document.getElementById("code-input")!; }

  /* Its CodeMirror view: the real one, made by the built script. */
  get view() { return EditorView.findFromDOM(this.input.closest(".cm-editor")!)!; }

  /* What is in it. */
  get text() { return this.view.state.doc.toString(); }

  /* Types text at the cursor. */
  type(text: string) {
    const view = this.view;
    view.dispatch(view.state.replaceSelection(text), { userEvent: "input.type" });
  }

  /* Presses a key in the editor; returns the event so preventDefault can be checked. */
  press(key: string, modifiers: KeyboardEventInit = {}) {
    const event = new this.window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...modifiers });
    this.input.dispatchEvent(event);
    return event;
  }

  close() { this.window.close(); }
}

/* What a rendered card shows, as plain data. The text of a mark that covers
 * several lines comes back as one entry per line. */
export function shown(card: Element) {
  const texts = (selector: string) => [...card.querySelectorAll(selector)].map((node) => node.textContent);
  return {
    labels: texts(".code-label"),
    blocks: [...card.querySelectorAll(".cm-editor")].map((editor) => EditorView.findFromDOM(editor as HTMLElement)!.state.doc.toString()),
    good: texts(".c-good"),
    bad: texts(".c-bad"),
    missed: texts(".c-missed"),
    spacing: texts(".c-spacing"),
    answer: texts(".c-answer"),
    error: card.querySelector(".cc-error")?.textContent ?? null,
  };
}
