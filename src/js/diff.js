/* Typed answer versus expected code. */
import { diffChars, diffLines } from "diff";
import { el } from "./dom.js";

/* [{ k: 0 same | -1 only typed | 1 only expected, s: text }].
 * Lines are matched first, then characters inside the lines that differ. */
export function diffParts(typed, expected) {
  const out = [];
  const push = (k, s) => {
    if (!s) return;
    const last = out[out.length - 1];
    if (last && last.k === k) last.s += s;
    else out.push({ k, s });
  };
  const kind = (change) => (change.added ? 1 : change.removed ? -1 : 0);

  const lines = diffLines(typed, expected) ||
    [{ removed: true, value: typed }, { added: true, value: expected }];
  for (let i = 0; i < lines.length; i++) {
    const a = lines[i];
    const b = lines[i + 1];
    if (b && kind(a) && kind(b) === -kind(a)) {
      const mine = a.removed ? a.value : b.value;
      const want = a.removed ? b.value : a.value;
      const chars = diffChars(mine, want, { timeout: 2000 });
      if (chars) {
        for (const c of chars) push(kind(c), c.value);
      } else {
        push(-1, mine);
        push(1, want);
      }
      i++;
    } else {
      push(kind(a), a.value);
    }
  }
  return out;
}

/* The two sides of the comparison as DOM: what was typed (good / bad marks)
 * and what was expected (missed marks). */
export function diffNodes(typed, expected) {
  const mine = document.createDocumentFragment();
  const want = document.createDocumentFragment();
  const shown = (s) => s.replace(/\n/g, "\u21B5\n");   // make wrong/missing line breaks visible
  for (const part of diffParts(typed, expected)) {
    if (part.k === 0) {
      mine.appendChild(el("span", "c-good", part.s));
      want.appendChild(document.createTextNode(part.s));
    } else if (part.k < 0) {
      mine.appendChild(el("span", "c-bad", shown(part.s)));
    } else {
      want.appendChild(el("span", "c-missed", shown(part.s)));
    }
  }
  return { mine, want };
}
