/* Inlined into every card template by the build (Anki templates cannot share
 * a file). The root's data-card names the object that renders the card,
 * MarkdownCard or CodeCard. The scripts it needs are loaded from
 * collection.media once per session, in order: _codemirror.min.js, which
 * both are built on, then the card's own, which must be from the same build.
 * Then the card is rendered and revealed; on failure it shows why, with the
 * raw fields. */
declare const onUpdateHook: (() => Promise<void>)[] | undefined;   // Anki's, on desktop
declare const __CODEMIRROR_SCRIPT__: string, __MARKDOWN_SCRIPT__: string, __CODE_SCRIPT__: string;   // filled in by the build

(() => {
    const root = document.getElementById("cc")!;
    const card = root.dataset.card === "CodeCard" ? "CodeCard" : "MarkdownCard";
    const file = card === "CodeCard" ? __CODE_SCRIPT__ : __MARKDOWN_SCRIPT__;
    const fail = (err: unknown) => {
        const note = document.createElement("div");
        note.className = "cc-error";
        note.textContent = (card === "CodeCard" ? "Code card: " : "Markdown card: ") + ((err as Error)?.message || err);
        root.prepend(note);
    };
    const load = (name: "CardCodeMirror" | typeof card, file: string) => new Promise<void>((resolve, reject) => {
        if (window[name]) return resolve();
        const s = document.createElement("script");
        s.src = file;
        s.onload = () => (window[name] ? resolve() : reject(new Error(`${file} did not load`)));
        s.onerror = () => reject(new Error(`${file} is missing from collection.media`));
        setTimeout(() => reject(new Error(`${file} did not load`)), 10000);
        document.head.appendChild(s);
    });
    const done = load("CardCodeMirror", __CODEMIRROR_SCRIPT__)
        .then(() => load(card, file))
        .then(() => {
            const [version, base] = [window[card]!.version, window.CardCodeMirror!.version];
            if (version !== base) {
                throw new Error(`${file} is version ${version} but ${__CODEMIRROR_SCRIPT__} is ${base}: copy all the scripts into collection.media and restart Anki`);
            }
            window[card]!.render(root);
        })
        .catch(fail)
        .then(() => root.classList.remove("cc-raw"));
    // Anki keeps the card hidden (and delays MathJax) until this settles.
    if (typeof onUpdateHook !== "undefined") onUpdateHook.push(() => done);
})();
