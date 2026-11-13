import assert from "node:assert/strict";
import test from "node:test";
import { cleanText, normalizeCode, squeezeSpacing } from "../src/code.ts";

const same = (a: string, b: string) => squeezeSpacing(normalizeCode(a)) === squeezeSpacing(normalizeCode(b));

test("squeezeSpacing: spacing inside a line does not count where it cannot change the code", () => {
  for (const [a, b] of [["x=1", "x = 1"], ["f( a, b )", "f(a,b)"], ["if (x) {", "if(x){"], ["a  =  1", "a = 1"],
    ["int *p", "int* p"], ["x = -1", "x =-1"], ["a && !b", "a&&!b"], ["def f() -> int:", "def f()->int:"]]) {
    assert.ok(same(a, b), `${a} matches ${b}`);
  }
});

test("squeezeSpacing: indentation, quotes, and spacing that splits words or operators still count", () => {
  for (const [a, b] of [["    x", "  x"], ["a\nb", "a b"], ["int x", "intx"], ['"a b"', '"a  b"'], ["c == ' '", "c == ''"],
    ["a - -b", "a--b"], ["i + +j", "i++j"], ["a / *p", "a /*p"], ["x * = 2", "x *= 2"]]) {
    assert.ok(!same(a, b), `${a} does not match ${b}`);
  }
});

test("squeezeSpacing: a quote that is not closed keeps the rest of its line as it is", () => {
  assert.equal(squeezeSpacing("x = 1  # don't  panic"), "x=1#don't  panic");
});

test("cleanText removes only what cannot be seen", () => {
  assert.equal(cleanText("a\r\nb\rc"), "a\nb\nc", "line endings");
  assert.equal(cleanText("a\u00A0b"), "a b", "non-breaking spaces");
  assert.equal(cleanText("x\u200B\uFEFFy"), "xy", "zero-width characters");
  assert.equal(cleanText("\tx  \n\n"), "\tx  \n\n", "tabs, trailing spaces and blank lines are left to normalizeCode");
});

test("normalizeCode ignores what should not count as a difference", () => {
  assert.equal(normalizeCode("a\r\nb\rc"), "a\nb\nc", "line endings");
  assert.equal(normalizeCode("a\u00A0=\u00A01"), "a = 1", "non-breaking spaces");
  assert.equal(normalizeCode("\tif x:\n\t\ty()"), "    if x:\n        y()", "tabs become four spaces");
  assert.equal(normalizeCode("a = 1   \nb = 2\t"), "a = 1\nb = 2", "trailing whitespace");
  assert.equal(normalizeCode("\n\n  a\n\nb\n\n\n"), "  a\n\nb", "blank lines at either end, not inside");
  assert.equal(normalizeCode("x\u200B = \uFEFF1"), "x = 1", "zero-width characters");
  assert.equal(normalizeCode("e\u0301"), "\u00E9", "composed and decomposed accents");
});

test("normalizeCode keeps what is part of the code", () => {
  assert.equal(normalizeCode("  indented first line"), "  indented first line");
  assert.equal(normalizeCode("a  =  1"), "a  =  1");
  assert.equal(normalizeCode('print("<b>&amp;</b>")'), 'print("<b>&amp;</b>")');
});
