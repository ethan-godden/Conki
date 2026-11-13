import assert from "node:assert/strict";
import test from "node:test";
import { field } from "./helpers/dom.ts";
import { parseInfo, renderMarkdown } from "../src/markdown.ts";

/* The HTML a field renders to (code blocks appear as empty marker elements). */
function html(source: string) {
  const el = field(source);
  renderMarkdown(el, false);
  return el.innerHTML;
}

/* The code blocks of a field, with what is typed in each. */
function blocks(source: string, allowType = true) {
  return renderMarkdown(field(source), allowType).blocks.map(({ code, lang, region }) => {
    const block: { code: string, lang: string, kind: string | null, typed?: string, starter?: string } = { code, lang, kind: region?.kind ?? null };
    if (region && region.kind !== "all") block.typed = code.slice(...region.gap);   // the part that is typed
    if (region && region.holes) block.starter = region.doc;
    return block;
  });
}

/* A fenced block the way it is typed into a field: lines separated by <br>. */
const fence = (info: string, ...lines: string[]) => ["```" + info, ...lines, "```"].join("<br>");

/* Field HTML exactly as Anki 26.09's note editor stored it. */
const FROM_ANKI_EDITOR = {
  // a block typed line by line, then one line selected and underlined (Ctrl+U)
  lineUnderlined: "Complete:<br>```python<br>def f(x):<br>&nbsp; &nbsp; if x &lt; 1 &amp;&amp; x &gt; -1:<br><u>&nbsp; &nbsp; &nbsp; &nbsp; return 1</u><br>```",
  // one character underlined
  characterUnderlined: "```c<br>int x = <u>1</u>;<br>```",
  // two lines underlined
  twoLinesUnderlined: "```py<br>a = 1<br><u>b = 2<br>c = 3</u><br>```",
  // a snippet pasted as plain text, then one line underlined
  pastedThenUnderlined: "```js<br>function f(a, b) {<br><u>&nbsp;&nbsp;&nbsp; return a &lt; b &amp;&amp; b &gt; 0;</u><br>}<br>```",
};

test("parseInfo reads the language and the type flag in any order", () => {
  assert.deepEqual(parseInfo("python"), { lang: "python", type: false });
  assert.deepEqual(parseInfo("python type"), { lang: "python", type: true });
  assert.deepEqual(parseInfo("TYPE python"), { lang: "python", type: true });
  assert.deepEqual(parseInfo("type"), { lang: "", type: true });
  assert.deepEqual(parseInfo(""), { lang: "", type: false });
  assert.deepEqual(parseInfo(undefined), { lang: "", type: false });
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
  const rendered = renderMarkdown(el, true);
  assert.equal(el.innerHTML, '<p>before</p>\n<div data-cc-block=""></div>\n<p>after</p>\n');
  assert.equal(rendered.blocks.length, 1);
  assert.equal(rendered.blocks[0].holder, el.querySelector("[data-cc-block]"));
  assert.equal(rendered.blocks[0].code, "let a = 1;\nlet b = <T>a;");
  assert.equal(rendered.blocks[0].lang, "js");
  assert.equal(rendered.blocks[0].region, null);
});

test("an indented code block is a block without a language", () => {
  assert.deepEqual(blocks("text<br><br>&nbsp; &nbsp; indented"), [{ code: "indented", lang: "", kind: null }]);
});

test("```lang type makes the whole block typed", () => {
  assert.deepEqual(blocks(fence("python type", "x = 1", "y = 2")), [{ code: "x = 1\ny = 2", lang: "python", kind: "all" }]);
  assert.deepEqual(blocks(fence("type", "x = 1")), [{ code: "x = 1", lang: "", kind: "all" }]);
  assert.deepEqual(blocks(fence("py type", "")), [{ code: "", lang: "py", kind: null }], "nothing to type in an empty block");
});

test("underlining part of a line makes an inline gap", () => {
  assert.deepEqual(blocks(fence("c", 'printf(<u>"%d"</u>, 42);')),
    [{ code: 'printf("%d", 42);', lang: "c", kind: "inline", typed: '"%d"' }]);
});

test("underlining whole lines makes a lines gap", () => {
  assert.deepEqual(blocks(fence("py", "def f():", "<u>&nbsp; &nbsp; return 1</u>", "f()")),
    [{ code: "def f():\n    return 1\nf()", lang: "py", kind: "lines", typed: "    return 1" }]);
});

test("underlining everything makes the whole block typed", () => {
  assert.deepEqual(blocks(fence("py", "<u>x = 1", "y = 2</u>")), [{ code: "x = 1\ny = 2", lang: "py", kind: "all" }]);
});

test("several underlined runs without the flag make one gap from first to last", () => {
  assert.deepEqual(blocks(fence("py", "<u>a</u> = <u>b</u> + c")),
    [{ code: "a = b + c", lang: "py", kind: "inline", typed: "a = b" }]);
});

test("```lang type with underlined parts gives starter code", () => {
  assert.deepEqual(blocks(fence("py type", "def f():", "&nbsp; &nbsp; <u>return 1</u>")),
    [{ code: "def f():\n    return 1", lang: "py", kind: "all", starter: "def f():\n    " }]);
  assert.deepEqual(blocks(fence("js type", "function <u>add</u>(a, b) {", "&nbsp; return <u>a + b</u>;", "}")),
    [{ code: "function add(a, b) {\n  return a + b;\n}", lang: "js", kind: "all", starter: "function (a, b) {\n  return ;\n}" }]);
});

test("underlined whitespace alone marks nothing", () => {
  assert.deepEqual(blocks(fence("py", "a = 1", "<u>&nbsp; &nbsp;</u>", "b = 2")), [{ code: "a = 1\n   \nb = 2", lang: "py", kind: null }]);
});

test("only the first marked block is typeable", () => {
  assert.deepEqual(blocks(fence("py", "x = <u>1</u>") + "<br><br>" + fence("js type", "let y = <u>2</u>;")).map((b) => b.kind), ["inline", null]);
});

test("nothing is typeable in a field rendered with allowType off", () => {
  assert.deepEqual(blocks(fence("py type", "x = <u>1</u>"), false), [{ code: "x = 1", lang: "py", kind: null }]);
});

test("underline outside code blocks is ignored", () => {
  assert.deepEqual(blocks("<u>prose</u> and `code`"), []);
});

test("a block nested in a list is typeable only through the flag", () => {
  const item = (info: string) => "- item<br>&nbsp; &nbsp; ```" + info + "<br>&nbsp; &nbsp; x = <u>1</u><br>&nbsp; &nbsp; ```";
  assert.deepEqual(blocks(item("py")), [{ code: "x = 1", lang: "py", kind: null }]);
  assert.deepEqual(blocks(item("py type")), [{ code: "x = 1", lang: "py", kind: "all" }]);
});

test("offsets stay exact for indented, unclosed and tilde fences", () => {
  assert.deepEqual(blocks("&nbsp;&nbsp;```py<br>&nbsp;&nbsp;if a:<br>&nbsp;&nbsp;&nbsp; &nbsp; <u>b()</u><br>&nbsp;&nbsp;```"),
    [{ code: "if a:\n    b()", lang: "py", kind: "lines", typed: "    b()" }]);
  assert.deepEqual(blocks("```py<br>x = 1<br>y = <u>2</u>"), [{ code: "x = 1\ny = 2", lang: "py", kind: "inline", typed: "2" }]);
  assert.deepEqual(blocks("~~~py<br><u>x = 1</u><br>y = 2<br>~~~"), [{ code: "x = 1\ny = 2", lang: "py", kind: "lines", typed: "x = 1" }]);
});

test("fields stored as one <div> per line or inside <pre> work the same", () => {
  assert.deepEqual(blocks("<div>```py</div><div>x = <u>1</u></div><div>```</div>"), [{ code: "x = 1", lang: "py", kind: "inline", typed: "1" }]);
  assert.deepEqual(blocks("<pre>```py\nx = <u>1</u>\n```</pre>"), [{ code: "x = 1", lang: "py", kind: "inline", typed: "1" }]);
});

test("tabs in code are kept in the block and compared as four spaces", () => {
  assert.deepEqual(blocks(fence("c", "\tif (a)", "\t\t<u>b();</u>")), [{ code: "\tif (a)\n\t\tb();", lang: "c", kind: "lines", typed: "\t\tb();" }]);
});

test("an image inside a code block is dropped from the code", () => {
  assert.deepEqual(blocks(fence("py", 'x = <img src="a.png">1')), [{ code: "x = 1", lang: "py", kind: null }]);
});

test("the key identifies the field's content", () => {
  const key = (source: string) => renderMarkdown(field(source), true).key;
  assert.equal(key("What is `x`?"), key("What is `x`?"));
  assert.notEqual(key("What is `x`?"), key("What is `y`?"));
  assert.match(key("anything"), /^-?\d+$/);
});

test("HTML stored by Anki's editor: a typed line underlined", () => {
  assert.deepEqual(blocks(FROM_ANKI_EDITOR.lineUnderlined),
    [{ code: "def f(x):\n    if x < 1 && x > -1:\n        return 1", lang: "python", kind: "lines", typed: "        return 1" }]);
});

test("HTML stored by Anki's editor: one character underlined", () => {
  assert.deepEqual(blocks(FROM_ANKI_EDITOR.characterUnderlined), [{ code: "int x = 1;", lang: "c", kind: "inline", typed: "1" }]);
});

test("HTML stored by Anki's editor: two lines underlined", () => {
  assert.deepEqual(blocks(FROM_ANKI_EDITOR.twoLinesUnderlined), [{ code: "a = 1\nb = 2\nc = 3", lang: "py", kind: "lines", typed: "b = 2\nc = 3" }]);
});

test("HTML stored by Anki's editor: pasted snippet with a line underlined", () => {
  assert.deepEqual(blocks(FROM_ANKI_EDITOR.pastedThenUnderlined),
    [{ code: "function f(a, b) {\n    return a < b && b > 0;\n}", lang: "js", kind: "lines", typed: "    return a < b && b > 0;" }]);
});
