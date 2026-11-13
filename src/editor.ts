/* Every code block on a card is a CodeMirror 6 view. No language and no
 * highlight style are installed, so code is plain text: the only colours are
 * the ones this file asks for (marks and the typed gap). */
import {history, historyKeymap, standardKeymap} from "@codemirror/commands";
import {indentUnit} from "@codemirror/language";
import {EditorState, type Extension, Prec, type Range, StateField} from "@codemirror/state";
import {type Command, Decoration, EditorView, keymap, WidgetType} from "@codemirror/view";
import {CONFIG} from "./config.ts";
import type {Block} from "./markdown.ts";
import type {Region} from "./regions.ts";

export type Mark = Range<Decoration>;

const views: EditorView[] = [];

/* Anki replaces a card's HTML without telling the views in it, so the card
 * that was showing is cleaned up when the next one renders. */
export function destroyViews() {
    for (const view of views.splice(0)) view.destroy();
}

function create(parent: HTMLElement, doc: string, lang: string, extensions: Extension, anchor?: number) {
    const view = new EditorView({
        parent,
        state: EditorState.create({
            doc,
            selection: anchor === undefined ? undefined : {anchor},
            extensions: [
                EditorState.tabSize.of(CONFIG.indent.length),
                indentUnit.of(CONFIG.indent),
                // the fence's language is kept only as a class name, for styling if wanted
                EditorView.contentAttributes.of(lang ? {class: "language-" + lang.replace(/[^\w+#-]/g, "")} : {}),
                extensions,
            ],
        }),
    });
    views.push(view);
    return view;
}

/* ---- decorations, as the ranges readOnlyView() takes ---- */

/* `className` over characters [from, to). */
export const mark = (className: string, from: number, to: number): Mark => Decoration.mark({class: className}).range(from, to);

class Widget extends WidgetType {
    className: string;
    text: string;

    constructor(className: string, text: string) {
        super();
        this.className = className;
        this.text = text;
    }

    eq(other: Widget) {
        return other.className === this.className && other.text === this.text;
    }

    toDOM() {
        const span = document.createElement("span");
        span.className = this.className;
        span.textContent = this.text;
        span.setAttribute("aria-hidden", "true");
        return span;
    }
}

/* `text` shown at `at` in an element with `className`; it is not part of the document. */
const widget = (className: string, text: string, at: number): Mark =>
    Decoration.widget({widget: new Widget(className, text), side: 1}).range(at);

/* A visible line break (a return sign) at `at`, for a mark that covers one. */
export const returnSign = (className: string, at: number) => widget(className, "\u21B5", at);

/* ---- the views ---- */

/* A block that cannot be edited. `marks` are mark() / returnSign() ranges. */
export function readOnlyView(parent: HTMLElement, code: string, lang: string, marks: Mark[] = []) {
    create(parent, code, lang, [
        EditorState.readOnly.of(true),
        EditorView.editable.of(false),
        EditorView.decorations.of(Decoration.set(marks, true)),
    ]);
}

/* Every code block of a rendered field (see markdown.ts) as a read-only view,
 * except the one that is typed: that one is returned for the caller to build. */
export function readOnlyBlocks(blocks: Block[]): Block | undefined {
    let typed;
    for (const block of blocks) {
        if (block.region) typed = block;
        else readOnlyView(block.holder, block.code, block.lang);
    }
    return typed;
}

/* Inserts what Tab is for: CONFIG.indent, at the cursor. */
const insertIndent: Command = ({state, dispatch}) => {
    dispatch(state.update(state.replaceSelection(CONFIG.indent), {scrollIntoView: true, userEvent: "input"}));
    return true;
};

/* The block's typeable part (see regions.ts): all of it, or a gap in the
 * middle of read-only code. Only the gap can be edited. */
export function typedView(parent: HTMLElement, lang: string, {doc, kind, caret}: Region,
                          onChange: (doc: string) => void, onSubmit: () => void) {
    const whole = kind === "all";

    // The editable range, kept up to date as text is typed. Text typed at either
    // edge belongs to it. It starts as an empty spot at the caret, or as all of the text.
    const gap = StateField.define({
        create: () => (whole ? {from: 0, to: doc.length} : {from: caret, to: caret}),
        update: (range, tr) => (tr.docChanged
            ? {from: tr.changes.mapPos(range.from, -1), to: tr.changes.mapPos(range.to, 1)}
            : range),
    });
    const guard = EditorState.transactionFilter.of((tr) => {
        if (!tr.docChanged) return tr;
        const {from, to} = tr.startState.field(gap);
        let inside = true;
        tr.changes.iterChangedRanges((a, b) => {
            if (a < from || b > to) inside = false;
        });
        return inside ? tr : [];
    });

    // The gap is tinted (every line of it, for whole lines; framed, for part of a line); an empty one shows a placeholder.
    const marks = EditorView.decorations.compute([gap], (state) => {
        const {from, to} = state.field(gap);
        const ranges: Mark[] = [];
        if (kind === "lines") {
            for (let n = state.doc.lineAt(from).number; n <= state.doc.lineAt(to).number; n++) {
                ranges.push(Decoration.line({class: "cc-gap"}).range(state.doc.line(n).from));
            }
        } else if (kind === "inline" && from < to) {
            ranges.push(mark("cc-gap", from, to));
        }
        if (from === to) {
            const className = "cc-placeholder" + (kind === "inline" ? " cc-gap" : "");
            ranges.push(widget(className, whole ? CONFIG.placeholder : CONFIG.gapPlaceholder, from));
        }
        return Decoration.set(ranges, true);
    });

    const submit = () => (onSubmit(), true);

    const view = create(parent, doc, lang, [
        history(),
        keymap.of([...standardKeymap, ...historyKeymap]),
        Prec.highest(keymap.of([
            {key: "Ctrl-Enter", run: submit},
            {key: "Cmd-Enter", run: submit},
            // Enter checks in a one-line gap; everywhere else Enter starts a line and Tab indents
            kind === "inline" ? {key: "Enter", run: submit} : {key: "Tab", run: insertIndent},
        ])),
        gap,
        guard,
        marks,
        EditorView.editorAttributes.of(whole ? {class: "cc-box"} : {}),
        EditorView.contentAttributes.of({id: "code-input", "aria-label": "Your answer"}),
        EditorView.updateListener.of((update) => {
            if (update.docChanged) onChange(update.state.doc.toString());
        }),
    ], caret);
    window.setTimeout(() => view.focus(), 0);
}
