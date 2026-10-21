/* Options. After changing one: rebuild, copy the script into collection.media
 * again and restart Anki. */
export const CONFIG = {
  libs: [
    { file: "_markdown-it.min.js", global: "markdownit" },
    { file: "_diff.min.js", global: "Diff" },
  ],
  loadTimeout: 10000,      // ms to wait for a library file before showing an error
  indent: "    ",          // what Tab inserts; tabs are compared as this many spaces
  typeFlag: "type",        // ```python type   -> the whole block is one text box
  typeSelector: "u",       // underlined text inside a code block is what gets typed
  storageKey: "codeTypeAnswer",
  labels: { typed: "You typed", expected: "Expected", answer: "Answer", correct: "Correct" },
  placeholder: "Type your answer\u2026 (Ctrl/Cmd+Enter to check)",
  gapPlaceholder: "\u2026",
};
