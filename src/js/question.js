/* Question side: read-only blocks, plus the editor for the typed part. */
import {readOnlyBlocks, typedView} from "./editor.js";
import {renderMarkdown} from "./markdown.js";
import {answerField} from "./regions.js";
import {CONFIG} from "./config.js";

export function renderFront(root) {
    const rendered = renderMarkdown(root.querySelector('[data-part="prompt"]'), true);
    let typed = readOnlyBlocks(rendered.blocks);   // the block that is typed: { holder, lang, region }

    // Answer field: the code to type, unless the Prompt already has a typeable block.
    const answer = root.querySelector('[data-part="answer"]');
    if (answer) {
        const field = answerField(answer);
        answer.remove();        // the solution does not stay in the question's page
        if (!typed && field.region) typed = {...field, holder: root};   // typed in a box under the prompt
    }

    if (typed) {
        typedView(typed.holder, typed, {
            onChange: (doc) => saveTyped(rendered.key, doc),
            onSubmit: () => {
                if (typeof window.pycmd === "function") window.pycmd("ans");
            },
        });
    }
    saveTyped(rendered.key, typed ? typed.region.doc : "");
}

function saveTyped(key, value) {
    const record = JSON.stringify({k: key, v: value});
    window[CONFIG.storageKey] = record;
    try {
        window.sessionStorage.setItem(CONFIG.storageKey, record);
    } catch (err) { /* storage unavailable */
    }
}

