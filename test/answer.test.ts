import assert from "node:assert/strict";
import test from "node:test";
import { field } from "./helpers/dom.ts";
import { answerField } from "../src/answer.ts";

const answer = (html: string) => answerField(field(html));

test("nothing underlined: the whole field is typed, the box starts empty", () => {
  assert.deepEqual(answer("def add(a, b):<br>&nbsp; &nbsp; return a + b"), {
    code: "def add(a, b):\n    return a + b",
    expected: "def add(a, b):\n    return a + b",
    starter: "",
    caret: 0,
    holes: [],
  });
});

test("expected is normalised: tabs, trailing spaces; blank lines around the code are dropped", () => {
  assert.deepEqual(answer("<br>\tx = 1&nbsp; <br><br>"), { code: "\tx = 1", expected: "    x = 1", starter: "", caret: 0, holes: [] });
});

test("a field with no code has no answer", () => {
  assert.equal(answer("&nbsp;<br>&nbsp;"), null);
  assert.equal(answer(""), null);
});

test("underlined parts are left out of the starter code; the cursor starts at the first", () => {
  const result = answer("def f():<br>&nbsp; &nbsp; <u>return 1</u>")!;
  assert.equal(result.starter, "def f():\n    ");
  assert.equal(result.caret, 13);
  assert.deepEqual(result.holes, [[13, 21]]);
  assert.equal(result.expected, "def f():\n    return 1");
});

test("several underlined parts", () => {
  const result = answer("function <u>add</u>(a, b) {<br>&nbsp; return <u>a + b</u>;<br>}")!;
  assert.equal(result.starter, "function (a, b) {\n  return ;\n}");
  assert.deepEqual(result.holes, [[9, 12], [30, 35]]);
  assert.equal(result.caret, 9);
});

test("whitespace is trimmed off each underlined part, and whitespace alone marks nothing", () => {
  assert.equal(answer("def f():<u><br>&nbsp; &nbsp; return 1</u>")!.starter, "def f():\n    ", "covered the line break and the indentation");
  assert.deepEqual(answer("x = 1<u>&nbsp; </u><br>y")!.holes, [], "covered only spacing");
});

test("everything underlined is the same as nothing underlined", () => {
  assert.deepEqual(answer("<u>x = 1</u>"), answer("x = 1"));
});

test("HTML stored by Anki's editor: a pasted snippet with a line underlined", () => {
  const result = answer("function f(a, b) {<br><u>&nbsp;&nbsp;&nbsp; return a &lt; b &amp;&amp; b &gt; 0;</u><br>}")!;
  assert.equal(result.code, "function f(a, b) {\n    return a < b && b > 0;\n}");
  assert.equal(result.starter, "function f(a, b) {\n    \n}");
  assert.equal(result.caret, 23, "the cursor starts after the indentation");
});

test("a field stored as one <div> per line works the same", () => {
  const result = answer("<br><div>def f(a, b):</div><div>&nbsp; &nbsp; return <u>a + b</u></div><br>")!;
  assert.equal(result.code, "def f(a, b):\n    return a + b");
  assert.equal(result.starter, "def f(a, b):\n    return ");
  assert.deepEqual(result.holes, [[24, 29]]);
});

test("tabs are kept in the code and compared as four spaces", () => {
  const result = answer("if (a)<br>\tb();")!;
  assert.equal(result.code, "if (a)\n\tb();");
  assert.equal(result.expected, "if (a)\n    b();");
});
