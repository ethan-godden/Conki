# anki-code-card

Two Anki note types:

- **Code**: for code. `Prompt` and `Back` are written in Markdown and can hold any number of read-only code blocks. One block per card can be typed, in whole or in part, and is compared with the expected code on the answer side. Fields: `Prompt`, `Answer`, `Back`.
- **Markdown**: the same Markdown and read-only code blocks, with nothing to type. Fields: `Front`, `Back`.

Code is shown and typed in [CodeMirror 6](https://codemirror.net/), with no language support and no highlight style installed: it is plain text, never coloured.

Written for and tested on Anki desktop.

## Build

    npm install
    npm run build

Requires Node.js 22.18 or later (it runs the TypeScript build script and tests directly). The build writes everything Anki needs to `dist/`:

| File | Goes into |
|---|---|
| `dist/media/_markdown-card.min.js` | the profile's `collection.media` folder (both note types) |
| `dist/media/_code-card.min.js` | the profile's `collection.media` folder (Code note type) |
| `dist/code/front.html`, `dist/code/back.html` | Code note type > Cards > Front / Back Template |
| `dist/markdown/front.html`, `dist/markdown/back.html` | Markdown note type > Cards > Front / Back Template |
| `dist/style.css` | both note types > Cards > Styling |

`_markdown-card.min.js` holds Markdown rendering and CodeMirror; `_code-card.min.js` holds only what the Code note type adds (the `Answer` field, keeping what was typed, grading and the diff) and is built on it, so the Code templates load both, the markdown one first.

## Install

1. Copy both scripts from `dist/media` into `collection.media` (`npm run deploy` does this for the profile `User 1`) and restart Anki.
2. Code note type > Fields: make sure `Prompt`, `Answer` and `Back` exist. Markdown note type (Tools > Manage Note Types > Add, from Basic) > Fields: `Front` and `Back`.
3. For each note type, Cards: paste its two templates and the Styling.

After a change, only the files that changed need installing again, except that the two scripts must always come from the same build: a Code card says so if they do not. `_code-card.js`, `_markdown-it.min.js` and `_diff.min.js` from earlier versions are no longer used and can be deleted from `collection.media`. The Code templates changed when the script was split in two; install them again together with both scripts.

If you do not want the `Back` field, delete the `{{#Back}}...{{/Back}}` line from `src/templates/code/back.html` (or `markdown/back.html`).

## Writing cards

`Prompt` and `Back` (in the Markdown note type, `Front` and `Back`) are Markdown. A fenced block is a read-only code block, shown as plain text with no syntax colours, and you can have any number of them:

    Some text, `inline code`, then:

    ```python
    def add(a, b):
        return a + b
    ```

To make code typeable (one block per card, Code note type only):

| What is typed | How to mark it | On the card |
|---|---|---|
| The whole block | add `type` after the language: ```` ```python type ```` | editor in place of the block, Ctrl/Cmd+Enter checks |
| The whole block, from starter code | add `type`, and underline only what must be typed | the same editor, pre-filled with everything not underlined; cursor at the first missing part |
| Whole lines of a block | underline them in Anki's editor (Ctrl/Cmd+U), no `type` | multi-line gap in read-only code, Ctrl/Cmd+Enter checks |
| Part of one line | underline it, no `type` | one-line gap in read-only code, Enter checks |

In an editor, Tab inserts four spaces (not in a one-line gap, where it is left alone), Enter keeps the indentation of the line above, Backspace in indentation removes four spaces, and undo, redo, selection and the usual cursor keys work as in any CodeMirror editor.

The answer side shows the block again with what you typed compared against what was expected. A wrong answer is shown twice, as typed and as expected, with only the differences marked: red in what you typed, yellow in the expected code. A line break that differs is marked with a return sign. Spacing inside a line is not a mistake (see below): where it differs it is marked in grey instead, and an answer that differs only in spacing is shown as "Correct, apart from spacing".

- `Back` is shown below the divider on the answer side and is never typed. Use it for the answer of a card with no typing, or for an explanation.
- `Answer` is the simple way to ask for a whole typed answer: its content is the expected code, typed into a box under the prompt. For starter code, underline the part that must be typed; everything not underlined is pre-filled. If the Prompt already has a typeable block, `Answer` is shown read-only instead.

## Rules worth knowing

- Comparison ignores trailing spaces, blank lines at the start and end, tabs versus four spaces, and non-breaking spaces.
- Spacing inside a line does not count either: `x=1`, `x = 1` and `x  =  1` all match. Indentation, line breaks and spacing inside quotes still count, and so does a space between two words (`int x`) or between two characters that would otherwise make a longer operator (`a - -b`). Set `ignoreSpacing: false` in `src/config.ts` to make all spacing count again.
- Quotes are only recognised within one line: in a string that spans lines, spacing on the later lines is treated like spacing in code, and a quote that is never closed (the apostrophe in `# don't`) makes spacing count for the rest of its line.
- A gap is part of the code: you see the rest of the block around it, and only the gap can be edited. In a multi-line gap the cursor starts after the indentation the hidden lines share, so you do not type it.
- Without `type`: an underlined part that spans several lines is widened to whole lines, and several underlined runs in one block make one gap, from the first to the last.
- With `type`, and in the `Answer` field: every underlined run is left out of the starter code, and the starter code can be edited. Leaving it unchanged counts as not attempted; the answer side then shows the answer with the missing parts tinted.
- Only the first marked block on a card is typeable. A block nested inside a list can only be marked with `type`, and gets no starter code.
- Formatting applied with Anki's toolbar is dropped (use Markdown), except underline inside a code block. Images, audio buttons and MathJax are kept.
- Text that looks like HTML (`<b>`, `<script>`) is shown literally.
- The language after the opening fence is optional. It is not used for colouring; it only becomes a class name (`language-python`) on the block's `.cm-content` element.

## Development

    npm test            type-check, build, then run every test
    npm run build       build only
    npm run typecheck   type-check only (tsc; nothing is emitted)

### Layout

    src/                  the script, one TypeScript module per concern
      markdown-card.ts    entry point of _markdown-card.min.js, defines window.MarkdownCard;
                          renders the Markdown note type, and exposes the modules below
                          (MarkdownCard.modules) for the code card's script
      code-card.ts        entry point of _code-card.min.js, defines window.CodeCard; renders
                          both sides, keeps what is typed for the answer side, and diffs it
                          (presentableDiff from @codemirror/merge)
      config.ts           options: Tab width, labels, the `type` word, the underline selector,
                          whether spacing counts
      field-text.ts       field HTML to plain text, and which characters were underlined
      code.ts             normalising code for comparing, and squeezing out spacing that does not count
      regions.ts          which part of a block is typed (the Region and CodeBlock types);
                          starter code; the Answer field
      markdown.ts         Markdown fields, using markdown-it
      editor.ts           the CodeMirror views: read-only, and the typed block with its gap
    src/templates/        code/ and markdown/, each with front.html and back.html, and loader.ts,
                          which is compiled and inlined into all four
    src/style.css         the Styling
    scripts/build.ts      the build
    test/                 the tests
    tsconfig.json         type checking for all of the above

### The build

- esbuild compiles each entry point and what it imports into one plain script: ES2018, minified, ASCII only.
  - `_markdown-card.min.js` (about 380 kB, most of it CodeMirror itself): `src/markdown-card.ts`, the modules of `src` it exposes, markdown-it and CodeMirror 6.
  - `_code-card.min.js` (about 12 kB): `src/code-card.ts` and the diff function of `@codemirror/merge`. Its imports of other modules of `src` are pointed at `window.MarkdownCard.modules` rather than bundled, so CodeMirror is on the page once. The build fails if this script would get its own copy of anything the markdown script has.
- The licence of every npm package whose code ends up in a script is appended to that script as a comment.
- In a template, `<script data-inline src="../loader.ts"></script>` is replaced by an inline script with that file compiled to JavaScript, because Anki templates cannot share a file. The root's `data-card` (`MarkdownCard` or `CodeCard`) says which scripts to load and which object renders the card.
- The first line of each script names the version it was built from; `MarkdownCard.version` and `CodeCard.version` hold the same value, and a Code card refuses to render if they differ.

### Common changes

- Options: `src/config.ts` (shared by both note types).
- A new module of `src` that `code-card.ts` imports must also be added to `modules` in `src/markdown-card.ts`.
- Colours and spacing: `src/style.css`.
- Updating markdown-it or CodeMirror: `npm update`, then `npm test`. Versions are pinned in `package-lock.json`.
- Adding a CodeMirror extension (line numbers, bracket matching, a language) is a change in `src/editor.ts`. Colours would also need a highlight style, which is left out on purpose.
- TypeScript is only type-checked: esbuild and Node strip the types, so use only syntax that can be erased (no `enum`, no constructor parameter properties; `tsconfig.json` enforces this). Import other modules with their `.ts` extension.
- Sources must stay ASCII (a test checks this). Write other characters as escapes, for example `\u00A0` for a non-breaking space.

### Tests

- Unit tests import the modules in `src` directly (Node strips the types), with jsdom providing the DOM.
- Card tests (`test/card.test.ts`) run the built templates and the built script in `test/helpers/reviewer.ts`, a small stand-in for Anki's reviewer. They type by sending transactions and key events to the real CodeMirror view (found with `EditorView.findFromDOM`); jsdom has no layout, so the stand-in gives it the `Range` measuring methods CodeMirror expects.
- Nothing here runs Anki itself or checks how a card looks. After changing templates, the Styling or keyboard handling, look at a card in Anki.
