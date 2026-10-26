/* Gives the source modules a DOM when they run under Node. Import this before
 * calling anything from src/js that touches `document` or `window`. */
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1/" });
globalThis.window = dom.window;
globalThis.document = dom.window.document;

/* An element holding `html`, the way a field's content arrives from Anki. */
export function field(html) {
  const el = document.createElement("div");
  el.innerHTML = html;
  return el;
}
