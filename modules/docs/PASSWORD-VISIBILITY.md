# Password visibility

Copy `examples/password-visibility.js` into your app/browser modules and import
`setupPasswordVisibility`. It enhances existing inputs without replacing them;
autocomplete, validation, form names/values and caret remain native. Each button
uses type=button, aria-pressed, a localized action label and decorative eye SVG.
No password value is read, stored, logged or copied to another element.

```js
const visibility = setupPasswordVisibility(accountRoot, {
  selector: '#login-form input[type=password], #register-form input[type=password]',
  getLabel: shown => i18n.t(shown ? 'appHidePassword' : 'appShowPassword'),
  subscribe: listener => i18n.subscribe(listener)
});
// Translate these two keys in the app's English/Lithuanian dictionaries.
// Also call reset on tab changes, sheet closure and authentication changes.
visibility.reset();
// On unmount: remove listeners/subscription/wrappers, restore masking.
visibility.destroy();
```

The input must be inside a form/label as usual. Style `.password-field` relative,
its input with right padding >=52px, and `.password-toggle` absolute at right:3px,
top:50%, transform:translateY(-50%). Use a 44x44px touch target, transparent
background, inherited theme color, 22px SVG with opacity:.8 and a visible keyboard
focus outline. Keep password managers/autofill enabled. Repeated setup skips
already wrapped fields. Form reset remasks automatically; hidden tabs and sheet
lifecycle require explicit reset calls by the app.

Validated in supplement-tracker browser flows: login and both registration fields,
value/caret retention, autocomplete, no request on toggle, form/tab/logout reset,
English/Lithuanian labels, and screenshots in light/dark themes.
