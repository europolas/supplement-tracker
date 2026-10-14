# English and Lithuanian

English (`en`) is always the first-use default and missing-translation fallback.
Lithuanian (`lt`) is an explicit second option. A saved preference wins on reload;
changing this default must never silently erase an existing Lithuanian choice.
The browser's preferred language does not override this contract.

## Dictionary and API

Canonical dictionaries are `src/translations/en.js` and `lt.js` within the library.
Both export frozen plain-text objects. Application keys such as `welcome`, `version`
and `groupPwa` are semantic keys. Existing helper/API messages also use canonical
English text as keys, allowing the same translator to localize their responses.
For new API families prefer stable error codes and add their mapping explicitly.

```js
import { createI18n, dictionaries } from './modules/i18n.js';
const i18n = createI18n(); // en, with built-in en/lt dictionaries
const custom = createI18n({ en: { hello: 'Hello, {name}!' }, lt: { hello: 'Labas, {name}!' } });
custom.setLanguage('lt');
custom.t('hello', { name: user.name });
i18n.message('Save your changes first.');
const unsubscribe = i18n.subscribe(() => i18n.render(document));
```

Unknown language values are rejected. Missing Lithuanian keys fall back to English;
missing English keys display the key. Parameter insertion is plain text. render
sets document.lang and translates data-i18n plus allowlisted aria-label/title/
placeholder attributes; it does not inject HTML or translate user-entered values.

```html
<label><span data-i18n="Email">Email</span><input name="email" type="email"></label>
<button data-i18n="save">Save</button>
<nav aria-label="Main screens" data-i18n-aria-label="navLabel"></nav>
```

Never put data-i18n on a label/container that contains inputs or other interactive
children: textContent would replace them. Translate dedicated spans instead.

## Adding text

1. Add the same key and placeholders to both dictionaries. English source first.
2. Use t for app strings, message for canonical helper/API responses. Do not scatter
   literal Lithuanian labels in application code or depend on browser locale.
3. Render on language changes, including dynamic list rows and accessibility labels.
4. Pass the translator to setupAccount, createValidators and confirmDialog; pass
   i18n.language to date/number/currency formatting.
5. Test first load, persisted selection, missing-key fallback, dynamic account
   messages, labels and preservation of form values during language switching.

Native browser validation and permission dialogs use the OS/browser language and
cannot be controlled by this dictionary. Unknown system errors remain readable
original messages. Generated API responses and recovery emails default to English;
per-recipient email localization requires a server-side user language preference,
which this starter does not currently store. The original demo remains archived
with its original language; these defaults apply to the reusable starter.
