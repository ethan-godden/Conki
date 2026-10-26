import assert from "node:assert/strict";
import test from "node:test";
import { field } from "./helpers/dom.js";
import { answerField, makeRegion, maskRuns, typedBlock } from "../src/js/regions.js";

/* makeRegion() for the part of `code` between the two marks "[" and "]". */
function regionOf(marked) {
  const start = marked.indexOf("[");
  const end = marked.indexOf("]") - 1;
  const code = marked.replace("[", "").replace("]", "");
  return { code, region: makeRegion(code, start, end) };
}

test("maskRuns finds each run of marked characters", () => {
  assert.deepEqual(maskRuns("0011010"), [[2, 4], [5, 6]]);
  assert.deepEqual(maskRuns("111"), [[0, 3]]);
  assert.deepEqual(maskRuns("000"), []);
  assert.deepEqual(maskRuns(""), []);
});

test("part of one line is an inline region", () => {
  const { region } = regionOf('printf([ "%d\\n" ], 42);');
  assert.deepEqual(region, { kind: "inline", start: 8, end: 14, cut: 14, indent: 0, expected: '"%d\\n"' });
});

test("whole lines are a lines region; the shared indentation is not typed", () => {
  const { code, region } = regionOf("def f():\n[    if x:\n        return 1\n]    return 2");
  assert.equal(region.kind, "lines");
  assert.equal(code.slice(region.start, region.end), "    if x:\n        return 1");
  assert.equal(code.slice(region.end, region.cut), "\n", "the line break after the lines is cut with them");
  assert.equal(region.indent, 4);
  assert.equal(region.expected, "if x:\n    return 1");
});

test("a region that starts after the indentation still covers whole lines", () => {
  const { code, region } = regionOf("if a:\n    [b()]\nc()");
  assert.equal(region.kind, "lines");
  assert.equal(code.slice(region.start, region.end), "    b()");
  assert.equal(region.indent, 4);
});

test("lines at the end of the block have no line break to cut", () => {
  const { region } = regionOf("x = 1\n[y = 2]");
  assert.equal(region.kind, "lines");
  assert.equal(region.cut, region.end);
});

test("a part that spans lines is widened to whole lines", () => {
  const { code, region } = regionOf("a = [1, [2,\n    3], 4]\nb = 2".replace("[1", "(1").replace("4]", "4)"));
  assert.equal(region.kind, "lines");
  assert.equal(code.slice(region.start, region.end), "a = (1, 2,\n    3, 4)");
});

test("the whole block is an all region and is not dedented", () => {
  const { region } = regionOf("[  x = 1\n  y = 2]");
  assert.equal(region.kind, "all");
  assert.equal(region.expected, "  x = 1\n  y = 2");
});

test("blank lines around the marked code do not stop it being the whole block", () => {
  assert.equal(regionOf("\n[x = 1]\n").region.kind, "all");
});

test("a range with only whitespace is no region", () => {
  assert.equal(makeRegion("a\n    \nb", 2, 6), null);
  assert.equal(makeRegion("", 0, 0), null);
});

test("typedBlock without underlined parts: everything is typed, no starter code", () => {
  const region = typedBlock("x = 1\ny = 2", []);
  assert.equal(region.kind, "all");
  assert.equal(region.expected, "x = 1\ny = 2");
  assert.equal(region.starter, undefined);
  assert.equal(typedBlock("  \n", []), null);
});

test("typedBlock leaves the underlined parts out of the starter code", () => {
  const code = "def f():\n    return 1";
  const region = typedBlock(code, [[13, 21]]);
  assert.equal(region.kind, "all");
  assert.equal(region.expected, code);
  assert.equal(region.starter, "def f():\n    ");
  assert.deepEqual(region.holes, [[13, 21]]);
});

test("typedBlock trims whitespace off each underlined run", () => {
  const code = "def f():\n    return 1\n";
  assert.equal(typedBlock(code, [[8, 22]]).starter, "def f():\n    \n", "run covered the line break and the indentation");
  assert.equal(typedBlock(code, [[9, 13]]).starter, undefined, "run covered only whitespace");
});

test("typedBlock supports several underlined parts", () => {
  const code = "function add(a, b) {\n  return a + b;\n}";
  const region = typedBlock(code, [[9, 12], [30, 35]]);
  assert.equal(region.starter, "function (a, b) {\n  return ;\n}");
  assert.deepEqual(region.holes, [[9, 12], [30, 35]]);
});

test("typedBlock with everything underlined is a plain typed block", () => {
  assert.equal(typedBlock("x = 1", [[0, 5]]).starter, undefined);
});

test("answerField: nothing underlined, the whole field is typed", () => {
  const { code, region } = answerField(field("def add(a, b):<br>&nbsp; &nbsp; return a + b"));
  assert.equal(code, "def add(a, b):\n    return a + b");
  assert.equal(region.kind, "all");
  assert.equal(region.expected, code);
  assert.equal(region.starter, undefined);
});

test("answerField: underlined part is left to type, the rest is starter code", () => {
  const { region } = answerField(field("x = 1<br><u>y = 2</u>"));
  assert.equal(region.expected, "x = 1\ny = 2");
  assert.equal(region.starter, "x = 1\n");
  assert.deepEqual(region.holes, [[6, 11]]);
});

test("answerField ignores blank lines around the code", () => {
  const { code, region } = answerField(field("<br><div>def f(a, b):</div><div>&nbsp; &nbsp; return <u>a + b</u></div><br>"));
  assert.equal(code, "def f(a, b):\n    return a + b");
  assert.equal(region.starter, "def f(a, b):\n    return ");
  assert.deepEqual(region.holes, [[24, 29]]);
});

test("answerField with no code has no region", () => {
  assert.equal(answerField(field("&nbsp;<br>&nbsp;")).region, null);
});
