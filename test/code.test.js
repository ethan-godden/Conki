import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCode } from "../src/js/code.js";

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
