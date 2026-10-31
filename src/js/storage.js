/* Carries the typed answer from the question side to the answer side.
 *
 * It is kept in a window variable (Anki desktop keeps the page between the two
 * sides) and in sessionStorage as a fallback, together with a key identifying
 * the card, so it is never applied to a different card. */
import { CONFIG } from "./config.js";

export function saveTyped(key, value) {
  const record = JSON.stringify({ k: key, v: value });
  window[CONFIG.storageKey] = record;
  try {
    window.sessionStorage.setItem(CONFIG.storageKey, record);
  } catch (err) { /* storage unavailable */ }
}

export function loadTyped(key) {
  try {
    const parsed = JSON.parse(window[CONFIG.storageKey] || window.sessionStorage.getItem(CONFIG.storageKey));
    return parsed && parsed.k === key && typeof parsed.v === "string" ? parsed.v : null;
  } catch (err) {
    return null;   // nothing saved, or storage unavailable
  }
}
