/* Every code block on a card is a CodeMirror 6 view. No language and no
 * highlight style are installed, so code is plain text: the only colours are
 * the ones this file asks for (marks and the typed gap). */
import { history, historyKeymap, standardKeymap } from "@codemirror/commands";
import { indentUnit } from "@codemirror/language";
import { EditorState, Prec, StateField } from "@codemirror/state";
import { Decoration, EditorView, keymap, WidgetType } from "@codemirror/view";
import { CONFIG } from "./config.js";

let views = [];

/* Anki replaces a card's HTML without telling the views in it, so the card
 * that was showing is cleaned up when the next one renders. */
export function destroyViews() {
  for (const view of views.splice(0)) view.destroy();
}

function create(parent, doc, lang, selection, extensions) {
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc,
      selection,
      extensions: [
        EditorState.tabSize.of(CONFIG.indent.length),
        indentUnit.of(CONFIG.indent),
        // the fence's language is kept only as a class name, for styling if wanted
        EditorView.contentAttributes.of(lang ? { class: "language-" + lang.replace(/[^\w+#-]/g, "") } : {}),
        extensions,
      ],
    }),
  });
  views.push(view);
  return view;
}

/* ---- decorations, as the ranges readOnlyView() takes ---- */

/* `className` over characters [from, to). */
export const mark = (className, from, to) => Decoration.mark({ class: className }).range(from, to);

class Widget extends WidgetType {
  constructor(className, text) {
    super();
    this.className = className;
    this.text = text;
  }
  eq(other) { return other.className === this.className && other.text === this.text; }
  toDOM() {
    const span = document.createElement("span");
    span.className = this.className;
    span.textContent = this.text;
    span.setAttribute("aria-hidden", "true");
    return span;
  }
}

/* A visible line break (a return sign) at `at`, for a mark that covers one. */
export const returnSign = (className, at) =>
  Decoration.widget({ widget: new Widget(className, "\u21B5"), side: 1 }).range(at);

/* ---- the views ---- */

/* A block that cannot be edited. `marks` are mark() / returnSign() ranges. */
export function readOnlyView(parent, code, lang, marks = []) {
  return create(parent, code, lang, undefined, [
    EditorState.readOnly.of(true),
    EditorView.editable.of(false),
    EditorView.decorations.of(Decoration.set(marks, true)),
  ]);
}

/* Inserts what Tab is for: CONFIG.indent, at the cursor. */
function insertIndent({ state, dispatch }) {
  dispatch(state.update(state.replaceSelection(CONFIG.indent), { scrollIntoView: true, userEvent: "input" }));
  return true;
}

/* The block's typeable part (see regions.js): all of it, or a gap in the
 * middle of read-only code. Only the gap can be edited. */
export function typedView(parent, { lang, region }, { onChange, onSubmit }) {
  const { doc, edit, kind } = region;
  const partial = edit[0] > 0 || edit[1] < doc.length;

  // The editable range, kept up to date as text is typed. Text typed at either
  // edge belongs to it.
  const gap = StateField.define({
    create: () => ({ from: edit[0], to: edit[1] }),
    update: (range, tr) => (tr.docChanged
      ? { from: tr.changes.mapPos(range.from, -1), to: tr.changes.mapPos(range.to, 1) }
      : range),
  });
  const guard = EditorState.transactionFilter.of((tr) => {
    if (!tr.docChanged) return tr;
    const { from, to } = tr.startState.field(gap);
    let inside = true;
    tr.changes.iterChangedRanges((a, b) => { if (a < from || b > to) inside = false; });
    return inside ? tr : [];
  });

  // The gap is tinted (every line of it, for whole lines; framed, for part of a line); an empty one shows a placeholder.
  const marks = EditorView.decorations.compute([gap], (state) => {
    const { from, to } = state.field(gap);
    const ranges = [];
    if (kind === "lines") {
      for (let n = state.doc.lineAt(from).number; n <= state.doc.lineAt(to).number; n++) {
        ranges.push(Decoration.line({ class: "cc-gap" }).range(state.doc.line(n).from));
      }
    } else if (kind === "inline" && from < to) {
      ranges.push(mark("cc-gap", from, to));
    }
    if (from === to) {
      const className = "cc-placeholder" + (kind === "inline" ? " cc-gap" : "");
      ranges.push(Decoration.widget({ widget: new Widget(className, partial ? CONFIG.gapPlaceholder : CONFIG.placeholder), side: 1 }).range(from));
    }
    return Decoration.set(ranges, true);
  });

  const submit = () => {
    onSubmit();
    return true;
  };
  const keys = [{ key: "Ctrl-Enter", run: submit }, { key: "Cmd-Enter", run: submit }];
  keys.push(kind === "inline" ? { key: "Enter", run: submit } : { key: "Tab", run: insertIndent });

  const view = create(parent, doc, lang, { anchor: region.caret }, [
    history(),
    keymap.of([...standardKeymap, ...historyKeymap]),
    Prec.highest(keymap.of(keys)),
    gap,
    guard,
    marks,
    EditorView.editorAttributes.of(partial ? {} : { class: "cc-box" }),
    EditorView.contentAttributes.of({ id: "code-input", "aria-label": "Your answer" }),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) onChange(update.state.doc.toString());
    }),
  ]);
  window.setTimeout(() => view.focus(), 0);
  return view;
}
