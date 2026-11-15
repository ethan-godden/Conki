/* Entry point of _codemirror.min.js, which defines window.CardCodeMirror:
 * CodeMirror, and the modules of src both note types use, for the scripts
 * built on it.
 *
 * CodeMirror can only be on a page once, so _markdown-card.min.js and
 * _code-card.min.js do not bundle it, nor any module listed here: the build
 * points their imports of these at `modules` instead (see scripts/build.ts).
 * This script has to load first. */
import * as code from "./code.ts";
import * as config from "./config.ts";
import * as editor from "./editor.ts";
import * as fieldText from "./field-text.ts";

declare const __VERSION__: string;   // filled in by the build

declare global {
    interface Window {
        CardCodeMirror?: typeof CardCodeMirror;
    }
}

/* Keyed by file name, as the modules are imported in src. */
const modules = {
    "code.ts": code,
    "config.ts": config,
    "editor.ts": editor,
    "field-text.ts": fieldText,
};

const CardCodeMirror = {version: __VERSION__, modules};
window.CardCodeMirror ??= CardCodeMirror;

