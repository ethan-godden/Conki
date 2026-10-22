# Code note type

Fields: `Prompt`, `Answer`, `Back`.

## Build

    npm install
    npm run build

This writes everything Anki needs to `dist/`. Node.js 22 or later is required.

## Install

1. Copy `dist/media/_code-card.js` into your profile's `collection.media` folder.
2. Note type > Fields: add a field named `Back`.
3. Note type > Cards: paste `dist/front.html` into Front Template, `dist/back.html` into Back Template, `dist/style.css` into Styling.

If you do not want the `Back` field, delete the `{{#Back}}...{{/Back}}` line from the Back Template instead of step 2.

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

## Changing things

- Options are in `src/js/config.js`: Tab width, labels, the `type` word, the underline selector. Rebuild, copy `dist/media/_code-card.js` into `collection.media` again and restart Anki.
- Colours are in `src/style.css`.
- The two libraries, markdown-it and jsdiff, come from npm, pinned in `package-lock.json`, and are compiled into `_code-card.js`. Their licences are appended to that file. To update them, run `npm update`, rebuild and copy the script again.
- `_markdown-it.min.js` and `_diff.min.js` from earlier versions are no longer used and can be deleted from `collection.media`.
