import assert from "node:assert/strict";
import test from "node:test";
import { field } from "./helpers/dom.ts";
import { parseInfo, renderMarkdown } from "../src/markdown.ts";

/* The HTML a field renders to (code blocks appear as empty marker elements). */
function html(source: string) {
  const el = field(source);
  renderMarkdown(el);
  return el.innerHTML;
}

/* The code blocks of a field. */
const blocks = (source: string) => renderMarkdown(field(source)).map(({ code, lang }) => ({ code, lang }));

/* A fenced block the way it is typed into a field: lines separated by <br>. */
const fence = (info: string, ...lines: string[]) => ["```" + info, ...lines, "```"].join("<br>");

test("parseInfo reads the language: the first word after the fence", () => {
  assert.equal(parseInfo("python"), "python");
  assert.equal(parseInfo("  python  extra"), "python");
  assert.equal(parseInfo(""), "");
  assert.equal(parseInfo(undefined), "");
});

test("line breaks typed in Anki are kept; inline code works", () => {
  assert.equal(html("one<br>two `a &lt; b`"), "<p>one<br>\ntwo <code>a &lt; b</code></p>\n");
});

test("text that looks like HTML is shown literally", () => {
  assert.equal(html("&lt;b&gt;x&lt;/b&gt; &lt;script&gt;alert(1)&lt;/script&gt; vector&lt;int&gt;"),
    "<p>&lt;b&gt;x&lt;/b&gt; &lt;script&gt;alert(1)&lt;/script&gt; vector&lt;int&gt;</p>\n");
});

test("formatting applied with Anki's toolbar is dropped", () => {
  assert.equal(html('<b>bold</b> <i>italic</i> <span style="color: red">red</span> <u>underlined</u>'),
    "<p>bold italic red underlined</p>\n");
});

test("MathJax delimiters survive for Anki to typeset", () => {
  assert.equal(html("\\(a_1 * b_2 * c\\) and \\[x^2\\]"), "<p>\\(a_1 * b_2 * c\\) and \\[x^2\\]</p>\n");
  assert.equal(html("a \\( b"), "<p>a ( b</p>\n", "an unmatched \\( is an ordinary escape");
});

test("only real URLs become links", () => {
  assert.equal(html("see https://example.com/docs and main.py"),
    '<p>see <a href="https://example.com/docs">https://example.com/docs</a> and main.py</p>\n');
  assert.equal(html("[x](javascript:alert(1))"), "<p>[x](javascript:alert(1))</p>\n");
});

test("images and audio buttons are put back where they were", () => {
  assert.equal(html('Diagram: <img src="a.png"> done'), '<p>Diagram: <img src="a.png"> done</p>\n');
  assert.equal(html('Listen <a class="replay-button soundLink" href="#">x</a> **now**'),
    '<p>Listen <a class="replay-button soundLink" href="#">x</a> <strong>now</strong></p>\n');
});

test("code blocks are left as markers and returned to the caller", () => {
  const el = field("before<br><br>" + fence("js", "let a = 1;", "let b = &lt;T&gt;a;") + "<br><br>after");
  const rendered = renderMarkdown(el);
  assert.equal(el.innerHTML, '<p>before</p>\n<div data-cc-block=""></div>\n<p>after</p>\n');
  assert.equal(rendered.length, 1);
  assert.equal(rendered[0].holder, el.querySelector("[data-cc-block]"));
  assert.equal(rendered[0].code, "let a = 1;\nlet b = <T>a;");
  assert.equal(rendered[0].lang, "js");
});

test("an indented code block is a block without a language", () => {
  assert.deepEqual(blocks("text<br><br>&nbsp; &nbsp; indented"), [{ code: "indented", lang: "" }]);
});

test("underline in code is dropped, like other formatting: nothing is typed", () => {
  assert.deepEqual(blocks(fence("python", "x = <u>1</u>")), [{ code: "x = 1", lang: "python" }]);
});

test("several blocks, in order, and empty ones", () => {
  assert.deepEqual(blocks(fence("a", "1") + "<br>text<br>" + fence("b", "") + "<br>" + fence("", "3")),
    [{ code: "1", lang: "a" }, { code: "", lang: "b" }, { code: "3", lang: "" }]);
});

test("a block nested in a list", () => {
  assert.deepEqual(blocks("- item<br>&nbsp; &nbsp; ```py<br>&nbsp; &nbsp; x = 1<br>&nbsp; &nbsp; ```"), [{ code: "x = 1", lang: "py" }]);
});

test("indented, unclosed and tilde fences", () => {
  assert.deepEqual(blocks("&nbsp;&nbsp;```py<br>&nbsp;&nbsp;if a:<br>&nbsp;&nbsp;&nbsp; &nbsp; b()<br>&nbsp;&nbsp;```"), [{ code: "if a:\n    b()", lang: "py" }]);
  assert.deepEqual(blocks("```py<br>x = 1<br>y = 2"), [{ code: "x = 1\ny = 2", lang: "py" }]);
  assert.deepEqual(blocks("~~~py<br>x = 1<br>~~~"), [{ code: "x = 1", lang: "py" }]);
});

test("fields stored as one <div> per line or inside <pre> work the same", () => {
  assert.deepEqual(blocks("<div>```py</div><div>x = 1</div><div>```</div>"), [{ code: "x = 1", lang: "py" }]);
  assert.deepEqual(blocks("<pre>```py\nx = 1\n```</pre>"), [{ code: "x = 1", lang: "py" }]);
});

test("tabs in code are kept", () => {
  assert.deepEqual(blocks(fence("c", "\tif (a)", "\t\tb();")), [{ code: "\tif (a)\n\t\tb();", lang: "c" }]);
});

test("an image inside a code block is dropped from the code", () => {
  assert.deepEqual(blocks(fence("py", 'x = <img src="a.png">1')), [{ code: "x = 1", lang: "py" }]);
});
