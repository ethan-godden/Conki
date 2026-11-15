/* Options. After changing one: rebuild, copy the script into collection.media
 * again and restart Anki. */
export const CONFIG = {
    indent: "    ",          // what Tab inserts; tabs are compared as this many spaces
    typeSelector: "u",       // underlined text in the Answer field is left out of the starter code, to be typed
    ignoreSpacing: true,     // spacing inside a line is not a mistake: x=1 matches x = 1 (see squeezeSpacing in code.js)
    storageKey: "codeTypeAnswer",
    labels: {
        typed: "You typed",
        expected: "Expected",
        answer: "Answer",
        correct: "Correct",
        spacing: "Correct, apart from spacing"
    },
    placeholder: "Type your answer\u2026 (Ctrl/Cmd+Enter to check)",
};
