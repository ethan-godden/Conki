/* Gives the source modules a DOM when they run under Node. Import this before
 * calling anything from src that touches `document` or `window`. */
import { JSDOM } from "jsdom";

const { window } = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1/" });
Object.assign(globalThis, { window, document: window.document });

/* An element holding `html`, the way a field's content arrives from Anki. */
export function field(html: string): HTMLElement {
  const el = document.createElement("div");
  el.innerHTML = html;
  return el;
}
