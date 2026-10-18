# Nullable accessible ratings

`createRatingGroup({root,label,labels,value?,allowClear?,renderOption?,onChange?})`
creates a radio group with 2–10 labelled options. The value is null (unset) or a
one-based option index. Provide English/Lithuanian strings from the host translator;
the control has no domain text, emoji, medical interpretation or automatic writes.

```js
const rating=createRatingGroup({root,label:i18n.t('sleep'),
 labels:[1,2,3,4,5].map(n=>i18n.t('rating',{value:n,total:5})),
 value:null, renderOption:()=>safeCircleIcon(), onChange:value=>draft.sleep=value});
rating.setValue(4); // display only; no callback/write
rating.setDisabled(true);
rating.destroy();
```

Clicking a selected option clears it by default. Arrow keys wrap/select and
Home/End jump/select; only the selected option (or first unset option) is in the
Tab order. Enter/Space use native button activation. Host CSS styles the root,
buttons and aria-checked state, and must retain an accessible focus indication.
Artwork must be caller-owned safe DOM with decorative aria-hidden, never raw HTML.
Destroy releases listeners and DOM; reset on date/account/language transitions.
