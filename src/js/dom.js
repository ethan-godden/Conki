/* Small DOM helpers. Text always goes in through textContent. */

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

export function label(text) {
  return el("div", "code-label", text);
}

/* A read-only block of plain text: <pre class="code"><code>...</code></pre>.
 * The fence's language is kept only as a class name, for styling if wanted. */
export function codeBlock(code, lang) {
  const pre = el("pre", "code");
  const codeEl = el("code", null, code);
  if (lang) codeEl.className = "language-" + lang.replace(/[^\w+#-]/g, "");
  pre.appendChild(codeEl);
  return pre;
}

/* A DOM Range covering characters [start, end) of root's text. */
function rangeAt(root, start, end) {
  const walker = document.createTreeWalker(root, window.NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let pos = 0;
  let started = false;
  let node;
  range.selectNodeContents(root);
  range.collapse(false);
  while ((node = walker.nextNode())) {
    const len = node.data.length;
    if (!started && start <= pos + len) {
      range.setStart(node, start - pos);
      started = true;
    }
    if (started && end <= pos + len) {
      range.setEnd(node, end - pos);
      return range;
    }
    pos += len;
  }
  return range;
}

/* Replace characters [start, end) of root with `node`, which ends up as a
 * direct child of root (any elements around the cut are split). When `keep`
 * is true the removed content is moved into `node`. */
export function splice(root, start, end, node, keep) {
  const range = rangeAt(root, start, end);
  const removed = range.extractContents();
  if (keep) node.appendChild(removed);
  const tail = document.createRange();
  tail.setStart(range.startContainer, range.startOffset);
  tail.setEnd(root, root.childNodes.length);
  const rest = tail.extractContents();
  root.appendChild(node);
  root.appendChild(rest);
}
