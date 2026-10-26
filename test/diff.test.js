import assert from "node:assert/strict";
import test from "node:test";
import { field } from "./helpers/dom.js";
import { diffNodes, diffParts } from "../src/js/diff.js";

/* Compact form: unchanged text as is, [-only typed-], {+only expected+}. */
const show = (typed, expected) => diffParts(typed, expected)
  .map(({ k, s }) => (k === 0 ? s : k < 0 ? `[-${s}-]` : `{+${s}+}`)).join("");

test("identical text is one unchanged part", () => {
  assert.deepEqual(diffParts("a = 1\nb = 2", "a = 1\nb = 2"), [{ k: 0, s: "a = 1\nb = 2" }]);
});

test("a wrong character is marked on its own", () => {
  assert.equal(show("def add(a, b):\n    return a - b", "def add(a, b):\n    return a + b"),
    "def add(a, b):\n    return a [---]{+++} b");
});

test("a typo inside a word marks only the characters that differ", () => {
  assert.equal(show("recieve", "receive"), "rec[-i-]e{+i+}ve");
});

test("a missing line is marked as a whole line, not spread over its neighbours", () => {
  assert.equal(show("int main() {\n    return 0;\n}", 'int main() {\n    printf("hi");\n    return 0;\n}'),
    'int main() {\n{+    printf("hi");\n+}    return 0;\n}');
});

test("an extra line is marked as a whole line", () => {
  assert.equal(show("x = 1\nprint(x)\nreturn x", "x = 1\nreturn x"), "x = 1\n[-print(x)\n-]return x");
});

test("a line break in the wrong place is marked", () => {
  assert.equal(show("if (x)\n{\n}", "if (x) {\n}"), "if (x)[-\n-]{+ +}{\n}");
});

test("nothing in common", () => {
  assert.equal(show("abc", "xyz"), "[-abc-]{+xyz+}");
});

test("diffNodes: good and bad marks on what was typed, missed marks on what was expected", () => {
  const { mine, want } = diffNodes("a - b", "a + b");
  const typed = field("");
  const expected = field("");
  typed.appendChild(mine);
  expected.appendChild(want);
  assert.equal(typed.innerHTML, '<span class="c-good">a </span><span class="c-bad">-</span><span class="c-good"> b</span>');
  assert.equal(expected.innerHTML, 'a <span class="c-missed">+</span> b');
});

test("diffNodes makes wrong and missing line breaks visible", () => {
  const { mine, want } = diffNodes("a\nb", "a b\nc");
  assert.match(mine.textContent, /\u21B5\n/);
  assert.match(want.textContent, /\u21B5\n/);
});

test("diffNodes never turns text into markup", () => {
  const { mine, want } = diffNodes("<img src=x onerror=alert(1)>", "<b>x</b>");
  assert.equal(mine.querySelectorAll("img, b").length + want.querySelectorAll("img, b").length, 0);
  assert.equal(mine.textContent, "<img src=x onerror=alert(1)>");
});
