/* Inlined into both card templates by the build (Anki templates cannot share
 * a file). Loads _code-card.js from collection.media once per session, then
 * renders the card; on failure it shows why and reveals the raw fields. */
(function () {
  var root = document.getElementById("cc");
  function fail(err) {
    root.classList.remove("cc-raw");
    var note = document.createElement("div");
    note.className = "cc-error";
    note.textContent = "Code card: " + (err && err.message ? err.message : err);
    root.insertBefore(note, root.firstChild);
  }
  var done = new Promise(function (resolve, reject) {
    if (window.CodeCard) { resolve(); return; }
    var s = document.createElement("script");
    s.src = "_code-card.js";
    s.onload = function () { resolve(); };
    s.onerror = function () { reject(new Error("_code-card.js is missing from collection.media")); };
    setTimeout(function () { reject(new Error("_code-card.js did not load")); }, 10000);
    document.head.appendChild(s);
  }).then(function () { return CodeCard.render(root); }).catch(fail);
  // Anki keeps the card hidden (and delays MathJax) until this settles.
  if (typeof onUpdateHook !== "undefined") onUpdateHook.push(function () { return done; });
})();
