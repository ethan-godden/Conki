/* A stand-in for Anki's reviewer, for testing the built files end to end.
 *
 * It fills the built card templates the way Anki does, puts the result in a
 * page, runs the template's script, and serves dist/media/_code-card.js when
 * the page asks for it. One Reviewer is one Anki session: the page stays
 * between cards and between a card's two sides, as it does in Anki desktop. */
import { readFile } from "node:fs/promises";
import { JSDOM, requestInterceptor, VirtualConsole } from "jsdom";

const dist = new URL("../../dist/", import.meta.url);
const read = (name) => readFile(new URL(name, dist), "utf8");

export const built = {
  front: await read("front.html"),
  back: await read("back.html"),
  style: await read("style.css"),
  script: await read("media/_code-card.js"),
};

/* Anki's rule: a field is empty if it holds only whitespace and <br> / <div> tags. */
const isEmpty = (value) => /^(?:\s|<\/?(?:br|div) ?\/?>)*$/i.test(value);

/* Anki's template substitution, as far as these templates use it:
 * {{Field}}, {{#Field}}...{{/Field}} and {{^Field}}...{{/Field}}. */
export function fill(template, fields) {
  const value = (name) => {
    if (!(name in fields)) throw new Error(`template uses unknown field "${name}"`);
    return fields[name];
  };
  return template
    .replace(/\{\{([#^])([^}]+)\}\}([\s\S]*?)\{\{\/\2\}\}/g,
      (match, sign, name, inner) => ((sign === "#") !== isEmpty(value(name)) ? inner : ""))
    .replace(/\{\{([^}#^/]+)\}\}/g, (match, name) => value(name));
}

export class Reviewer {
  /* scriptAvailable: false behaves as if _code-card.js were not in collection.media. */
  constructor({ scriptAvailable = true } = {}) {
    this.scriptAvailable = scriptAvailable;
    this.commands = [];   // what the card sent to Anki with pycmd()
    this.requests = [];   // file names the page asked the media server for
    const dom = new JSDOM('<!doctype html><html><head></head><body class="card"><div id="qa"></div></body></html>', {
      url: "http://127.0.0.1:40000/",
      runScripts: "dangerously",
      virtualConsole: new VirtualConsole(),   // failed loads are asserted on, not printed
      resources: {
        interceptors: [requestInterceptor((request) => {
          const name = decodeURIComponent(new URL(request.url).pathname.slice(1));
          this.requests.push(name);
          if (name === "_code-card.js" && this.scriptAvailable) {
            return new Response(built.script, { headers: { "Content-Type": "application/javascript" } });
          }
          return new Response("", { status: 404 });
        })],
      },
    });
    this.window = dom.window;
    this.document = dom.window.document;
    this.window.pycmd = (command) => { this.commands.push(command); };
    this.window.onUpdateHook = [];
  }

  /* Shows one side of a card and waits until it has rendered, like Anki's _updateQA. */
  async show(template, fields) {
    const { window, document } = this;
    const qa = document.getElementById("qa");
    window.onUpdateHook.length = 0;
    qa.innerHTML = fill(template, { Prompt: "", Answer: "", Back: "", ...fields });
    for (const old of [...qa.querySelectorAll("script")]) {     // Anki re-creates each script so that it runs
      const script = document.createElement("script");
      script.textContent = old.textContent;
      old.replaceWith(script);
    }
    await Promise.allSettled(window.onUpdateHook.map((hook) => hook()));
    for (let i = 0; i < 2; i++) await new Promise((resolve) => window.setTimeout(resolve, 0));   // focus, caret
    return document.getElementById("cc");
  }

  question(fields) { return this.show(built.front, fields); }
  answer(fields) { return this.show(built.back, fields); }

  get input() { return this.document.getElementById("code-input"); }

  /* Types text at the caret. */
  type(text) {
    const input = this.input;
    input.setRangeText(text, input.selectionStart, input.selectionEnd, "end");
    input.dispatchEvent(new this.window.Event("input", { bubbles: true }));
  }

  /* Presses a key in the input; returns the event so preventDefault can be checked. */
  press(key, modifiers = {}) {
    const event = new this.window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...modifiers });
    this.input.dispatchEvent(event);
    return event;
  }

  close() { this.window.close(); }
}

/* What a rendered card shows, as plain data. */
export function shown(card) {
  const texts = (selector) => [...card.querySelectorAll(selector)].map((node) => node.textContent);
  return {
    labels: texts(".code-label"),
    blocks: texts("pre.code"),
    good: texts(".c-good"),
    bad: texts(".c-bad"),
    missed: texts(".c-missed"),
    regions: [...card.querySelectorAll(".cc-region")].map((node) => `${node.className}: ${node.textContent}`),
    error: (card.querySelector(".cc-error") || {}).textContent ?? null,
  };
}
