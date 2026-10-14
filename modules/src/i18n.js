/**
 * English/Lithuanian dictionaries, interpolation, subscriptions and DOM translation.
 * English is always default/fallback. Translation strings are plain text; tag spans inside labels so rendering preserves inputs.
 * Integration contracts: ../docs/MODULES.md and ../docs/ARCHITECTURE.md.
 */
import en from './translations/en.js';
import lt from './translations/lt.js';

/** English is the default and fallback. Explicit choices are persisted by settings, not browser detection. */
export const dictionaries = Object.freeze({ en, lt });
export function createI18n(messages = dictionaries, initial = 'en') {
  let language = initial;
  const listeners = new Set();
  const hasLanguage = value => ['en', 'lt'].includes(value) && Object.hasOwn(messages, value);
  if (!hasLanguage(language) || !Object.hasOwn(messages, 'en')) throw new TypeError('English dictionary and a supported language are required');
  function t(key, values = {}) {
    // Never interpret translation strings or interpolated user names as HTML.
    const text = Object.hasOwn(messages[language], key) ? messages[language][key] : Object.hasOwn(messages.en, key) ? messages.en[key] : key;
    return String(text).replace(/\{(\w+)\}/g, (_, name) => Object.hasOwn(values, name) ? String(values[name]) : '{' + name + '}');
  }
  return {
    get language() { return language; },
    setLanguage(value) { if (!hasLanguage(value)) throw new TypeError('Unsupported language'); if (value === language) return; language = value; for (const listener of [...listeners]) listener(value); },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    t,
    // Shared helper/API errors use canonical English text; unknown messages stay readable.
    message(text, values = {}) { const key = Object.hasOwn(messages.en, text) ? text : Object.keys(messages.en).find(key => messages.en[key] === text); return t(key ?? text, values); },
    render(root = globalThis.document) {
      if (root.documentElement) root.documentElement.lang = language;
      for (const node of root.querySelectorAll('[data-i18n]')) node.textContent = t(node.dataset.i18n);
      // Keep attributes explicitly allowlisted, and tag text spans rather than labels containing inputs.
      for (const attribute of ['aria-label', 'title', 'placeholder']) for (const node of root.querySelectorAll(`[data-i18n-${attribute}]`)) node.setAttribute(attribute, t(node.getAttribute(`data-i18n-${attribute}`)));
    }
  };
}
