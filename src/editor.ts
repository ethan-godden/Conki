/* Every code block on a card is a CodeMirror 6 view. No language and no
 * highlight style are installed, so code is plain text: the only colours are
 * the ones this file is asked for (marks). */
import {history, historyKeymap, standardKeymap} from "@codemirror/commands";
import {indentUnit} from "@codemirror/language";
import {EditorState, type Extension, Prec, type Range} from "@codemirror/state";
import {type Command, Decoration, EditorView, keymap, placeholder, WidgetType} from "@codemirror/view";
import {CONFIG} from "./config.ts";

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

/* A return sign in an element with `className`; it is not part of the document. */
class ReturnSign extends WidgetType {
    className: string;

    constructor(className: string) {
        super();
        this.className = className;
    }

    eq(other: ReturnSign) {
        return other.className === this.className;
    }

    toDOM() {
        const span = document.createElement("span");
        span.className = this.className;
        span.textContent = "\u21B5";
        span.setAttribute("aria-hidden", "true");
        return span;
    }
}

/* A visible line break (a return sign) at `at`, for a mark that covers one. */
export const returnSign = (className: string, at: number): Mark =>
    Decoration.widget({widget: new ReturnSign(className), side: 1}).range(at);

/* ---- the views ---- */

/* A block that cannot be edited. `marks` are mark() / returnSign() ranges. */
export function readOnlyView(parent: HTMLElement, code: string, lang: string, marks: Mark[] = []) {
    create(parent, code, lang, [
        EditorState.readOnly.of(true),
        EditorView.editable.of(false),
        EditorView.decorations.of(Decoration.set(marks, true)),
    ]);
}

/* Inserts what Tab is for: CONFIG.indent, at the cursor. */
const insertIndent: Command = ({state, dispatch}) => {
    dispatch(state.update(state.replaceSelection(CONFIG.indent), {scrollIntoView: true, userEvent: "input"}));
    return true;
};

/* The editor the answer is typed in: a box, starting with `doc` (empty, or
 * starter code) and the cursor at `caret`. Tab indents, Enter starts a line,
 * Ctrl/Cmd+Enter calls onSubmit. */
export function typedView(parent: HTMLElement, doc: string, caret: number, onChange: (doc: string) => void, onSubmit: () => void) {
    const submit = () => (onSubmit(), true);

    const view = create(parent, doc, "", [
        history(),
        keymap.of([...standardKeymap, ...historyKeymap]),
        Prec.highest(keymap.of([
            {key: "Ctrl-Enter", run: submit},
            {key: "Cmd-Enter", run: submit},
            {key: "Tab", run: insertIndent},
        ])),
        placeholder(CONFIG.placeholder),   // while it is empty
        EditorView.editorAttributes.of({class: "cc-box"}),
        EditorView.contentAttributes.of({id: "code-input", "aria-label": "Your answer"}),
        EditorView.updateListener.of((update) => {
            if (update.docChanged) onChange(update.state.doc.toString());
        }),
    ], caret);
    window.setTimeout(() => view.focus(), 0);
}
