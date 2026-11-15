/* Inlined into every card template by the build (Anki templates cannot share
 * a file). The root's data-card names the object that renders the card. The
 * scripts it needs are loaded from collection.media once per session, in
 * order: _markdown-card.min.js, then, for CodeCard, _code-card.min.js, which
 * is built on it. Then the card is rendered; on failure the card shows why
 * and reveals the raw fields. */
declare const onUpdateHook: (() => Promise<void>)[] | undefined;   // Anki's, on desktop
declare const __MARKDOWN_SCRIPT__: string, __CODE_SCRIPT__: string;   // filled in by the build

(() => {
    const root = document.getElementById("cc")!;
    const card = root.dataset.card === "CodeCard" ? "CodeCard" : "MarkdownCard";
    const scripts = [["MarkdownCard", __MARKDOWN_SCRIPT__], ["CodeCard", __CODE_SCRIPT__]] as const;
    const fail = (err: unknown) => {
        root.classList.remove("cc-raw");
        const note = document.createElement("div");
        note.className = "cc-error";
        note.textContent = (card === "CodeCard" ? "Code card: " : "Markdown card: ") + ((err as Error)?.message || err);
        root.prepend(note);
    };
    const load = (name: "MarkdownCard" | "CodeCard", file: string) => new Promise<void>((resolve, reject) => {
        if (window[name]) return resolve();
        const s = document.createElement("script");
        s.src = file;
        s.onload = () => (window[name] ? resolve() : reject(new Error(`${file} did not load`)));
        s.onerror = () => reject(new Error(`${file} is missing from collection.media`));
        setTimeout(() => reject(new Error(`${file} did not load`)), 10000);
        document.head.appendChild(s);
    });
    let done = Promise.resolve();
    for (const [name, file] of scripts) {
        done = done.then(() => load(name, file));
        if (name === card) break;
    }
    done = done.then(() => window[card]!.render(root)).catch(fail);
    // Anki keeps the card hidden (and delays MathJax) until this settles.
    if (typeof onUpdateHook !== "undefined") onUpdateHook.push(() => done);
})();
