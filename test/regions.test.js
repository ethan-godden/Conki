import assert from "node:assert/strict";
import test from "node:test";
import { field } from "./helpers/dom.js";
import { answerField, makeRegion, maskRuns, typedBlock, wholeRegion } from "../src/js/regions.js";

/* makeRegion() for the part of `code` between the two marks "[" and "]". */
function regionOf(marked) {
  const start = marked.indexOf("[");
  const end = marked.indexOf("]") - 1;
  const code = marked.replace("[", "").replace("]", "");
  return { code, region: makeRegion(code, start, end) };
}

/* The part of the code that is typed. */
const typed = ({ code, region }) => code.slice(...region.gap);

test("maskRuns finds each run of marked characters", () => {
  assert.deepEqual(maskRuns("0011010"), [[2, 4], [5, 6]]);
  assert.deepEqual(maskRuns("111"), [[0, 3]]);
  assert.deepEqual(maskRuns("000"), []);
  assert.deepEqual(maskRuns(""), []);
});

test("part of one line is an inline gap: the editor holds the line without it", () => {
  const found = regionOf('printf([ "%d\\n" ], 42);');
  const { code, region } = found;
  assert.equal(region.kind, "inline");
  assert.equal(typed(found), '"%d\\n"');
  assert.equal(region.doc, 'printf(  , 42);');
  assert.equal(region.caret, 8, "the typed part goes where the cursor starts");
  assert.equal(region.expected, code);
});

test("whole lines are a lines gap; the indentation they share stays in the code", () => {
  const found = regionOf("def f():\n[    if x:\n        return 1\n]    return 2");
  const { code, region } = found;
  assert.equal(region.kind, "lines");
  assert.equal(typed(found), "    if x:\n        return 1", "whole lines, indentation included");
  assert.equal(region.doc, "def f():\n    \n    return 2", "the editor starts after the indentation they share");
  assert.equal(region.caret, 13);
  assert.equal(region.expected, code);
});

test("the indentation lines share is measured in characters, tabs included", () => {
  assert.equal(regionOf("if a:\n[\t\tb()]").region.doc, "if a:\n\t\t");
  const found = regionOf("x:\n[    a\n  b]\ny");
  assert.equal(typed(found), "    a\n  b");
  assert.equal(found.region.doc, "x:\n  \ny", "only what all the lines share is left in the code");
});

test("a region that starts after the indentation still covers whole lines", () => {
  const found = regionOf("if a:\n    [b()]\nc()");
  assert.equal(found.region.kind, "lines");
  assert.equal(typed(found), "    b()");
  assert.equal(found.region.doc, "if a:\n    \nc()");
});

test("lines at the end of the block have nothing after them", () => {
  const found = regionOf("x = 1\n[y = 2]");
  assert.equal(found.region.kind, "lines");
  assert.equal(found.region.doc, "x = 1\n");
  assert.deepEqual(found.region.gap, [6, 11]);
});

test("a part that spans lines is widened to whole lines", () => {
  const found = regionOf("a = [1, [2,\n    3], 4]\nb = 2".replace("[1", "(1").replace("4]", "4)"));
  assert.equal(found.region.kind, "lines");
  assert.equal(typed(found), "a = (1, 2,\n    3, 4)");
  assert.equal(found.region.doc, "\nb = 2");
});

test("the whole block is an all region and is not dedented", () => {
  const { code, region } = regionOf("[  x = 1\n  y = 2]");
  assert.equal(region.kind, "all");
  assert.equal(region.expected, "  x = 1\n  y = 2");
  assert.equal(region.doc, "", "the editor starts empty");
  assert.equal(region.caret, 0);
  assert.deepEqual(region.gap, [0, code.length]);
});

test("blank lines around the marked code do not stop it being the whole block", () => {
  assert.equal(regionOf("\n[x = 1]\n").region.kind, "all");
});

test("a range with only whitespace is no region", () => {
  assert.equal(makeRegion("a\n    \nb", 2, 6), null);
  assert.equal(makeRegion("", 0, 0), null);
});

test("expected is normalised: tabs, trailing spaces, blank lines at the ends", () => {
  assert.equal(regionOf("\n[\tx = 1  ]\n").region.expected, "    x = 1");
});

test("wholeRegion is an empty editor for a whole block", () => {
  assert.deepEqual(wholeRegion(""), { kind: "all", expected: "", doc: "", caret: 0, gap: [0, 0] });
});

test("typedBlock without underlined parts: everything is typed, no starter code", () => {
  const region = typedBlock("x = 1\ny = 2", []);
  assert.equal(region.kind, "all");
  assert.equal(region.expected, "x = 1\ny = 2");
  assert.equal(region.doc, "");
  assert.equal(region.holes, undefined);
  assert.equal(typedBlock("  \n", []), null);
});

test("typedBlock leaves the underlined parts out of the starter code", () => {
  const code = "def f():\n    return 1";
  const region = typedBlock(code, [[13, 21]]);
  assert.equal(region.kind, "all");
  assert.equal(region.expected, code);
  assert.equal(region.doc, "def f():\n    ", "the starter code");
  assert.equal(region.caret, 13, "the cursor starts at the missing part");
  assert.deepEqual(region.holes, [[13, 21]]);
});

test("typedBlock trims whitespace off each underlined run", () => {
  const code = "def f():\n    return 1\n";
  assert.equal(typedBlock(code, [[8, 22]]).doc, "def f():\n    \n", "run covered the line break and the indentation");
  assert.equal(typedBlock(code, [[9, 13]]).holes, undefined, "run covered only whitespace");
  assert.equal(typedBlock("x = 1", [[0, 99]]).holes, undefined, "run reached past the end");
});

test("typedBlock supports several underlined parts", () => {
  const code = "function add(a, b) {\n  return a + b;\n}";
  const region = typedBlock(code, [[9, 12], [30, 35]]);
  assert.equal(region.doc, "function (a, b) {\n  return ;\n}");
  assert.deepEqual(region.holes, [[9, 12], [30, 35]]);
  assert.equal(region.caret, 9);
});

test("typedBlock with everything underlined is a plain typed block", () => {
  assert.equal(typedBlock("x = 1", [[0, 5]]).holes, undefined);
  assert.equal(typedBlock("x = 1", [[0, 5]]).doc, "");
});

test("answerField: nothing underlined, the whole field is typed", () => {
  const { code, region } = answerField(field("def add(a, b):<br>&nbsp; &nbsp; return a + b"));
  assert.equal(code, "def add(a, b):\n    return a + b");
  assert.equal(region.kind, "all");
  assert.equal(region.expected, code);
  assert.equal(region.doc, "");
});

test("answerField: underlined part is left to type, the rest is starter code", () => {
  const { region } = answerField(field("x = 1<br><u>y = 2</u>"));
  assert.equal(region.expected, "x = 1\ny = 2");
  assert.equal(region.doc, "x = 1\n");
  assert.deepEqual(region.holes, [[6, 11]]);
});

test("answerField ignores blank lines around the code", () => {
  const { code, region } = answerField(field("<br><div>def f(a, b):</div><div>&nbsp; &nbsp; return <u>a + b</u></div><br>"));
  assert.equal(code, "def f(a, b):\n    return a + b");
  assert.equal(region.doc, "def f(a, b):\n    return ");
  assert.deepEqual(region.holes, [[24, 29]]);
});

test("answerField with no code has no region", () => {
  assert.equal(answerField(field("&nbsp;<br>&nbsp;")).region, null);
});
