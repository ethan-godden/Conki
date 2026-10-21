/*
 * _code-card.js : rendering for the "Code" Anki note type.
 *
 * Lives in collection.media next to the two libraries it loads on demand:
 *   _markdown-it.min.js   markdown-it   Markdown in the Prompt and Back fields
 *   _diff.min.js          jsdiff        typed answer vs expected
 *
 * The card templates call CodeCard.render(root).
 *
 * Text from a field or from the text box reaches the page in only two ways:
 * as textContent, or through markdown-it's output, which escapes it (it runs
 * with html:false). Nothing is concatenated into HTML by hand, so there is no
 * escaping to get wrong. Code is shown as plain text, without syntax colours.
 */
(function (global) {
  "use strict";
  if (global.CodeCard) return;

  var CONFIG = {
    libs: [
      { file: "_markdown-it.min.js", global: "markdownit" },
      { file: "_diff.min.js", global: "Diff" }
    ],
    indent: "    ",          // what Tab inserts; tabs are compared as this many spaces
    typeFlag: "type",        // ```python type   -> the whole block is one text box
    typeSelector: "u",       // underlined text inside a code block is what gets typed
    storageKey: "codeTypeAnswer",
    loadTimeout: 10000,      // ms to wait for a library file before showing an error
    labels: { typed: "You typed", expected: "Expected", answer: "Answer", correct: "Correct" },
    placeholder: "Type your answer\u2026 (Ctrl/Cmd+Enter to check)",
    gapPlaceholder: "\u2026"
  };

  var doc = global.document;

  /* ------------------------------------------------------------ libraries */

  var libsReady = null;

  function loadScript(file) {
    return new Promise(function (resolve, reject) {
      var s = doc.createElement("script");
      // never leave a card blank because a request hangs
      var timer = global.setTimeout(function () { reject(new Error(file + " did not load")); }, CONFIG.loadTimeout);
      s.src = file;
      s.onload = function () { global.clearTimeout(timer); resolve(); };
      s.onerror = function () { global.clearTimeout(timer); reject(new Error(file + " is missing from collection.media")); };
      doc.head.appendChild(s);
    });
  }

  function loadLibs() {
    if (!libsReady) {
      libsReady = Promise.all(CONFIG.libs.map(function (lib) {
        if (global[lib.global]) return null;
        return loadScript(lib.file).then(function () {
          if (!global[lib.global]) throw new Error(lib.file + " did not load correctly");
        });
      }));
      libsReady.catch(function () { libsReady = null; });   // retry on the next card
    }
    return libsReady;
  }

  /* ------------------------------------------------ field HTML -> plain text
   *
   * Anki stores every field as HTML. This walks the parsed DOM (no regexes on
   * markup, no dependence on layout) and returns the text a person would read:
   *   <br>                -> line break
   *   block elements      -> start and end on their own line
   *   <pre>               -> contents kept verbatim
   *   entities            -> already decoded by the HTML parser
   *   &nbsp;              -> ordinary space
   *   a line break in the HTML source next to a <br> or block edge is source
   *   formatting and is dropped; any other source line break is kept.
   *
   * `mask` has one character per character of `text`: "1" where the text was
   * inside an element matching CONFIG.typeSelector (underlined), else "0".
   * Images, audio buttons and the like are replaced by \uE000<n>\uE001 and
   * handed back in `embeds` so they can be put back after Markdown rendering.
   */
  var BLOCK_TAGS = /^(ADDRESS|ARTICLE|ASIDE|BLOCKQUOTE|DD|DETAILS|DIV|DL|DT|FIELDSET|FIGCAPTION|FIGURE|FOOTER|FORM|H[1-6]|HEADER|HR|LI|MAIN|NAV|OL|P|PRE|SECTION|SUMMARY|TABLE|TBODY|TFOOT|THEAD|TR|UL)$/;
  var SKIP_TAGS = /^(SCRIPT|STYLE|TEMPLATE|NOSCRIPT)$/;
  var EMBED_TAGS = /^(IMG|AUDIO|VIDEO|SVG|CANVAS|IFRAME|OBJECT|EMBED|BUTTON)$/;
  var EMBED_TOKEN = /\uE000(\d+)\uE001/;

  function fieldText(root, options) {
    options = options || {};
    var markSelector = options.marks ? CONFIG.typeSelector : null;
    var text = "", mask = "", embeds = [];
    var afterBreak = true;   // nothing emitted yet, or last thing was <br> / a block edge
    var softTail = false;    // text ends with a line break that came from the HTML source

    function emit(s, marked) {
      s = s.replace(/[\u200B\uFEFF]/g, "").replace(/\u00A0/g, " ");
      if (!s) return;
      text += s;
      mask += (marked ? "1" : "0").repeat(s.length);
    }
    function hardBreak(marked) {
      if (softTail) { text = text.slice(0, -1); mask = mask.slice(0, -1); }
      emit("\n", marked);
      afterBreak = true;
      softTail = false;
    }
    function blockEdge() {
      if (text && text.charAt(text.length - 1) !== "\n") emit("\n", false);
      afterBreak = true;
      softTail = false;
    }
    function sourceText(s, marked) {
      s = s.replace(/\r\n?/g, "\n");
      if (afterBreak && s.charAt(0) === "\n") s = s.slice(1);
      if (!s) return;
      emit(s, marked);
      afterBreak = false;
      softTail = s.charAt(s.length - 1) === "\n";
    }
    function preText(s, marked) {
      emit(s.replace(/\r\n?/g, "\n"), marked);
      afterBreak = false;
      softTail = false;
    }
    function walk(node, pre, marked) {
      for (var n = node.firstChild; n; n = n.nextSibling) {
        if (n.nodeType === 3) {
          if (pre) preText(n.data, marked); else sourceText(n.data, marked);
          continue;
        }
        if (n.nodeType !== 1) continue;
        var tag = n.tagName.toUpperCase();
        if (SKIP_TAGS.test(tag)) continue;
        if (tag === "BR") { hardBreak(marked); continue; }
        if (EMBED_TAGS.test(tag) || (tag === "A" && n.classList.contains("replay-button"))) {
          if (options.embeds) {
            emit("\uE000" + embeds.length + "\uE001", false);
            embeds.push(n);
            afterBreak = false;
            softTail = false;
          }
          continue;
        }
        var block = BLOCK_TAGS.test(tag);
        if (block) blockEdge();
        if ((tag === "TD" || tag === "TH") && n.previousElementSibling) emit("\t", false);
        walk(n, pre || tag === "PRE" || tag === "TEXTAREA",
             marked || !!(markSelector && n.matches(markSelector)));
        if (block) blockEdge();
      }
    }

    walk(root, false, false);
    return { text: text, mask: mask, embeds: embeds };
  }

  /* What "the same code" means when comparing: line endings, non-breaking
   * spaces, tabs, trailing spaces and blank lines at either end are ignored. */
  function normalizeCode(s) {
    s = String(s).replace(/\r\n?/g, "\n").replace(/[\u200B\uFEFF]/g, "")
      .replace(/\u00A0/g, " ").replace(/\t/g, CONFIG.indent);
    if (s.normalize) s = s.normalize("NFC");
    return s.split("\n").map(function (line) { return line.replace(/\s+$/, ""); })
      .join("\n").replace(/^\n+|\n+$/g, "");
  }

  function dedent(s) {
    var lines = s.split("\n"), min = Infinity;
    lines.forEach(function (line) {
      if (line.trim()) min = Math.min(min, /^ */.exec(line)[0].length);
    });
    if (!isFinite(min)) min = 0;
    return {
      indent: min,
      text: lines.map(function (line) { return line.slice(min); }).join("\n")
    };
  }

  /* ---------------------------------------------------------------- markdown */

  var md = null;

  function getMd() {
    if (md) return md;
    // html:false  -> anything that looks like HTML in the text is shown literally
    // breaks:true -> a line break typed in Anki is a line break on the card
    md = global.markdownit({ html: false, breaks: true, linkify: true, typographer: false });
    md.linkify.set({ fuzzyLink: false, fuzzyEmail: false });   // only real URLs, not "main.py"

    // Leave \( ... \) and \[ ... \] alone so Anki's MathJax still sees them.
    md.inline.ruler.before("escape", "anki_math", function (state, silent) {
      var src = state.src, pos = state.pos;
      if (src.charCodeAt(pos) !== 0x5C) return false;
      var open = src.charAt(pos + 1);
      var close = open === "(" ? "\\)" : open === "[" ? "\\]" : null;
      if (!close) return false;
      var end = src.indexOf(close, pos + 2);
      if (end < 0 || end + 2 > state.posMax) return false;
      if (!silent) state.push("text", "", 0).content = src.slice(pos, end + 2);
      state.pos = end + 2;
      return true;
    });

    // Fenced blocks are built as DOM afterwards; leave a marker where they go.
    md.renderer.rules.fence = md.renderer.rules.code_block = function (tokens, idx, opts, env) {
      env.blocks.push(tokens[idx]);
      return '<div data-cc-block="' + (env.blocks.length - 1) + '"></div>\n';
    };
    return md;
  }

  function parseInfo(info) {
    var lang = "", type = false;
    String(info || "").trim().split(/\s+/).forEach(function (word) {
      if (!word) return;
      if (word.toLowerCase() === CONFIG.typeFlag) type = true;
      else if (!lang) lang = word;
    });
    return { lang: lang, type: type };
  }

  /* Which characters of a top-level fenced block were underlined in the field.
   * Returns the underlined runs as [start, end) offsets into token.content
   * (an empty list if nothing is underlined), or null when the offsets cannot
   * be trusted. The block's content is rebuilt from the source lines and
   * compared with what markdown-it produced, so offsets are only used when
   * they are known to be exact. */
  function underlinedRuns(token, lines, lineStart, mask) {
    if (token.level !== 0 || !token.map) return null;
    var first = token.map[0] + 1;
    var count = (token.content.match(/\n/g) || []).length;
    var fenceIndent = /^ */.exec(lines[token.map[0]])[0].length;
    var rebuilt = "", offsets = [];
    for (var i = 0; i < count; i++) {
      var line = lines[first + i];
      if (line === undefined) return null;
      var cut = Math.min(fenceIndent, /^ */.exec(line)[0].length);
      for (var c = cut; c <= line.length; c++) offsets.push(lineStart[first + i] + c);
      rebuilt += line.slice(cut) + "\n";
    }
    if (rebuilt !== token.content) return null;
    var inner = "";
    for (var k = 0; k < offsets.length; k++) inner += mask.charAt(offsets[k]);
    return maskRuns(inner);
  }

  /* The runs of "1" in a mask, as [start, end) pairs. */
  function maskRuns(mask) {
    var runs = [], open = -1;
    for (var k = 0; k <= mask.length; k++) {
      var on = k < mask.length && mask.charAt(k) === "1";
      if (on && open < 0) open = k;
      if (!on && open >= 0) { runs.push([open, k]); open = -1; }
    }
    return runs;
  }

  /* Turn a raw range into the typeable region of a block.
   *   all    : the whole block is typed            -> a text box replaces it
   *   lines  : whole lines inside the block        -> multi-line gap
   *   inline : part of one line                    -> single-line gap
   * A part that spans several lines is widened to whole lines. For "lines" the
   * shared indentation is not typed: the gap is shifted right instead. */
  function makeRegion(code, start, end) {
    while (start < end && /\s/.test(code.charAt(start))) start++;
    while (end > start && /\s/.test(code.charAt(end - 1))) end--;
    if (start >= end) return null;
    var lineStart = code.lastIndexOf("\n", start - 1) + 1;
    var lineEnd = code.indexOf("\n", end);
    if (lineEnd < 0) lineEnd = code.length;
    var wholeLines = !/\S/.test(code.slice(lineStart, start)) && !/\S/.test(code.slice(end, lineEnd));
    var multiLine = code.slice(start, end).indexOf("\n") >= 0;

    if (!wholeLines && !multiLine) {
      return { kind: "inline", start: start, end: end, cut: end, indent: 0,
               expected: normalizeCode(code.slice(start, end)) };
    }
    if (!/\S/.test(code.slice(0, lineStart)) && !/\S/.test(code.slice(lineEnd))) {
      return { kind: "all", start: 0, end: code.length, cut: code.length, indent: 0,
               expected: normalizeCode(code) };
    }
    var d = dedent(normalizeCode(code.slice(lineStart, lineEnd)));
    return { kind: "lines", start: lineStart, end: lineEnd,
             cut: lineEnd + (code.charAt(lineEnd) === "\n" ? 1 : 0),
             indent: d.indent, expected: d.text };
  }

  /* A block flagged `type`: one text box for the whole block. With nothing
   * underlined the box starts empty. With parts underlined, only those parts
   * are left out: the rest is put in the box as starter code, which can be
   * edited like anything else typed there. */
  function typedBlock(code, runs) {
    var region = makeRegion(code, 0, code.length);
    if (!region) return null;
    var holes = [];
    runs.forEach(function (run) {
      var start = run[0], end = Math.min(run[1], code.length);
      while (start < end && /\s/.test(code.charAt(start))) start++;
      while (end > start && /\s/.test(code.charAt(end - 1))) end--;
      if (start < end) holes.push([start, end]);
    });
    var starter = "", pos = 0;
    holes.forEach(function (hole) { starter += code.slice(pos, hole[0]); pos = hole[1]; });
    starter += code.slice(pos);
    if (holes.length && /\S/.test(starter)) {
      region.starter = starter;
      region.holes = holes;
    }
    return region;
  }

  /* The Answer field: its whole content is one typed block, shown under the
   * prompt. Underlining works as in a `type` block: underlined parts are left
   * to type and the rest is starter code; with nothing underlined, everything
   * is typed. `region` is null when the field has no code in it. */
  function answerField(el) {
    var src = fieldText(el, { marks: true });
    var start = /^\n*/.exec(src.text)[0].length;
    var end = Math.max(start, src.text.replace(/\s+$/, "").length);
    var code = src.text.slice(start, end);
    return { code: code, lang: "", region: typedBlock(code, maskRuns(src.mask.slice(start, end))) };
  }

  /* Render a Markdown field in place. Returns the fenced blocks (with a marker
   * element to replace) and a key identifying the field's content. */
  function renderMarkdown(el, allowType) {
    var src = fieldText(el, { marks: allowType, embeds: true });
    var text = src.text, mask = src.mask;
    if (text.slice(-1) !== "\n") { text += "\n"; mask += "0"; }

    var parser = getMd(), env = { blocks: [] };
    var tokens = parser.parse(text, env);

    var lines = text.split("\n"), lineStart = [], pos = 0, typeable = null;
    lines.forEach(function (line) { lineStart.push(pos); pos += line.length + 1; });

    tokens.forEach(function (token) {
      if (token.type !== "fence" && token.type !== "code_block") return;
      var info = parseInfo(token.info), runs = null;
      if (EMBED_TOKEN.test(token.content)) {
        token.content = token.content.replace(new RegExp(EMBED_TOKEN.source, "g"), "");
      } else if (allowType && !typeable && token.type === "fence") {
        runs = underlinedRuns(token, lines, lineStart, mask) || [];
      }
      var code = token.content.replace(/\n$/, ""), region = null;
      if (runs && info.type) {
        region = typedBlock(code, runs);
      } else if (runs && runs.length) {
        region = makeRegion(code, runs[0][0], Math.min(runs[runs.length - 1][1], code.length));
      }
      if (region) typeable = token;
      token.meta = { code: code, lang: info.lang, region: region };
    });

    el.innerHTML = parser.renderer.render(tokens, parser.options, env);
    restoreEmbeds(el, src.embeds);

    var blocks = [];
    Array.prototype.forEach.call(el.querySelectorAll("[data-cc-block]"), function (holder) {
      var meta = env.blocks[+holder.getAttribute("data-cc-block")].meta;
      blocks.push({ holder: holder, code: meta.code, lang: meta.lang, region: meta.region });
    });
    return { key: hash(text), blocks: blocks };
  }

  function restoreEmbeds(root, embeds) {
    if (!embeds.length) return;
    var walker = doc.createTreeWalker(root, global.NodeFilter.SHOW_TEXT), hits = [], n;
    while ((n = walker.nextNode())) if (n.data.indexOf("\uE000") >= 0) hits.push(n);
    hits.forEach(function (node) {
      var frag = doc.createDocumentFragment();
      node.data.split(EMBED_TOKEN).forEach(function (part, i) {
        if (i % 2) { if (embeds[+part]) frag.appendChild(embeds[+part]); }
        else if (part) frag.appendChild(doc.createTextNode(part));
      });
      node.parentNode.replaceChild(frag, node);
    });
  }

  function hash(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return String(h);
  }

  /* ------------------------------------------------------------- DOM helpers */

  function el(tag, className, text) {
    var node = doc.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function label(text) { return el("div", "code-label", text); }

  /* A read-only block of plain text: <pre class="code"><code>...</code></pre>.
   * The fence's language is kept only as a class name, for styling if wanted. */
  function codeBlock(code, lang) {
    var pre = el("pre", "code"), codeEl = el("code", null, code);
    if (lang) codeEl.className = "language-" + lang.replace(/[^\w+#-]/g, "");
    pre.appendChild(codeEl);
    return pre;
  }

  /* A DOM Range covering characters [start, end) of root's text. */
  function rangeAt(root, start, end) {
    var walker = doc.createTreeWalker(root, global.NodeFilter.SHOW_TEXT);
    var range = doc.createRange(), pos = 0, node, started = false;
    range.selectNodeContents(root);
    range.collapse(false);
    while ((node = walker.nextNode())) {
      var len = node.data.length;
      if (!started && start <= pos + len) { range.setStart(node, start - pos); started = true; }
      if (started && end <= pos + len) { range.setEnd(node, end - pos); return range; }
      pos += len;
    }
    return range;
  }

  /* Replace characters [start, end) of root with `node`, which ends up as a
   * direct child of root (any elements around the cut are split). When `keep`
   * is true the removed content is moved into `node`. */
  function splice(root, start, end, node, keep) {
    var range = rangeAt(root, start, end);
    var removed = range.extractContents();
    if (keep) node.appendChild(removed);
    var tail = doc.createRange();
    tail.setStart(range.startContainer, range.startOffset);
    tail.setEnd(root, root.childNodes.length);
    var rest = tail.extractContents();
    root.appendChild(node);
    root.appendChild(rest);
  }

  /* ------------------------------------------------------------------- diff */

  /* [{ k: 0 same | -1 only typed | 1 only expected, s: text }].
   * Lines are matched first, then characters inside the lines that differ. */
  function diffParts(typed, expected) {
    var Diff = global.Diff, out = [];
    function push(k, s) {
      if (!s) return;
      var last = out[out.length - 1];
      if (last && last.k === k) last.s += s; else out.push({ k: k, s: s });
    }
    function kind(change) { return change.added ? 1 : change.removed ? -1 : 0; }

    var lines = Diff.diffLines(typed, expected) || [{ removed: true, value: typed }, { added: true, value: expected }];
    for (var i = 0; i < lines.length; i++) {
      var a = lines[i], b = lines[i + 1];
      if (b && kind(a) && kind(b) === -kind(a)) {
        var mine = a.removed ? a.value : b.value, want = a.removed ? b.value : a.value;
        var chars = Diff.diffChars(mine, want, { timeout: 2000 });
        if (chars) chars.forEach(function (c) { push(kind(c), c.value); });
        else { push(-1, mine); push(1, want); }
        i++;
      } else {
        push(kind(a), a.value);
      }
    }
    return out;
  }

  function diffNodes(typed, expected) {
    var mine = doc.createDocumentFragment(), want = doc.createDocumentFragment();
    function shown(s) { return s.replace(/\n/g, "\u21B5\n"); }   // make wrong/missing line breaks visible
    diffParts(typed, expected).forEach(function (part) {
      if (part.k === 0) {
        mine.appendChild(el("span", "c-good", part.s));
        want.appendChild(doc.createTextNode(part.s));
      } else if (part.k < 0) {
        mine.appendChild(el("span", "c-bad", shown(part.s)));
      } else {
        want.appendChild(el("span", "c-missed", shown(part.s)));
      }
    });
    return { mine: mine, want: want };
  }

  /* ------------------------------------------------- typed answer, front->back */

  function saveTyped(key, value) {
    var record = JSON.stringify({ k: key, v: value });
    global[CONFIG.storageKey] = record;
    try { global.sessionStorage.setItem(CONFIG.storageKey, record); } catch (err) { /* storage unavailable */ }
  }

  function loadTyped(key) {
    var record = typeof global[CONFIG.storageKey] === "string" ? global[CONFIG.storageKey] : null;
    if (record === null) {
      try { record = global.sessionStorage.getItem(CONFIG.storageKey); } catch (err) { /* storage unavailable */ }
    }
    try {
      var parsed = JSON.parse(record);
      return parsed && parsed.k === key && typeof parsed.v === "string" ? parsed.v : null;
    } catch (err) {
      return null;
    }
  }

  /* ---------------------------------------------------------- question side */

  function inputAttributes(node) {
    node.spellcheck = false;
    node.setAttribute("autocomplete", "off");
    node.setAttribute("autocorrect", "off");
    node.setAttribute("autocapitalize", "off");
    node.setAttribute("aria-label", "Your answer");
    return node;
  }

  function fullTextarea() {
    var ta = inputAttributes(el("textarea", "code"));
    ta.id = "code-input";
    ta.setAttribute("wrap", "off");
    ta.placeholder = CONFIG.placeholder;
    return ta;
  }

  function questionBlock(block) {
    var r = block.region, input;
    if (r.kind === "all") {
      input = fullTextarea();
      if (r.starter != null) {
        input.value = r.starter;
        input.rows = r.starter.split("\n").length + 3;
      }
      return { node: input, input: input, caret: r.starter != null ? r.holes[0][0] : null };
    }
    var pre = codeBlock(block.code, block.lang);
    if (r.kind === "lines") {
      input = inputAttributes(el("textarea", "code-gap"));
      input.rows = 1;
      input.setAttribute("wrap", "off");
      input.style.marginLeft = r.indent + "ch";
      input.style.width = "calc(100% - " + r.indent + "ch)";
    } else {
      input = inputAttributes(el("input", "code-gap"));
      input.type = "text";
    }
    input.id = "code-input";
    input.placeholder = CONFIG.gapPlaceholder;
    splice(pre.firstChild, r.start, r.cut, input, false);
    return { node: pre, input: input };
  }

  function wireInput(input, key, caret) {
    var multiLine = input.tagName === "TEXTAREA";
    var gap = input.classList.contains("code-gap");
    function fit() {
      if (!gap) return;
      if (multiLine) {
        input.style.height = "auto";
        input.style.height = (input.scrollHeight + 2) + "px";
      } else {
        input.style.width = Math.max(6, input.value.length + 2) + "ch";
      }
    }
    function store() { saveTyped(key, input.value); }

    input.addEventListener("input", function () { store(); fit(); });
    input.addEventListener("keydown", function (e) {
      if (e.isComposing) return;
      var bare = !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey;
      if (e.key === "Tab" && bare && multiLine) {
        e.preventDefault();
        if (!doc.execCommand("insertText", false, CONFIG.indent)) {
          input.setRangeText(CONFIG.indent, input.selectionStart, input.selectionEnd, "end");
        }
        store();
        fit();
      } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey || !multiLine)) {
        e.preventDefault();
        store();
        if (typeof global.pycmd === "function") global.pycmd("ans");
      }
    });
    fit();
    global.setTimeout(function () {
      input.focus();
      if (caret != null) input.setSelectionRange(caret, caret);
      fit();
    }, 0);
  }

  function renderFront(root) {
    var prompt = root.querySelector('[data-part="prompt"]');
    var rendered = renderMarkdown(prompt, true), input = null, caret = null;
    rendered.blocks.forEach(function (block) {
      if (block.region) {
        var built = questionBlock(block);
        block.holder.parentNode.replaceChild(built.node, block.holder);
        input = built.input;
        caret = built.caret;
      } else {
        block.holder.parentNode.replaceChild(codeBlock(block.code, block.lang), block.holder);
      }
    });
    // Answer field: the code to type, unless the Prompt already has a typeable block.
    var answer = root.querySelector('[data-part="answer"]');
    if (answer) {
      var field = answerField(answer);
      answer.parentNode.removeChild(answer);        // the solution does not stay in the question's page
      if (!input && field.region) {
        var box = questionBlock(field);
        root.appendChild(box.node);
        input = box.input;
        caret = box.caret;
      }
    } else if (!input && root.getAttribute("data-answer")) {
      // Front Template from before the Answer field could carry starter code: empty box
      input = fullTextarea();
      root.appendChild(input);
    }
    saveTyped(rendered.key, "");
    if (input) wireInput(input, rendered.key, caret);
  }

  /* ------------------------------------------------------------ answer side */

  function regionNode(r, className) {
    return el("span", "cc-region " + className + (r.kind === "lines" ? " cc-lines" : ""));
  }

  function typedFor(region, raw) {
    if (raw == null) return "";
    var typed = normalizeCode(raw);
    if (region.kind === "lines") typed = dedent(typed).text;
    if (region.kind === "inline") typed = typed.replace(/^\s+/, "");
    return typed;
  }

  function answerBlock(block, rawTyped) {
    var r = block.region, labels = CONFIG.labels, frag = doc.createDocumentFragment();
    var whole = r.kind === "all";
    var code = whole && !r.holes ? r.expected : block.code;
    var typed = typedFor(r, rawTyped);
    var untouched = !typed || (r.starter != null && typed === normalizeCode(r.starter));
    var pre, node;

    if (untouched || typed === r.expected) {
      frag.appendChild(label(untouched ? labels.answer : labels.correct));
      pre = codeBlock(code, block.lang);
      if (untouched && r.holes) {
        // starter code was given: tint the parts that were left to type (last first, so offsets stay valid)
        r.holes.slice().reverse().forEach(function (hole) {
          splice(pre.firstChild, hole[0], hole[1], el("span", "cc-region c-answer"), true);
        });
      } else if (!untouched || !whole) {
        node = regionNode(r, untouched ? "c-answer" : "c-good");
        splice(pre.firstChild, whole ? 0 : r.start, whole ? code.length : r.cut, node, true);
      }
      frag.appendChild(pre);
      return frag;
    }

    var d = diffNodes(typed, r.expected);
    frag.appendChild(label(labels.typed));
    pre = el("pre", "code");
    pre.appendChild(d.mine);
    frag.appendChild(pre);

    frag.appendChild(label(labels.expected));
    if (whole) {
      pre = el("pre", "code");
      pre.appendChild(d.want);
    } else {
      pre = codeBlock(code, block.lang);
      node = regionNode(r, "c-expected");
      if (r.kind === "lines") node.style.paddingLeft = r.indent + "ch";
      node.appendChild(d.want);
      if (r.cut > r.end) node.appendChild(doc.createTextNode("\n"));   // the line break that was cut with the lines
      splice(pre.firstChild, r.start, r.cut, node, false);
    }
    frag.appendChild(pre);
    return frag;
  }

  function renderBack(root) {
    var prompt = root.querySelector('[data-part="prompt"]');
    var rendered = renderMarkdown(prompt, true);
    var typed = loadTyped(rendered.key), result = null;

    rendered.blocks.forEach(function (block) {
      var node = block.region ? answerBlock(block, typed) : codeBlock(block.code, block.lang);
      if (block.region) result = node.firstChild;
      block.holder.parentNode.replaceChild(node, block.holder);
    });

    // Answer field: graded here, unless the Prompt already has its typeable block.
    var answer = root.querySelector('[data-part="answer"]');
    if (answer) {
      var field = answerField(answer), node;
      if (field.region && !result) {
        node = answerBlock(field, typed);
      } else {
        node = doc.createDocumentFragment();
        if (field.region) {
          node.appendChild(label(CONFIG.labels.answer));
          node.appendChild(codeBlock(field.region.expected, ""));
        }
      }
      answer.parentNode.replaceChild(node, answer);
    }

    var back = root.querySelector('[data-part="back"]');
    if (back) {
      renderMarkdown(back, false).blocks.forEach(function (block) {
        block.holder.parentNode.replaceChild(codeBlock(block.code, block.lang), block.holder);
      });
    }

    // Anki scrolls to #answer; when the result sits inside the Prompt, point it there.
    if (result) {
      var marker = root.querySelector("#answer");
      if (marker) marker.removeAttribute("id");
      result.id = "answer";
    }
  }

  /* ------------------------------------------------------------------ entry */

  function render(root) {
    return loadLibs().then(function () {
      if (root.getAttribute("data-side") === "back") renderBack(root); else renderFront(root);
      root.classList.remove("cc-raw");
    });
  }

  global.CodeCard = {
    render: render,
    config: CONFIG,
    // exposed for testing
    fieldText: fieldText,
    normalizeCode: normalizeCode,
    diffParts: diffParts,
    makeRegion: makeRegion
  };
})(window);
