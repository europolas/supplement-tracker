# Compact text previews

`compactText(value, { maxWords: 6, maxLength: 80 })` collapses whitespace and bounds
plain-text preview length without mutating the full value. It prefers whole words,
handles Unicode code points and appends an ellipsis only when content was omitted.
Limits must be integers, maxWords >= 1 and maxLength >= 2. Null becomes empty text.

```js
import { compactText } from '@europolas/app-modules/text';
preview.textContent = compactText(record.summary || record.description);
// Keep record.description unchanged for the detail view.
```

This does not produce new meaning or translate/sanitize markup. Prefer a separately
stored, validated short summary; use this only to constrain display or support older
records. Untrusted strings must still use textContent, never innerHTML. No resources,
subscriptions, persistence or cleanup. Defaults are locale-independent; English and
Lithuanian text are treated identically, without changing the saved language.

`productLabel({name, manufacturer, variant})` returns presentation fields `name`,
`manufacturer`, `variant`. It strips an explicit brand prefix (also NOW for NOW Foods)
and moves a trailing strength/form or numeric packaging parentheses below the title.
No serving math, AI calls, source mutation or medical inference occurs. Brand aliases
are conservative; unknown qualifiers remain intact. Render each field with textContent.
