# Mobile controls, startup and safe updates

The optional controls came from Supplement Tracker; no supplement rules, account
records or credentials are included. Import `index.js` and `styles/base.css`.
English is default, Lithuanian is explicit. Pass the app's shared i18n instance.
Core DOM is rendered with textContent, never provider HTML. Examples are available
in the starter's Modules page and `starter/components-demo.js`; they are local-only.

## Sheets and design

`createSheet({title,i18n,document?,onDismiss?})` creates a native bottom sheet and
returns `{dialog,content,heading,open,close,setTitle,destroy}`. It reuses
`createBottomSheet`, including nested focus, swipe dismissal, keyboard height,
reduced motion and file-picker cancellation protection. Destroy removes its DOM.
Use `onDismiss:()=>sheet.close()` when no extra policy is required. An application
must explicitly decide how to discard unsaved data. Header title and X share a row;
footer actions scroll normally. `.kit-actions-pair` gives equal-width buttons.

`.kit-card`, `.kit-tabs`, `.kit-choices`, `.kit-history-row` provide consistent
spacing/type, native integer/date inputs and a 20px checkbox. `.kit-mobile` on body
opts into the calm surface/mobile gutters; `.kit-nav` on an existing navigation
opts into the floating bar. `createMobileNavigation({root,items,onNavigate})`
accepts `{route,label,icon?}` (a caller-owned safe SVG node), plus select/destroy.
The host still owns routing, translated aria-label and tab visibility. Default
starter design remains compatible; its gallery can toggle the mobile variant.
Keyboard focus remains visible; pointer focus does not leave an outline.

`createProgress(root).update({value,total,busy,label})` supports determinate values
or smooth back-and-forth indeterminate movement; reduced-motion disables movement.
No timer/private persistence is introduced by the progress component.

## Draft-only choices and wizard

```js
const choices=createSelectionSheet({title:i18n.t('interests'),i18n,
 options:[{id:'music',label:i18n.t('music')}],max:3,
 onSave:ids=>{ draft.interests=ids; }});
await choices.open(draft.interests); // opening/closing never saves
// choices.close(); choices.destroy();

const wizard=createWizard({title:i18n.t('setup'),i18n,
 steps:[{title:i18n.t('about'),render({root,value,change}) {
   // Render native fields; change({name:newName}) changes this in-memory draft.
   // Return cleanup if the step owns nested controls/listeners/watchers.
 },validate:value=>value.name?true:i18n.t('nameRequired')}],
 onSave:draft=>api.put('/settings', {draft,revision}),
 confirmDiscard:()=>confirmDialog(i18n.t('discard'),{i18n,presentation:'sheet'})});
await wizard.open(savedValue);
```

Choice IDs are stable; unspecified is an empty selection. max:1 behaves like a
single-choice control. Exceeding max disables only unselected alternatives. Save
awaits the callback and keeps the draft on failure. A wizard has explicit Save,
all-step validation, cancellable discard and cleanup. Validation may be async.
Use `wizard.dirty`, `wizard.busy`, `choices.dirty/busy` in reload guards. Reset or
destroy on owner change. Callback endpoints must recheck authenticated ownership,
consent and revisions; UI guards are not authorization. Callback failures should
use safe localized errors. Recreate controls on language change when appropriate;
do not translate by replacing a DOM container that contains an edited field.

## Read-only activity calendar and pause editor

`createActivityCalendar({root,read,i18n,onItem,today?})` offers week/month and
all/done/pending/missed/paused filters. `open/refresh` calls
`read({from,to,timeZone,signal})`; return `{days:[{day,future,total,counts,items}]}`.
Items have `{id,name,subtitle,category:{id,name}|null,status}`. Pass day-specific
category snapshots, never substitute the current category for missing history.
`reset/destroy` abort reads and clears private DOM; caller handles item navigation.
The server `buildActivityHistory` provides a matching pure projection; see WORKFLOWS.

`createPauseEditor({i18n,onSave})` opens with a pause record or null. It offers
manual resumption or a native date field, plus Resume for existing pauses. Callback
receives `{paused,resumeOn,timeZone}`; the server validates the date. No auto write
occurs on open or cancellation. `busy/dirty/destroy` follow the same lifecycle.

## Progress, decisions and reports

`createJobMonitor({root,read,i18n,interval?,onRetry?,onState?})` reads jobs through
`read({owner,signal})`, returning an array or `{jobs}`. Job records include
`id,type/title,status,phase,total,processed,items,error?`. `open(owner)` resets the
session view. close stops polling; reset clears private DOM. Queued/running work is
polled, complete/failed work is not. Retry is explicit and host-defined, never an
automatic paid retry. Job persistence is provided by the server service, not DOM.

`createProposalReview({root,i18n,onDecision,onChanged?})` has set/reset/destroy and
busy. Each `{id,name,subtitle,from,to,reason,status}` gets independent Accept/Remove.
Await `onDecision(item,action)` before removing it. Return `{items}` to replace the
pending list, otherwise only the acknowledged item disappears. Server validation
and transactionality are required (see createProposalService).

`createReportView({root,read,generate,i18n,sections,interval?,onProposals?})` has
open/refresh/close/reset/destroy/busy. read returns `{ready,active,error,report}`;
report is `{sections:{key:text},stale,proposals}`. The sections map supplies localized
headings. Only Generate calls generate(); closing cancels reads, not server work.
A failed regeneration preserves the last report. Pair onProposals with a separate
proposal-review root. The host decides report format and whether sources display.

## Loading screen and automatic updates

`createLoadingScreen({root?,i18n,onRetry,document?})` exposes show(label),
progress(percent,label), hide, fail(safeMessage), destroy. A supplied root can exist
in HTML before the module loads. fail replaces endless waiting with an explicit
retry action. The starter's classic startup.js applies only public display
preferences before paint and has a 20s failure fallback for broken module loading.
No passwords/profile state are read by the startup script. It uses EN/LT copies of
its two fallback strings because a failed module cannot import the dictionary.

`setupPwa({autoUpdate:true,canReload,startupTimeout:4000,onUpdate,onError})`
is opt-in in the library; the starter enables it ONLY while its loading screen is
visible. Await setupPwa, then `await pwa.waitForStartup()` and call
`pwa.finishStartup()` BEFORE hiding the loading screen. This irreversibly closes
that document's launch window. The bounded budget includes worker registration,
checking, install/activation; blocked/offline registration cannot trap the splash.
If the budget expires, launch the current version. Late results may announce a
manual update, but cannot reopen automatic activation or reload.

Auto activation also requires visible/online state and a true canReload guard.
The starter guards dirty settings/account forms, password drafts, dialogs and tasks.
There is ONE app-initiated startup check: no interval, foreground, online or idle
update checks/reloads. Returning from the background is not a new launch. An update
found later, including another tab activating a worker, never reloads a running app.
A manual Update button may still explicitly apply it after canReload permits it.
First install does not reload. Destroy removes listeners and startup timers. Existing
apps must adopt the loading-screen integration explicitly; no consumer is silently
upgraded. Test installed iPhone keyboard/rotation/offline behavior before release.
