/* Inlined into both card templates by the build (Anki templates cannot share
 * a file). Loads _code-card.js from collection.media once per session, then
 * renders the card; on failure it shows why and reveals the raw fields. */
declare const onUpdateHook: (() => Promise<void>)[] | undefined;   // Anki's, on desktop

(() => {
  const root = document.getElementById("cc")!;
  const fail = (err: unknown) => {
    root.classList.remove("cc-raw");
    const note = document.createElement("div");
    note.className = "cc-error";
    note.textContent = "Code card: " + ((err as Error)?.message || err);
    root.prepend(note);
  };
  const done = new Promise<void>((resolve, reject) => {
    if (window.CodeCard) return resolve();
    const s = document.createElement("script");
    s.src = "_code-card.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("_code-card.js is missing from collection.media"));
    setTimeout(() => reject(new Error("_code-card.js did not load")), 10000);
    document.head.appendChild(s);
  }).then(() => window.CodeCard!.render(root)).catch(fail);
  // Anki keeps the card hidden (and delays MathJax) until this settles.
  if (typeof onUpdateHook !== "undefined") onUpdateHook.push(() => done);
})();
