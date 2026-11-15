/* Whole cards, through the built templates and the built script, in a stand-in
 * for Anki's reviewer (see helpers/reviewer.ts). */
import assert from "node:assert/strict";
import test from "node:test";
import { built, CODE_SCRIPT, CODEMIRROR_SCRIPT, MARKDOWN_SCRIPT, Reviewer, scripts, shown } from "./helpers/reviewer.ts";
import type { EditorView } from "@codemirror/view";

/* A fenced block the way it is typed into a field: lines separated by <br>. */
const fence = (info: string, ...lines: string[]) => ["```" + info, ...lines, "```"].join("<br>");

/* Runs `body` with a fresh reviewer session. */
function session(name: string, body: (anki: Reviewer) => Promise<void>, options?: ConstructorParameters<typeof Reviewer>[0]) {
  test(name, async () => {
    const anki = new Reviewer(options);
    try {
      await body(anki);
    } finally {
      anki.close();
    }
  });
}

/* The editors a card has that can be typed into. */
const typeable = (card: Element) => card.querySelectorAll('.cm-content[contenteditable="true"]');

const ADD = { Prompt: "Write a function <b>add</b>.", Answer: "def add(a, b):<br>&nbsp; &nbsp; return a + b" };
const ADD_CODE = "def add(a, b):\n    return a + b";

session("Answer field: an empty editor under the prompt, and the answer stays out of the page", async (anki) => {
  const card = await anki.question(ADD);
  const input = anki.input;
  assert.equal(typeable(card).length, 1);
  assert.equal(input.closest(".cm-editor")!.parentNode, card, "the editor comes after the prompt, not inside it");
  assert.ok(input.closest(".cm-editor")!.classList.contains("cc-box"), "a box to type a whole block in");
  assert.equal(anki.text, "");
  assert.equal(card.querySelector(".cm-placeholder")!.textContent, anki.window.CodeCard!.config.placeholder);
  assert.equal(anki.document.activeElement, input, "the editor has focus");
  assert.equal(card.classList.contains("cc-raw"), false, "the card is revealed once rendered");
  assert.equal(card.querySelector('[data-part="prompt"]')!.innerHTML, "Write a function <b>add</b>.", "the Prompt is as Anki shows it");
  assert.equal(card.querySelector('[data-part="answer"]'), null);
  assert.equal(card.textContent.includes("return a + b"), false);
});

session("Answer field: Tab indents, Ctrl+Enter asks Anki for the answer, a correct answer is Correct", async (anki) => {
  await anki.question(ADD);
  anki.type("def add(a, b):\n");
  assert.equal(anki.press("Tab").defaultPrevented, true);
  anki.type("return a + b");
  assert.equal(anki.text, ADD_CODE, "Tab put four spaces at the cursor");
  assert.deepEqual(anki.commands, []);
  assert.equal(anki.press("Enter", { ctrlKey: true }).defaultPrevented, true);
  assert.deepEqual(anki.commands, ["ans"]);

  const card = await anki.answer(ADD);
  const view = shown(card);
  assert.deepEqual(view.labels, ["Correct"]);
  assert.deepEqual(view.blocks, [ADD_CODE]);
  assert.deepEqual(view.good, ["def add(a, b):", "    return a + b"], "one mark per line");
  assert.equal(anki.document.getElementById("answer")!.className, "cc-sep", "Anki's scroll target stays on the divider");
});

session("Answer field: Cmd+Enter works too, Shift+Tab is left alone", async (anki) => {
  await anki.question(ADD);
  assert.equal(anki.press("Tab", { shiftKey: true }).defaultPrevented, false);
  assert.equal(anki.text, "");
  anki.press("Enter", { metaKey: true });
  assert.deepEqual(anki.commands, ["ans"]);
});

session("Answer field: Enter starts a line at the indentation of the last, and does not ask for the answer", async (anki) => {
  await anki.question(ADD);
  anki.type("def add(a, b):\n    x = 1");
  anki.press("Enter");
  assert.equal(anki.text, "def add(a, b):\n    x = 1\n    ");
  anki.press("Backspace");
  assert.equal(anki.text, "def add(a, b):\n    x = 1\n", "Backspace in the indentation removes four spaces, as Tab adds");
  assert.deepEqual(anki.commands, []);
});

session("Answer field: undo works", async (anki) => {
  await anki.question(ADD);
  anki.type("def");
  anki.press("z", { ctrlKey: true });
  assert.equal(anki.text, "");
});

session("Answer field: a wrong answer is diffed; trailing spaces do not count", async (anki) => {
  await anki.question(ADD);
  anki.type("def add(a, b):\n    return a - b  ");
  const view = shown(await anki.answer(ADD));
  assert.deepEqual(view.labels, ["You typed", "Expected"]);
  assert.deepEqual(view.blocks, ["def add(a, b):\n    return a - b", ADD_CODE]);
  assert.deepEqual(view.bad, ["-"]);
  assert.deepEqual(view.missed, ["+"]);
});

session("Answer field: spacing inside a line does not count; it is marked, but not as a mistake", async (anki) => {
  await anki.question(ADD);
  anki.type("def add(a,b):\n    return a+b");
  const view = shown(await anki.answer(ADD));
  assert.deepEqual(view.labels, ["Correct, apart from spacing", "Expected"]);
  assert.deepEqual(view.blocks, ["def add(a,b):\n    return a+b", ADD_CODE]);
  assert.deepEqual([view.bad, view.missed], [[], []]);
  assert.deepEqual(view.spacing, ["+", " ", " + "]);
});

session("Answer field: with ignoreSpacing off, spacing inside a line counts again", async (anki) => {
  await anki.question(ADD);
  anki.window.CodeCard!.config.ignoreSpacing = false;
  anki.type("def add(a,b):\n    return a+b");
  const view = shown(await anki.answer(ADD));
  assert.deepEqual(view.labels, ["You typed", "Expected"]);
  assert.deepEqual([view.bad, view.missed, view.spacing], [["+"], [" ", " + "], []]);
});

session("Answer field: indentation still counts", async (anki) => {
  await anki.question(ADD);
  anki.type("def add(a, b):\n  return a + b");
  const view = shown(await anki.answer(ADD));
  assert.deepEqual(view.labels, ["You typed", "Expected"]);
  assert.deepEqual([view.missed, view.spacing], [["  "], []]);
});

session("a missing line is marked on the expected side, with a return sign for its line break", async (anki) => {
  const fields = { Prompt: "Print it.", Answer: 'int main() {<br>&nbsp; &nbsp; printf("hi");<br>&nbsp; &nbsp; return 0;<br>}' };
  await anki.question(fields);
  anki.type("int main() {\n    return 0;\n}");
  const view = shown(await anki.answer(fields));
  assert.deepEqual(view.bad, []);
  assert.deepEqual(view.missed, ['    printf("hi");\u21B5', "\u21B5"], "the return sign is inside the mark, and has the mark's colour itself");
});

session("a line break in the wrong place is marked on both sides", async (anki) => {
  const fields = { Prompt: "Brace style.", Answer: "if (x) {<br>}" };
  await anki.question(fields);
  anki.type("if (x)\n{\n}");
  const view = shown(await anki.answer(fields));
  assert.deepEqual(view.bad, ["\u21B5"]);
  assert.deepEqual(view.missed, [" "]);
});

session("Answer field: nothing typed shows the answer", async (anki) => {
  await anki.question(ADD);
  const view = shown(await anki.answer(ADD));
  assert.deepEqual(view.labels, ["Answer"]);
  assert.deepEqual(view.blocks, [ADD_CODE]);
  assert.deepEqual(view.answer, [], "a block typed from scratch is not tinted");
});

session("Answer field written in the HTML editor (<br> plus line break, entities)", async (anki) => {
  const fields = { Prompt: "Sum the even numbers.", Answer: "int sum = 0;<br>\nfor (int i = 0; i &lt; n; i++) {<br>\n&nbsp;&nbsp;&nbsp;&nbsp;if (xs[i] % 2 == 0 &amp;&amp; xs[i] &gt; 0) sum += xs[i];<br>\n}" };
  await anki.question(fields);
  assert.deepEqual(shown(await anki.answer(fields)).blocks,
    ["int sum = 0;\nfor (int i = 0; i < n; i++) {\n    if (xs[i] % 2 == 0 && xs[i] > 0) sum += xs[i];\n}"]);
});

session("what is typed is never treated as HTML", async (anki) => {
  await anki.question(ADD);
  anki.type("<img src=x onerror=alert(1)><script>alert(2)</script>&amp;");
  const card = await anki.answer(ADD);
  assert.equal(shown(card).blocks[0], "<img src=x onerror=alert(1)><script>alert(2)</script>&amp;");
  const elements = [...card.querySelectorAll(".cm-editor img, .cm-editor script")].filter((node) => !node.classList.contains("cm-widgetBuffer"));
  assert.equal(elements.length, 0);
});

session("Prompt and Back are ordinary Anki fields: their HTML is shown as it is, and Markdown is not rendered", async (anki) => {
  const fields = { ...ADD, Prompt: "Write <b>add</b>, **not** this:<br>```py<br>x = 1<br>```", Back: "Uses <i>+</i>, `like this`." };
  let card = await anki.question(fields);
  const prompt = card.querySelector('[data-part="prompt"]')!;
  assert.equal(prompt.innerHTML, fields.Prompt);
  assert.equal(card.querySelectorAll(".cm-editor").length, 1, "only the editor: the fence in the Prompt stays text");
  card = await anki.answer(fields);
  assert.equal(card.querySelector('[data-part="prompt"]')!.innerHTML, fields.Prompt);
  assert.ok(card.innerHTML.includes("<div>Uses <i>+</i>, `like this`.</div>"), "Back follows the answer, unchanged");
  assert.ok(card.querySelector("#answer")!.compareDocumentPosition(card.querySelector(".code-label")!) & 4, "the result comes after the divider");
});

session("a card without an Answer field shows its fields, with nothing to type", async (anki) => {
  let card = await anki.question({ Prompt: "Just a question." });
  assert.equal(typeable(card).length, 0);
  assert.equal(card.classList.contains("cc-raw"), false);
  card = await anki.answer({ Prompt: "Just a question.", Back: "And an answer." });
  assert.deepEqual(shown(card).labels, []);
  assert.ok(card.textContent.includes("And an answer."));
});

session("the typed answer has no syntax colouring", async (anki) => {
  await anki.question(ADD);
  anki.type("def f(): return 'x'  # keywords, strings, comments");
  assert.equal(anki.input.querySelectorAll("span").length, 0);
});

session("escaping: literal tags in the Answer field and in what is typed stay text", async (anki) => {
  const fields = { Prompt: "Print it.", Answer: 'if (a &lt; b &amp;&amp; c &gt; d) {<br>&nbsp; &nbsp; printf("&lt;b&gt;%s&lt;/b&gt; &amp;amp;\\n", s);<br>}' };
  await anki.question(fields);
  anki.type('if (a < b && c > d) {\n    printf("<b>%s</b> &amp;\\n", s);\n}');
  const view = shown(await anki.answer(fields));
  assert.deepEqual(view.labels, ["Correct"]);
  assert.deepEqual(view.good, ['if (a < b && c > d) {', '    printf("<b>%s</b> &amp;\\n", s);', "}"]);
});

session("a typed answer is only used for the card it was typed on", async (anki) => {
  await anki.question(ADD);
  anki.type("something");
  assert.deepEqual(shown(await anki.answer({ ...ADD, Prompt: "Another card." })).labels, ["Answer"], "another card's answer side ignores it");
  assert.deepEqual(shown(await anki.answer({ ...ADD, Answer: "def add(a, b): return a + b" })).labels, ["Answer"], "so does one with another answer");
  assert.deepEqual(shown(await anki.answer(ADD)).labels, ["You typed", "Expected"], "its own card still has it");
});

session("showing the question again clears what was typed", async (anki) => {
  await anki.question(ADD);
  anki.type("something");
  await anki.question(ADD);
  assert.equal(anki.text, "");
  assert.deepEqual(shown(await anki.answer(ADD)).labels, ["Answer"]);
});

session("each side starts with fresh editors: the last card's are destroyed", async (anki) => {
  await anki.question(ADD);
  const old = anki.view;
  const destroyed: EditorView[] = [];
  old.destroy = ((destroy) => function (this: EditorView) { destroyed.push(this); return destroy.call(this); })(old.destroy);
  await anki.answer(ADD);
  assert.deepEqual(destroyed, [old]);
});

const LOOP = "int sum = 0;\nfor (int i = 0; i < n; i++) {\n    sum += xs[i];\n}";
const LOOP_FIELDS = { Prompt: "Finish the loop.", Answer: "int sum = 0;<br>for (int i = 0; i &lt; n; i++) {<br>&nbsp; &nbsp; <u>sum += xs[i];</u><br>}" };

session("starter code in the Answer field", async (anki) => {
  let card = await anki.question(LOOP_FIELDS);
  assert.equal(anki.input.closest(".cm-editor")!.parentNode, card);
  assert.equal(anki.text, LOOP.replace("sum += xs[i];", ""));
  assert.equal(anki.view.state.selection.main.head, 47);
  assert.equal(card.querySelector('[data-part="answer"]'), null);
  assert.equal((card.textContent + anki.text).includes("sum +="), false);
  anki.type("sum += xs[i];");
  assert.deepEqual(shown(await anki.answer(LOOP_FIELDS)).labels, ["Correct"]);

  await anki.question(LOOP_FIELDS);
  let view = shown(await anki.answer(LOOP_FIELDS));
  assert.deepEqual([view.labels, view.blocks, view.answer], [["Answer"], [LOOP], ["sum += xs[i];"]]);

  await anki.question(LOOP_FIELDS);
  anki.type("sum = xs[i];");
  view = shown(await anki.answer(LOOP_FIELDS));
  assert.deepEqual([view.labels, view.missed], [["You typed", "Expected"], ["+"]]);
});

session("starter code can be edited anywhere; edited back to as it was counts as not attempted", async (anki) => {
  const card = await anki.question(LOOP_FIELDS);
  assert.ok(anki.input.closest(".cm-editor")!.classList.contains("cc-box"));
  assert.equal(card.querySelector(".cm-placeholder"), null, "no placeholder over starter code");
  const start = anki.text;
  anki.view.dispatch({ changes: { from: 0, insert: "// " } });
  assert.equal(anki.text, "// " + start);
  anki.view.dispatch({ changes: { from: 0, to: 3 } });
  assert.deepEqual(shown(await anki.answer(LOOP_FIELDS)).labels, ["Answer"]);
});

session("the scripts are fetched once per session, the CodeMirror one first", async (anki) => {
  await anki.question(ADD);
  await anki.answer(ADD);
  await anki.question(LOOP_FIELDS);
  await anki.answer(LOOP_FIELDS);
  assert.deepEqual(anki.requests, [CODEMIRROR_SCRIPT, CODE_SCRIPT]);
});

for (const missing of [CODEMIRROR_SCRIPT, CODE_SCRIPT]) {
  session(`${missing} missing from collection.media: the card says so, shows the raw fields, and recovers`, async (anki) => {
    let card = await anki.question(ADD);
    assert.equal(shown(card).error, `Code card: ${missing} is missing from collection.media`);
    assert.equal(card.classList.contains("cc-raw"), false);
    assert.ok(card.textContent.includes("Write a function add."));
    assert.equal(card.querySelector<HTMLElement>('[data-part="answer"]')!.hidden, true, "the answer stays hidden even then");

    anki.media[missing] = scripts[missing];
    card = await anki.question(ADD);
    assert.equal(shown(card).error, null);
    assert.equal(typeable(card).length, 1);
  }, { missing: [missing] });
}

/* The CodeMirror script, as if from another version. */
const oldBase = built.codemirrorScript.replace(/(\{version:)"[^"]+"(,modules:)/, '$1"0.9.0"$2');

session("Code card with scripts from different versions: the card says to copy them all", async (anki) => {
  assert.notEqual(oldBase, built.codemirrorScript);
  anki.media[CODEMIRROR_SCRIPT] = oldBase;
  const card = await anki.question(ADD);
  assert.match(shown(card).error!, /^Code card: _code-card\.min\.js is version \S+ but _codemirror\.min\.js is 0\.9\.0: copy all the scripts/);
});

session("an error while rendering is shown on the card instead of leaving it blank", async (anki) => {
  await anki.question(ADD);
  anki.window.CodeCard!.render = () => { throw new Error("boom"); };
  const card = await anki.question(ADD);
  assert.equal(shown(card).error, "Code card: boom");
  assert.equal(card.classList.contains("cc-raw"), false);
});

/* ---- the Markdown note type ---- */

const NOTE = { Front: "What does <b>add</b> return?", Back: "The sum:<br>" + fence("python", "def add(a, b):", "&nbsp; &nbsp; return a + b") };

session("Markdown note: the front is Markdown, and only the scripts it needs are fetched", async (anki) => {
  const card = await anki.markdownQuestion({ Front: "Some *text* and `code`.<br>" + fence("python", "x = 1") });
  assert.equal(card.classList.contains("cc-raw"), false, "the card is revealed once rendered");
  assert.equal(card.querySelector(".md p")!.innerHTML, "Some <em>text</em> and <code>code</code>.");
  assert.deepEqual(shown(card).blocks, ["x = 1"]);
  assert.equal(typeable(card).length, 0);
  assert.equal(shown(card).error, null);
  assert.deepEqual(anki.requests, [CODEMIRROR_SCRIPT, MARKDOWN_SCRIPT]);
  assert.equal(anki.window.CodeCard, undefined);
});

session("Markdown note: the back shows the front, then the Back field, both read-only", async (anki) => {
  await anki.markdownQuestion(NOTE);
  const card = await anki.markdownAnswer(NOTE);
  const view = shown(card);
  assert.deepEqual(view.blocks, [ADD_CODE]);
  assert.deepEqual(view.labels, []);
  assert.equal(typeable(card).length, 0);
  assert.ok(card.querySelector(".md")!.textContent!.includes("What does add return?"));
  assert.equal(card.querySelector("#answer")!.tagName, "HR", "Anki scrolls to the divider");
});

session("Markdown note: code blocks are read-only and plain text, with the language as a class", async (anki) => {
  const fields = { Front: "What does this print?<br><br>" + fence("js", "console.log([1, 2, 3].map(x =&gt; x * 2));") + "<br><br>And this?<br><br>" +
    fence("bash type", 'echo "${#HOME}" | wc -c &amp;&amp; [[ -f ~/.zshrc ]]'), Back: "" };
  const card = await anki.markdownQuestion(fields);
  assert.equal(typeable(card).length, 0, "nothing is typed, even with `type` after the fence");
  assert.equal(anki.document.getElementById("code-input"), null);
  assert.deepEqual(shown(card).blocks, ["console.log([1, 2, 3].map(x => x * 2));", 'echo "${#HOME}" | wc -c && [[ -f ~/.zshrc ]]']);
  assert.deepEqual([...card.querySelectorAll(".cm-content")].map((node) => [...node.classList].filter((name) => name.startsWith("language-"))),
    [["language-js"], ["language-bash"]]);
  assert.equal(card.querySelectorAll(".cm-line span").length, 0, "plain text: no token has an element of its own");
});

session("Markdown note: literal tags in prose and code stay text", async (anki) => {
  const fields = {
    Front: "Tags: &lt;script&gt;alert(1)&lt;/script&gt; &lt;b&gt;not bold&lt;/b&gt; vector&lt;int&gt; &amp;amp; a &lt; b &amp;&amp; c.<br><br>" +
      fence("cpp", "#include &lt;vector&gt;", 'const char *s = "&lt;/script&gt;&lt;img src=x onerror=alert(1)&gt;";'),
  };
  const card = await anki.markdownQuestion(fields);
  assert.equal(card.querySelector(".md p")!.textContent, "Tags: <script>alert(1)</script> <b>not bold</b> vector<int> & a < b && c.");
  assert.equal(card.querySelectorAll(".md script, .md b, .md img, .md int").length, 0);
  assert.deepEqual(shown(card).blocks, ['#include <vector>\nconst char *s = "</script><img src=x onerror=alert(1)>";']);
});

session("Markdown note: math, images, tables and links", async (anki) => {
  const fields = { Front: 'Complexity is \\(O(n \\log n)\\). <img src="_diagram.png"><br><br>| a | b |<br>|---|---|<br>| 1 | 2 |', Back: "See https://example.com/docs and `main.py`." };
  let card = await anki.markdownQuestion(fields);
  assert.ok(card.querySelector(".md p")!.textContent.includes("\\(O(n \\log n)\\)"), "MathJax delimiters left for Anki");
  assert.equal(card.querySelector(".md p img")!.getAttribute("src"), "_diagram.png");
  assert.equal(card.querySelectorAll(".md table td").length, 2);
  card = await anki.markdownAnswer(fields);
  assert.deepEqual([...card.querySelectorAll('[data-part="back"] a')].map((a) => a.getAttribute("href")), ["https://example.com/docs"]);
  assert.equal(card.querySelector('[data-part="back"] code')!.textContent, "main.py");
});

session("Markdown and Code notes in one session share the CodeMirror script", async (anki) => {
  await anki.markdownQuestion(NOTE);
  await anki.question(ADD);
  anki.type(ADD_CODE);
  assert.deepEqual(shown(await anki.answer(ADD)).labels, ["Correct"]);
  await anki.markdownAnswer(NOTE);
  assert.deepEqual(shown(await anki.markdownAnswer(NOTE)).blocks, [ADD_CODE]);
  assert.deepEqual(anki.requests, [CODEMIRROR_SCRIPT, MARKDOWN_SCRIPT, CODE_SCRIPT]);
});

for (const missing of [CODEMIRROR_SCRIPT, MARKDOWN_SCRIPT]) {
  session(`Markdown note: ${missing} missing is shown on the card`, async (anki) => {
    const card = await anki.markdownQuestion(NOTE);
    assert.equal(shown(card).error, `Markdown card: ${missing} is missing from collection.media`);
    assert.equal(card.classList.contains("cc-raw"), false);
  }, { missing: [missing] });
}

session("Markdown note with scripts from different versions: the card says to copy them all", async (anki) => {
  anki.media[CODEMIRROR_SCRIPT] = oldBase;
  const card = await anki.markdownQuestion(NOTE);
  assert.match(shown(card).error!, /^Markdown card: _markdown-card\.min\.js is version \S+ but _codemirror\.min\.js is 0\.9\.0/);
});
