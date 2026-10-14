# Bottom sheets

`createBottomSheet(dialog, { onDismiss?, duration? })` composes a native `<dialog>`
with the opt-in `.bottom-sheet` styles in base.css. Supply an accessible name through
aria-labelledby and a visible close button marked data-sheet-close. A non-input
heading with tabindex=-1, autofocus and data-sheet-focus avoids opening the keyboard
on presentation. An optional data-sheet-handle or data-sheet-drag header supports downward swipes.

```js
import { createBottomSheet } from './modules/index.js';
const sheet = createBottomSheet(document.querySelector('#editor'));
openButton.onclick = () => sheet.open();
// Preserve form values when dismissed; clear them only on explicit save or logout.
await sheet.close();
// When unmounting:
sheet.destroy();
```

Native modal focus containment makes the background inert and returns focus on
close. Escape, close buttons and handle swipes request dismissal. A downward swipe on noninteractive content at scrollTop=0 also dismisses;
upward movement and scrolled content retain normal scrolling. Mark a larger header
with data-sheet-drag to allow dismissal even when scrolled. iOS touchmove is
non-passive only to intercept eligible downward pulls before Safari cancels pointer events; backdrop taps do not discard work. Reduced-motion preference
skips animations. Rapid reopen cancels a pending close. No window observers/timers,
private persistence or document-wide event handlers are introduced.

For routed sheets, onDismiss requests a route change; the route handler must call
close() when leaving. Logout can close({immediate:true}). The caller owns browser
Back, the underlying page/scroll, dirty form confirmation and data lifetime. Reuse
one dialog per route surface or nest native dialogs for a confirmation. Preserve
safe-area padding and the shared --app-height variable, and test on an installed
iPhone: software keyboard, rotation, long content, focus restoration and swipes.

Confirmations can use `confirmDialog(message, { i18n, presentation: 'sheet' })`.
The default remains a centered dialog. Both paths resolve a boolean and remove
owned DOM/listeners after completion; the sheet waits for its exit transition.
