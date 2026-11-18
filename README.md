# anki-code-card

Two Anki note types:

- **Code**: type code and have it checked. `Prompt` and `Back` are ordinary Anki fields. The `Answer` field holds the expected code: it is typed into an editor under the prompt and compared with what was expected on the answer side. Fields: `Prompt`, `Answer`, `Back`.
- **Markdown**: `Front` and `Back` are written in Markdown and can hold any number of read-only code blocks. Nothing is typed. Fields: `Front`, `Back`.

Code is shown and typed in [CodeMirror 6](https://codemirror.net/), with no language support and no highlight style installed: it is plain text, never coloured.

Written for and tested on Anki desktop.

## Build

    npm install
    npm run build

Requires Node.js 22.18 or later (it runs the TypeScript build script and tests directly). The build writes everything Anki needs to `dist/`:

| File | Goes into |
|---|---|
| `dist/media/_codemirror.min.js` | the profile's `collection.media` folder (both note types) |
| `dist/media/_markdown-card.min.js` | the profile's `collection.media` folder (Markdown note type) |
| `dist/media/_code-card.min.js` | the profile's `collection.media` folder (Code note type) |
| `dist/code/front.html`, `dist/code/back.html` | Code note type > Cards > Front / Back Template |
| `dist/markdown/front.html`, `dist/markdown/back.html` | Markdown note type > Cards > Front / Back Template |
| `dist/style.css` | both note types > Cards > Styling |

`_codemirror.min.js` holds CodeMirror and the few helpers both note types use. The two card scripts are built on it: `_markdown-card.min.js` adds markdown-it and Markdown rendering, `_code-card.min.js` adds the typed answer, grading and the diff. A card loads `_codemirror.min.js` first, then its own script.

## Install

1. Copy the three scripts from `dist/media` into `collection.media` (`npm run deploy` does this for the profile `User 1`) and restart Anki.
2. Code note type > Fields: make sure `Prompt`, `Answer` and `Back` exist. Markdown note type (Tools > Manage Note Types > Add, from Basic) > Fields: `Front` and `Back`.
3. For each note type, Cards: paste its two templates and the Styling.

After a change, only the files that changed need installing again, except that the scripts must always come from the same build: a card says so if they do not. `_code-card.js`, `_markdown-it.min.js` and `_diff.min.js` from earlier versions are no longer used and can be deleted from `collection.media`.

If you do not want the `Back` field, delete the `{{#Back}}...{{/Back}}` line from `src/templates/code/back.html` (or `markdown/back.html`).

## Writing Code cards

`Prompt` and `Back` are shown as Anki shows any field: use Anki's editor for formatting, images and MathJax. `Back` is shown below the divider on the answer side, after the result.

`Answer` holds the expected code, written in Anki's editor (or its HTML editor). On the question side it is typed into a box under the prompt; Ctrl/Cmd+Enter checks. For starter code, underline (Ctrl/Cmd+U) the parts that must be typed: the box is pre-filled with everything not underlined, and the cursor starts at the first missing part.

In the editor, Tab inserts four spaces, Enter keeps the indentation of the line above, Backspace in indentation removes four spaces, and undo, redo, selection and the usual cursor keys work as in any CodeMirror editor.

The answer side shows what you typed compared against what was expected. A wrong answer is shown twice, as typed and as expected, with only the differences marked: red in what you typed, yellow in the expected code. A line break that differs is marked with a return sign. Spacing inside a line is not a mistake (see below): where it differs it is marked in grey instead, and an answer that differs only in spacing is shown as "Correct, apart from spacing".

- Comparison ignores trailing spaces, blank lines at the start and end, tabs versus four spaces, and non-breaking spaces.
- Spacing inside a line does not count either: `x=1`, `x = 1` and `x  =  1` all match. Indentation, line breaks and spacing inside quotes still count, and so does a space between two words (`int x`) or between two characters that would otherwise make a longer operator (`a - -b`). Set `ignoreSpacing: false` in `src/config.ts` to make all spacing count again.
- Quotes are only recognised within one line: in a string that spans lines, spacing on the later lines is treated like spacing in code, and a quote that is never closed (the apostrophe in `# don't`) makes spacing count for the rest of its line.
- Starter code can be edited like anything else typed. Leaving it unchanged counts as not attempted; the answer side then shows the answer with the missing parts tinted.
- Formatting in `Answer` other than underline is dropped: it is read as plain text.

## Writing Markdown cards

`Front` and `Back` are Markdown. A fenced block is a read-only code block, shown as plain text with no syntax colours, and you can have any number of them:

    Some text, `inline code`, then:

    ```python
    def add(a, b):
        return a + b
    ```

- Formatting applied with Anki's toolbar is dropped (use Markdown). Images, audio buttons and MathJax are kept.
- Text that looks like HTML (`<b>`, `<script>`) is shown literally.
- The language after the opening fence is optional. It is not used for colouring; it only becomes a class name (`language-python`) on the block's `.cm-content` element.

## Development

    npm test            type-check, build, then run every test
    npm run build       build only
    npm run typecheck   type-check only (tsc; nothing is emitted)
    npm run deploy      build, then copy the three scripts into collection.media of the profile `User 1`
    npm run clean       delete dist and node_modules, and the three scripts from that collection.media
                        (run npm install before building again)

### Layout

    src/                  the scripts, one TypeScript module per concern
      codemirror.ts       entry point of _codemirror.min.js, defines window.CardCodeMirror;
                          exposes the modules both card scripts use (CardCodeMirror.modules)
      markdown-card.ts    entry point of _markdown-card.min.js, defines window.MarkdownCard;
                          renders the Markdown note type
      code-card.ts        entry point of _code-card.min.js, defines window.CodeCard; renders
                          both sides, keeps what is typed for the answer side, and diffs it
                          (presentableDiff from @codemirror/merge)
      config.ts           options: Tab width, labels, the underline selector, whether spacing counts
      field-text.ts       field HTML to plain text, and which characters were underlined
      code.ts             normalising code for comparing, and squeezing out spacing that does not count
      editor.ts           the CodeMirror views: read-only, and the box the answer is typed in
      markdown.ts         Markdown fields, using markdown-it (in _markdown-card.min.js)
      answer.ts           the Answer field: the code to type and its starter code (in _code-card.min.js)
    src/templates/        code/ and markdown/, each with front.html and back.html, and loader.ts,
                          which is compiled and inlined into all four
    src/style.css         the Styling
    scripts/build.ts      the build
    scripts/deploy.sh     npm run deploy
    scripts/clean.sh      npm run clean
    test/                 the tests
    tsconfig.json         type checking for all of the above

### The build

- esbuild compiles each entry point and what it imports into one plain script: ES2018, minified, ASCII only.
  - `_codemirror.min.js` (about 270 kB, nearly all of it CodeMirror itself): `src/codemirror.ts`, the modules of `src` it exposes, and CodeMirror 6.
  - `_markdown-card.min.js` (about 110 kB): `src/markdown-card.ts`, `src/markdown.ts` and markdown-it.
  - `_code-card.min.js` (about 12 kB): `src/code-card.ts`, `src/answer.ts` and the diff function of `@codemirror/merge`.
  - In the two card scripts, an import of a module `_codemirror.min.js` has is pointed at `window.CardCodeMirror.modules` rather than compiled in again, so CodeMirror is on the page once. The build fails if either would get its own copy of anything the CodeMirror script has.
- The licence of every npm package whose code ends up in a script is appended to that script as a comment.
- In a template, `<script data-inline src="../loader.ts"></script>` is replaced by an inline script with that file compiled to JavaScript, because Anki templates cannot share a file. The root's `data-card` (`MarkdownCard` or `CodeCard`) says which script to load after `_codemirror.min.js` and which object renders the card.
- The first line of each script names the version it was built from; `CardCodeMirror.version`, `MarkdownCard.version` and `CodeCard.version` hold the same value. The loader checks that a card's script and `_codemirror.min.js` match before rendering, and the card shows an error if they do not.

### Common changes

- Options: `src/config.ts` (shared by both note types).
- A module of `src` both card scripts use belongs in `_codemirror.min.js`: add it to `modules` in `src/codemirror.ts`. Otherwise each card script compiles in its own copy.
- Colours and spacing: `src/style.css`.
- Updating markdown-it or CodeMirror: `npm update`, then `npm test`. Versions are pinned in `package-lock.json`.
- Adding a CodeMirror extension (line numbers, bracket matching, a language) is a change in `src/editor.ts`. Colours would also need a highlight style, which is left out on purpose.
- TypeScript is only type-checked: esbuild and Node strip the types, so use only syntax that can be erased (no `enum`, no constructor parameter properties; `tsconfig.json` enforces this). Import other modules with their `.ts` extension.
- Sources must stay ASCII (a test checks this). Write other characters as escapes, for example `\u00A0` for a non-breaking space.

### Tests

- Unit tests import the modules in `src` directly (Node strips the types), with jsdom providing the DOM.
- Card tests (`test/card.test.ts`) run the built templates and the built scripts in `test/helpers/reviewer.ts`, a small stand-in for Anki's reviewer. They type by sending transactions and key events to the real CodeMirror view (found with `EditorView.findFromDOM`); jsdom has no layout, so the stand-in gives it the `Range` measuring methods CodeMirror expects.
- Nothing here runs Anki itself or checks how a card looks. After changing templates, the Styling or keyboard handling, look at a card in Anki.
