import assert from "node:assert/strict";
import test from "node:test";
import { field } from "./helpers/dom.ts";
import { normalizeCode } from "../src/code.ts";
import { fieldText } from "../src/field-text.ts";

const code = (html: string) => normalizeCode(fieldText(field(html)).text);

/* Field HTML in the shapes Anki produces or accepts, and the code it stands for. */
const ENCODINGS = [
  ["typed in Anki's editor", "def add(a, b):<br>&nbsp; &nbsp; return a + b", "def add(a, b):\n    return a + b"],
  ["pasted as plain text", "for (i = 0; i &lt; n; i++) {<br>&nbsp;&nbsp;&nbsp; total += xs[i];<br>}", "for (i = 0; i < n; i++) {\n    total += xs[i];\n}"],
  ["HTML editor, line break after <br>", "a<br>\nb<br>\n&nbsp;&nbsp;c", "a\nb\n  c"],
  ["line breaks in the source, no <br>", "a\nb\n    c", "a\nb\n    c"],
  ["<pre> block", "<pre>a\n  b\n</pre>", "a\n  b"],
  ["entities", "if (a &lt; b &amp;&amp; c &gt; d) {<br>}", "if (a < b && c > d) {\n}"],
  ["blank lines", "x = 1<br><br><br>y = 2", "x = 1\n\n\ny = 2"],
  ["pasted with colours", '<span style="color: red">def</span> <b>f</b>():<br>&nbsp;&nbsp;&nbsp;&nbsp;pass', "def f():\n    pass"],
  ["single leading space after <br>", "/**<br> * doc<br> */", "/**\n * doc\n */"],
  ["tags typed as text", "&lt;script&gt;alert(1)&lt;/script&gt;", "<script>alert(1)</script>"],
  ["entities typed as text", "a &amp;amp; b &amp;lt; c", "a &amp; b &lt; c"],
  ["<br> variants", "line1<br />line2<BR>line3", "line1\nline2\nline3"],
  ["one <div> per line, with source line breaks", "<div>line1</div>\n<div>line2</div>\n", "line1\nline2"],
  ["one <div> per line", "<div>a</div><div>&nbsp; b</div><div>c</div>", "a\n  b\nc"],
  ["line break plus blank line after <br>", "a<br>\n\nb", "a\n\nb"],
  ["paragraphs", "<p>a</p><p>b</p>", "a\nb"],
  ["text, then a <div>", "a<div>b</div>", "a\nb"],
  ["<div> ending in <br>", "<div>a<br></div><div>b</div>", "a\nb"],
  ["empty line as <div><br></div>", "<div>a</div><div><br></div><div>b</div>", "a\n\nb"],
  ["line break in the source before <br>", "a\n<br>b", "a\nb"],
  ["field starting with <br> and spaces", "<br>  x = 1  <br>  ", "  x = 1"],
  ["tab", "a\tb", "a    b"],
  ["zero-width space", "x\u200B = 1", "x = 1"],
  ["zero-width space between a source line break and <br>", "a\n\u200B<br>b", "a\nb"],
  ["zero-width space between <br> and a source line break", "a<br>\u200B\nb", "a\nb"],
  ["<script> element in the field", "<script>var x = 1;</script>code", "code"],
  ["list", "<ul><li>a</li><li>b</li></ul>", "a\nb"],
  ["table", "<table><tr><td>a</td><td>b</td></tr><tr><td>c</td><td>d</td></tr></table>", "a    b\nc    d"],
];

for (const [name, html, expected] of ENCODINGS) {
  test(`field HTML to code: ${name}`, () => assert.equal(code(html), expected));
}

test("mask marks the underlined characters, one mask character per text character", () => {
  const { text, mask } = fieldText(field("x = <u>1</u><br><u>y</u> = 2"), { marks: true });
  assert.equal(text, "x = 1\ny = 2");
  assert.equal(mask, "00001010000");
});

test("an underlined line break is marked too", () => {
  const { text, mask } = fieldText(field("a<br><u>b<br>c</u>"), { marks: true });
  assert.equal(text, "a\nb\nc");
  assert.equal(mask, "00111");
});

test("mask stays all zeros unless marks are asked for", () => {
  assert.equal(fieldText(field("<u>ab</u>c")).mask, "000");
});

test("mask stays aligned when characters are dropped or replaced", () => {
  const { text, mask } = fieldText(field("a\u200B<u>&nbsp;b</u>\n<br>c"), { marks: true });
  assert.equal(text, "a b\nc");
  assert.equal(mask, "01100");
});

test("images and audio buttons become placeholders when embeds are kept", () => {
  const el = field('see <img src="a.png"> and <a class="replay-button soundLink" href="#">play</a>!');
  const { text, embeds } = fieldText(el, { embeds: true });
  assert.equal(text, "see \uE0000\uE001 and \uE0001\uE001!");
  assert.deepEqual(embeds.map((node) => node.tagName), ["IMG", "A"]);
});

test("images are dropped when embeds are not kept", () => {
  assert.equal(fieldText(field('a<img src="a.png">b')).text, "ab");
});
