# anki-code-card

An Anki note type for code. `Prompt` and `Back` are written in Markdown and can hold any number of read-only code blocks. One block per card can be typed, in whole or in part, and is compared with the expected code on the answer side.

Fields: `Prompt`, `Answer`, `Back`. Written for and tested on Anki desktop.

## Build

    npm install
    npm run build

Requires Node.js 22 or later. The build writes everything Anki needs to `dist/`:

| File | Goes into |
|---|---|
| `dist/media/_code-card.js` | the profile's `collection.media` folder |
| `dist/front.html` | note type > Cards > Front Template |
| `dist/back.html` | note type > Cards > Back Template |
| `dist/style.css` | note type > Cards > Styling |

## Install

1. Copy `dist/media/_code-card.js` into `collection.media` and restart Anki.
2. Note type > Fields: make sure `Prompt`, `Answer` and `Back` exist.
3. Note type > Cards: paste the two templates and the Styling.

After a change, only the files that changed need installing again. `_markdown-it.min.js` and `_diff.min.js` from earlier versions are no longer used and can be deleted from `collection.media`.

If you do not want the `Back` field, delete the `{{#Back}}...{{/Back}}` line from `src/templates/back.html`.

## Writing cards

`Prompt` and `Back` are Markdown. A fenced block is a read-only code block, shown as plain text with no syntax colours, and you can have any number of them:

    Some text, `inline code`, then:

    ```python
    def add(a, b):
        return a + b
    ```

To make code typeable (one block per card):

| What is typed | How to mark it | On the card |
|---|---|---|
| The whole block | add `type` after the language: ```` ```python type ```` | text box in place of the block, Ctrl/Cmd+Enter checks |
| The whole block, from starter code | add `type`, and underline only what must be typed | the same text box, pre-filled with everything not underlined; cursor at the first missing part |
| Whole lines of a block | underline them in Anki's editor (Ctrl/Cmd+U), no `type` | multi-line gap in read-only code, Ctrl/Cmd+Enter checks |
| Part of one line | underline it, no `type` | one-line gap in read-only code, Enter checks |

The answer side shows the block again with what you typed compared against the hidden part.

- `Back` is shown below the divider on the answer side and is never typed. Use it for the answer of a card with no typing, or for an explanation.
- `Answer` is the simple way to ask for a whole typed answer: its content is the expected code, typed into a box under the prompt. For starter code, underline the part that must be typed; everything not underlined is pre-filled. If the Prompt already has a typeable block, `Answer` is shown read-only instead.

## Rules worth knowing

- Comparison ignores trailing spaces, blank lines at the start and end, tabs versus four spaces, and non-breaking spaces.
- In a multi-line gap you do not type the indentation the hidden lines share; the gap is already indented.
- Without `type`: an underlined part that spans several lines is widened to whole lines, and several underlined runs in one block make one gap, from the first to the last.
- With `type`, and in the `Answer` field: every underlined run is left out of the starter code, and the starter code can be edited. Leaving it unchanged counts as not attempted; the answer side then shows the answer with the missing parts tinted.
- Only the first marked block on a card is typeable. A block nested inside a list can only be marked with `type`, and gets no starter code.
- Formatting applied with Anki's toolbar is dropped (use Markdown), except underline inside a code block. Images, audio buttons and MathJax are kept.
- Text that looks like HTML (`<b>`, `<script>`) is shown literally.
- The language after the opening fence is optional. It is not used for colouring; it only becomes a class name (`language-python`) on the block.

## Development

    npm test          build, then run every test
    npm run build     build only

### Layout

    src/js/               the script, one module per concern
      index.js            entry point, defines window.CodeCard
      config.js           options: Tab width, labels, the `type` word, the underline selector
      field-text.js       field HTML to plain text, and which characters were underlined
      code.js             normalising and dedenting code
      regions.js          which part of a block is typed; starter code; the Answer field
      markdown.js         Markdown fields, using markdown-it
      dom.js              element helpers; cutting text out of a block
      diff.js             typed versus expected, using jsdiff
      storage.js          the typed answer, carried from question side to answer side
      question.js         question side
      answer.js           answer side
    src/templates/        front.html, back.html, and loader.js, which is inlined into both
    src/style.css         the Styling
    scripts/build.mjs     the build
    test/                 the tests

### The build

- esbuild compiles `src/js` and the two libraries it imports into one plain script: ES2018, minified, ASCII only.
- The licence of every npm package that ends up in the script is appended to it as a comment.
- In a template, `<script data-inline src="loader.js"></script>` is replaced by an inline script with that file's contents, because Anki templates cannot share a file.
- The first line of `dist/media/_code-card.js` names the version it was built from; `CodeCard.version` holds the same value.

### Common changes

- Options: `src/js/config.js`.
- Colours and spacing: `src/style.css`.
- Updating markdown-it or jsdiff: `npm update`, then `npm test`. Versions are pinned in `package-lock.json`.
- Sources must stay ASCII (a test checks this). Write other characters as escapes, for example `\u00A0` for a non-breaking space.

### Tests

- Unit tests import the modules in `src/js` directly, with jsdom providing the DOM.
- Card tests (`test/card.test.js`) run the built templates and the built script in `test/helpers/reviewer.js`, a small stand-in for Anki's reviewer.
- Nothing here runs Anki itself or checks how a card looks. After changing templates, the Styling or keyboard handling, look at a card in Anki.
