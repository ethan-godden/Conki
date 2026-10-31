/* Whole cards, through the built templates and the built script, in a stand-in
 * for Anki's reviewer (see helpers/reviewer.js). */
import assert from "node:assert/strict";
import test from "node:test";
import { Reviewer, shown } from "./helpers/reviewer.js";

/* A fenced block the way it is typed into a field: lines separated by <br>. */
const fence = (info, ...lines) => ["```" + info, ...lines, "```"].join("<br>");

/* Runs `body` with a fresh reviewer session. */
function session(name, body, options) {
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
const typeable = (card) => card.querySelectorAll('.cm-content[contenteditable="true"]');

const ADD = { Prompt: "Write a function <b>add</b>.", Answer: "def add(a, b):<br>&nbsp; &nbsp; return a + b" };
const ADD_CODE = "def add(a, b):\n    return a + b";

session("Answer field: an empty editor under the prompt, and the answer stays out of the page", async (anki) => {
  const card = await anki.question(ADD);
  const input = anki.input;
  assert.equal(typeable(card).length, 1);
  assert.equal(input.closest(".cm-editor").parentNode, card, "the editor comes after the prompt, not inside it");
  assert.ok(input.closest(".cm-editor").classList.contains("cc-box"), "a box to type a whole block in");
  assert.equal(anki.text, "");
  assert.equal(card.querySelector(".cc-placeholder").textContent, anki.window.CodeCard.config.placeholder);
  assert.equal(anki.document.activeElement, input, "the editor has focus");
  assert.equal(card.classList.contains("cc-raw"), false, "the card is revealed once rendered");
  assert.equal(card.querySelector(".prompt").innerHTML, "<p>Write a function add.</p>\n");
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
  assert.equal(anki.document.getElementById("answer").className, "cc-sep", "Anki's scroll target stays on the divider");
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

const TYPED = { Prompt: "Write `add`:<br><br>" + fence("python type", "def add(a, b):", "&nbsp; &nbsp; return a + b") + "<br><br>Keep it short.", Back: "Uses the `+` operator." };

session("```lang type: the editor replaces the block inside the prompt", async (anki) => {
  const card = await anki.question(TYPED);
  assert.equal(typeable(card).length, 1);
  assert.equal(anki.input.closest("[data-part]").className, "prompt");
  assert.ok(anki.input.classList.contains("language-python"));
  assert.equal(anki.text, "");
  assert.equal(card.textContent.includes("return"), false, "the solution is not in the page");
  assert.ok(card.textContent.includes("Keep it short."));
});

session("```lang type: correct answer; Anki's scroll target moves to the result; Back is rendered", async (anki) => {
  await anki.question(TYPED);
  anki.type("def add(a, b):\n    return a + b\n\n");
  const card = await anki.answer(TYPED);
  assert.deepEqual(shown(card).labels, ["Correct"]);
  assert.equal(anki.document.getElementById("answer").className, "code-label");
  assert.equal(card.querySelector(".cc-sep").id, "");
  assert.equal(card.querySelector(".back").innerHTML, "<p>Uses the <code>+</code> operator.</p>\n");
});

const FIB_HEAD = 'def fib(n):\n    """Return the n-th Fibonacci number."""\n';
const FIB_LINES = "    if n < 2:\n        return n\n    return fib(n - 1) + fib(n - 2)";
const FIB_TAIL = "\nprint(fib(10))";
const FIB_CODE = FIB_HEAD + FIB_LINES + "\n" + FIB_TAIL;
const FIB_DOC = FIB_HEAD + "    \n" + FIB_TAIL;   // the code less its typed lines; the first one is already indented
const FIB = { Prompt: "Complete the body:<br><br>" + fence("python", "def fib(n):", '&nbsp; &nbsp; """Return the n-th Fibonacci number."""',
  "<u>&nbsp; &nbsp; if n &lt; 2:", "&nbsp; &nbsp; &nbsp; &nbsp; return n", "&nbsp; &nbsp; return fib(n - 1) + fib(n - 2)</u>", "", "print(fib(10))") };

session("underlined lines: a gap inside the code, which starts at the code's indentation", async (anki) => {
  const card = await anki.question(FIB);
  assert.equal(anki.text, FIB_DOC);
  assert.equal(anki.view.state.selection.main.head, FIB_HEAD.length + 4, "the cursor starts in the gap");
  assert.ok(anki.input.classList.contains("language-python"));
  assert.equal(card.querySelector(".cc-placeholder").textContent, anki.window.CodeCard.config.gapPlaceholder);
  assert.equal(card.querySelectorAll(".cm-line.cc-gap").length, 1, "the gap's line is tinted");
  assert.equal(anki.input.closest(".cm-editor").classList.contains("cc-box"), false, "the code is not one big box");
  assert.deepEqual(shown(card).blocks, [FIB_DOC]);
});

session("underlined lines: only the gap can be edited", async (anki) => {
  await anki.question(FIB);
  anki.view.dispatch({ changes: { from: 0, insert: "x" } });
  anki.view.dispatch({ changes: { from: FIB_DOC.length, insert: "x" } });
  anki.view.dispatch({ changes: { from: 0, to: FIB_DOC.length } });
  anki.press("Backspace");
  assert.equal(anki.text, FIB_DOC, "text before and after the gap, and its indentation, cannot be changed");

  anki.type("if");
  assert.equal(anki.text, FIB_HEAD + "    if\n" + FIB_TAIL);
  anki.press("Backspace");
  anki.press("Backspace");
  anki.press("Backspace");
  assert.equal(anki.text, FIB_DOC, "the gap can be emptied again, but no further");
});

session("underlined lines: typed with Enter, Tab and Backspace the way code is typed", async (anki) => {
  await anki.question(FIB);
  anki.type("if n < 2:");
  anki.press("Enter");
  anki.press("Tab");
  anki.type("return n");
  anki.press("Enter");
  anki.press("Backspace");
  anki.type("return fib(n - 1) + fib(n - 2)");
  assert.equal(anki.text, FIB_CODE);

  const view = shown(await anki.answer(FIB));
  assert.deepEqual(view.labels, ["Correct"]);
  assert.deepEqual(view.blocks, [FIB_CODE], "the block is whole again");
  assert.deepEqual(view.good, FIB_LINES.split("\n"), "the lines that were typed");
  assert.equal(anki.document.querySelectorAll(".cm-line.cc-gap").length, 0, "nothing is tinted as a gap any more");
});

session("underlined lines: a wrong answer shows the block as typed and the block as expected", async (anki) => {
  await anki.question(FIB);
  anki.type("if n <= 1:\n        return n\n    return fib(n-1) + fib(n-2)");
  const view = shown(await anki.answer(FIB));
  assert.deepEqual(view.labels, ["You typed", "Expected"]);
  assert.deepEqual(view.blocks, [FIB_CODE.replace("n < 2", "n <= 1").replace("(n - 1) + fib(n - 2)", "(n-1) + fib(n-2)"), FIB_CODE]);
  assert.deepEqual(view.bad, ["= 1", "-", "-"], "what was typed wrongly");
  assert.deepEqual(view.missed, [" 2", " - ", " - "], "what was expected instead");
});

session("underlined lines: nothing typed shows the answer with the gap tinted", async (anki) => {
  await anki.question(FIB);
  const view = shown(await anki.answer(FIB));
  assert.deepEqual(view.labels, ["Answer"]);
  assert.deepEqual(view.blocks, [FIB_CODE]);
  assert.deepEqual(view.answer, FIB_LINES.split("\n"));
});

const C_CODE = '#include <stdio.h>\n\nint main(void) {\n    printf("%d\\n", 42);\n    return 0;\n}';
const PRINTF = { Prompt: "Fill in the format string.<br><br>" + fence("c", "#include &lt;stdio.h&gt;", "", "int main(void) {",
  '&nbsp; &nbsp; printf(<u>"%d\\n"</u>, 42);', "&nbsp; &nbsp; return 0;", "}") };

session("underlined part of a line: a gap in the line; Enter asks Anki for the answer", async (anki) => {
  const card = await anki.question(PRINTF);
  assert.equal(anki.text, C_CODE.replace('"%d\\n"', ""));
  assert.equal(card.querySelectorAll(".cc-placeholder.cc-gap").length, 1);
  assert.equal(anki.press("Tab").defaultPrevented, false, "Tab is not captured in a one-line gap");
  anki.type('"%d\\n"');
  assert.equal(anki.text, C_CODE);
  assert.equal(anki.press("Enter").defaultPrevented, true);
  assert.deepEqual(anki.commands, ["ans"]);
  assert.equal(anki.text, C_CODE, "and Enter does not start a new line");

  const view = shown(await anki.answer(PRINTF));
  assert.deepEqual(view.labels, ["Correct"]);
  assert.deepEqual(view.blocks, [C_CODE]);
  assert.deepEqual(view.good, ['"%d\\n"']);
});

session("underlined part of a line: wrong answer", async (anki) => {
  await anki.question(PRINTF);
  anki.type('"%s"');
  const view = shown(await anki.answer(PRINTF));
  assert.deepEqual(view.labels, ["You typed", "Expected"]);
  assert.deepEqual(view.blocks, [C_CODE.replace('"%d\\n"', '"%s"'), C_CODE]);
  assert.ok(view.bad.length > 0 && view.missed.length > 0);
});

session("a card with only read-only blocks has no editor to type in, and no syntax colouring", async (anki) => {
  const fields = { Prompt: "What does this print?<br><br>" + fence("js", "console.log([1, 2, 3].map(x =&gt; x * 2));") + "<br><br>And this?<br><br>" +
    fence("bash", 'echo "${#HOME}" | wc -c &amp;&amp; [[ -f ~/.zshrc ]]'), Back: "`[2, 4, 6]`<br><br>" + fence("js", "// a new array") };
  let card = await anki.question(fields);
  assert.equal(typeable(card).length, 0);
  assert.equal(anki.document.getElementById("code-input"), null);
  assert.deepEqual(shown(card).blocks, ["console.log([1, 2, 3].map(x => x * 2));", 'echo "${#HOME}" | wc -c && [[ -f ~/.zshrc ]]']);
  assert.deepEqual([...card.querySelectorAll(".cm-content")].map((node) => [...node.classList].filter((name) => name.startsWith("language-"))),
    [["language-js"], ["language-bash"]]);
  assert.equal(card.querySelectorAll(".cm-line span").length, 0, "plain text: no token has an element of its own");

  card = await anki.answer(fields);
  assert.deepEqual(shown(card).labels, []);
  assert.equal(anki.document.getElementById("answer").className, "cc-sep");
  assert.equal(card.querySelector(".back p code").textContent, "[2, 4, 6]");
  assert.equal(card.querySelectorAll(".back .cm-editor").length, 1);
});

session("a typed block has no syntax colouring either", async (anki) => {
  await anki.question({ Prompt: fence("python type", "def f(): return 1") });
  anki.type("def f(): return 'x'  # keywords, strings, comments");
  assert.equal(anki.input.querySelectorAll("span").length, 0);
});

session("escaping: literal tags in prose and code stay text, on both sides", async (anki) => {
  const fields = {
    Prompt: "Tags: &lt;script&gt;alert(1)&lt;/script&gt; &lt;b&gt;not bold&lt;/b&gt; vector&lt;int&gt; &amp;amp; a &lt; b &amp;&amp; c.<br><br>" +
      fence("cpp", "#include &lt;vector&gt;", "std::vector&lt;std::vector&lt;int&gt;&gt; v{{1, 2}, {3, 4}};", 'const char *s = "&lt;/script&gt;&lt;img src=x onerror=alert(1)&gt;";'),
    Answer: 'if (a &lt; b &amp;&amp; c &gt; d) {<br>&nbsp; &nbsp; printf("&lt;b&gt;%s&lt;/b&gt; &amp;amp;\\n", s);<br>}',
  };
  const card = await anki.question(fields);
  assert.equal(card.querySelector(".prompt p").textContent, "Tags: <script>alert(1)</script> <b>not bold</b> vector<int> & a < b && c.");
  assert.equal(card.querySelectorAll(".prompt script, .prompt b, .prompt img, .prompt int").length, 0);
  assert.deepEqual(shown(card).blocks.slice(0, 1), ['#include <vector>\nstd::vector<std::vector<int>> v{{1, 2}, {3, 4}};\nconst char *s = "</script><img src=x onerror=alert(1)>";']);

  anki.type('if (a < b && c > d) {\n    printf("<b>%s</b> &amp;\\n", s);\n}');
  const view = shown(await anki.answer(fields));
  assert.deepEqual(view.labels, ["Correct"]);
  assert.deepEqual(view.good, ['if (a < b && c > d) {', '    printf("<b>%s</b> &amp;\\n", s);', "}"]);
});

session("math, images, tables and links in Markdown fields", async (anki) => {
  const fields = { Prompt: 'Complexity is \\(O(n \\log n)\\). <img src="_diagram.png"><br><br>| a | b |<br>|---|---|<br>| 1 | 2 |', Back: "See https://example.com/docs and `main.py`." };
  let card = await anki.question(fields);
  assert.ok(card.querySelector(".prompt p").textContent.includes("\\(O(n \\log n)\\)"), "MathJax delimiters left for Anki");
  assert.equal(card.querySelector(".prompt p img").getAttribute("src"), "_diagram.png");
  assert.equal(card.querySelectorAll(".prompt table td").length, 2);
  card = await anki.answer(fields);
  assert.deepEqual([...card.querySelectorAll(".back a")].map((a) => a.getAttribute("href")), ["https://example.com/docs"]);
  assert.equal(card.querySelector(".back code").textContent, "main.py");
});

session("a typeable block in the Prompt wins over the Answer field, which is then shown read-only", async (anki) => {
  const fields = { Prompt: fence("ts type", "const x: number = 1;"), Answer: "ignored = True" };
  const card = await anki.question(fields);
  assert.equal(typeable(card).length, 1);
  anki.type("const x: number = 1;");
  const view = shown(await anki.answer(fields));
  assert.deepEqual(view.labels, ["Correct", "Answer"]);
  assert.deepEqual(view.blocks, ["const x: number = 1;", "ignored = True"]);
});

session("a typed answer is only used for the card it was typed on", async (anki) => {
  await anki.question(ADD);
  anki.type("something");
  assert.deepEqual(shown(await anki.answer(TYPED)).labels, ["Answer"], "another card's answer side ignores it");
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
  const destroyed = [];
  old.destroy = ((destroy) => function () { destroyed.push(this); return destroy.call(this); })(old.destroy);
  await anki.answer(ADD);
  assert.deepEqual(destroyed, [old]);
});

const AREA = "def area(w, h):\n    return w * h\n\nprint(area(2, 3))";
const AREA_START = "def area(w, h):\n    \n\nprint(area(2, 3))";
const STARTER = { Prompt: "Finish the function.<br><br>" + fence("python type", "def area(w, h):", "&nbsp; &nbsp; <u>return w * h</u>", "", "print(area(2, 3))") };

session("starter code in a ```lang type block: pre-filled, cursor at the missing part", async (anki) => {
  const card = await anki.question(STARTER);
  assert.equal(anki.text, AREA_START);
  assert.equal(anki.view.state.selection.main.head, 20);
  assert.ok(anki.input.closest(".cm-editor").classList.contains("cc-box"));
  assert.equal(card.querySelectorAll(".cc-gap").length, 0, "all of it is editable, so nothing is marked as the gap");
  assert.equal((card.textContent + anki.text).includes("w * h"), false, "the missing code is not in the page");

  anki.view.dispatch({ changes: { from: 0, insert: "# " } });   // starter code can be edited anywhere
  anki.view.dispatch({ changes: { from: 0, to: 2 } });
  anki.type("return w * h");
  assert.equal(anki.text, AREA);
  const view = shown(await anki.answer(STARTER));
  assert.deepEqual(view.labels, ["Correct"]);
  assert.deepEqual(view.good, ["def area(w, h):", "    return w * h", "print(area(2, 3))"]);
});

session("starter code left unchanged counts as not attempted", async (anki) => {
  await anki.question(STARTER);
  let view = shown(await anki.answer(STARTER));
  assert.deepEqual(view.labels, ["Answer"]);
  assert.deepEqual(view.blocks, [AREA]);
  assert.deepEqual(view.answer, ["return w * h"], "the part that was left to type is tinted");

  await anki.question(STARTER);
  anki.type("x");
  anki.view.dispatch({ changes: { from: 0, to: anki.text.length, insert: AREA_START } });
  view = shown(await anki.answer(STARTER));
  assert.deepEqual(view.labels, ["Answer"], "edited back to the starter code");
});

session("starter code: a wrong completion is diffed against the whole block", async (anki) => {
  await anki.question(STARTER);
  anki.type("return w + h");
  const view = shown(await anki.answer(STARTER));
  assert.deepEqual(view.labels, ["You typed", "Expected"]);
  assert.deepEqual(view.blocks, [AREA.replace("*", "+"), AREA]);
  assert.deepEqual([view.bad, view.missed], [["+"], ["*"]]);
});

const LOOP = "int sum = 0;\nfor (int i = 0; i < n; i++) {\n    sum += xs[i];\n}";
const LOOP_FIELDS = { Prompt: "Finish the loop.", Answer: "int sum = 0;<br>for (int i = 0; i &lt; n; i++) {<br>&nbsp; &nbsp; <u>sum += xs[i];</u><br>}" };

session("starter code in the Answer field", async (anki) => {
  let card = await anki.question(LOOP_FIELDS);
  assert.equal(anki.input.closest(".cm-editor").parentNode, card);
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

session("the script is fetched once per session", async (anki) => {
  await anki.question(ADD);
  await anki.answer(ADD);
  await anki.question(TYPED);
  await anki.answer(TYPED);
  assert.deepEqual(anki.requests, ["_code-card.js"]);
});

session("script missing from collection.media: the card says so, shows the raw fields, and recovers", async (anki) => {
  let card = await anki.question(ADD);
  assert.equal(shown(card).error, "Code card: _code-card.js is missing from collection.media");
  assert.equal(card.classList.contains("cc-raw"), false);
  assert.ok(card.textContent.includes("Write a function add."));
  assert.equal(card.querySelector('[data-part="answer"]').hidden, true, "the answer stays hidden even then");

  anki.scriptAvailable = true;
  card = await anki.question(ADD);
  assert.equal(shown(card).error, null);
  assert.equal(typeable(card).length, 1);
}, { scriptAvailable: false });

session("an error while rendering is shown on the card instead of leaving it blank", async (anki) => {
  await anki.question(ADD);
  anki.window.CodeCard.render = () => { throw new Error("boom"); };
  const card = await anki.question(ADD);
  assert.equal(shown(card).error, "Code card: boom");
  assert.equal(card.classList.contains("cc-raw"), false);
});
