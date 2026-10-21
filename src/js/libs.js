/* Loads markdown-it and jsdiff from collection.media, once per session. */
import { CONFIG } from "./config.js";

let ready = null;

function loadScript(file) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    // never leave a card blank because a request hangs
    const timer = window.setTimeout(() => reject(new Error(file + " did not load")), CONFIG.loadTimeout);
    script.src = file;
    script.onload = () => { window.clearTimeout(timer); resolve(); };
    script.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error(file + " is missing from collection.media"));
    };
    document.head.appendChild(script);
  });
}

export function loadLibs() {
  if (!ready) {
    ready = Promise.all(CONFIG.libs.map((lib) => {
      if (window[lib.global]) return null;
      return loadScript(lib.file).then(() => {
        if (!window[lib.global]) throw new Error(lib.file + " did not load correctly");
      });
    }));
    ready.catch(() => { ready = null; });   // retry on the next card
  }
  return ready;
}
