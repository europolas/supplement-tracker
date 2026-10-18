# Module contracts and ownership

The catalog below links every functional module to its source. File comments explain
the contract; feature guides explain integration. Data-only translations are not
additional feature modules. Browser index exports do not include server/worker code.

| Module | Public surface | Guide |
| --- | --- | --- |
| [config](../src/config.js) | `createConfig` | [ARCHITECTURE.md](ARCHITECTURE.md) |
| [viewport](../src/viewport.js) | `setupViewport` | [IPHONE.md](IPHONE.md) |
| [gestures](../src/gestures.js) | `setupGestures` | [IPHONE.md](IPHONE.md) |
| [pwa](../src/pwa.js) | `setupPwa` | [ARCHITECTURE.md](ARCHITECTURE.md) |
| [worker](../src/worker.js) | `installWorker` | [ARCHITECTURE.md](ARCHITECTURE.md) |
| [api](../src/api.js) | `createApi / HttpError` | [BACKEND.md](BACKEND.md) |
| [auth](../src/auth.js) | `createAuth` | [BACKEND.md](BACKEND.md) |
| [auth-screen](../src/auth-screen.js) | `setupAccount / account.html` | [BACKEND.md](BACKEND.md) |
| [storage](../src/storage.js) | `createStorage` | [ARCHITECTURE.md](ARCHITECTURE.md) |
| [daily-log](../src/daily-log.js) | `localDay / createDailyLog` | [DAILY-LOG.md](DAILY-LOG.md) |
| [database](../src/database.js) | `openDatabase` | [ARCHITECTURE.md](ARCHITECTURE.md) |
| [outbox](../src/outbox.js) | `createOutbox` | [ARCHITECTURE.md](ARCHITECTURE.md) |
| [drafts](../src/drafts.js) | `createDrafts` | [ARCHITECTURE.md](ARCHITECTURE.md) |
| [store](../src/store.js) | `createStore` | [ARCHITECTURE.md](ARCHITECTURE.md) |
| [events](../src/events.js) | `createEvents` | [ARCHITECTURE.md](ARCHITECTURE.md) |
| [settings](../src/settings.js) | `createSettings` | [ARCHITECTURE.md](ARCHITECTURE.md) |
| [router](../src/router.js) | `createRouter` | [ARCHITECTURE.md](ARCHITECTURE.md) |
| [forms](../src/forms.js) | `bindForm / readForm / trackDirty` | [ARCHITECTURE.md](ARCHITECTURE.md) |
| [validation](../src/validation.js) | `validate / validators / createValidators` | [LOCALIZATION.md](LOCALIZATION.md) |
| [bottom-sheet](../src/bottom-sheet.js) | `createBottomSheet` | [BOTTOM-SHEET.md](BOTTOM-SHEET.md) |
| [ui](../src/ui.js) | `element / createToast / confirmDialog / setStatus` | [ARCHITECTURE.md](ARCHITECTURE.md) |
| [theme](../src/theme.js) | `createTheme` | [ARCHITECTURE.md](ARCHITECTURE.md) |
| [i18n](../src/i18n.js) | `createI18n / dictionaries` | [LOCALIZATION.md](LOCALIZATION.md) |
| [network](../src/network.js) | `watchNetwork` | [ARCHITECTURE.md](ARCHITECTURE.md) |
| [capabilities](../src/capabilities.js) | `capabilities / permissionState` | [ARCHITECTURE.md](ARCHITECTURE.md) |
| [notifications](../src/notifications.js) | `subscribePush / unsubscribePush / notificationSupport / keyBytes` | [ARCHITECTURE.md](ARCHITECTURE.md) |
| [ntfy](../src/ntfy.js) | `createNtfy` | [ARCHITECTURE.md](ARCHITECTURE.md) |
| [files](../src/files.js) | `validateFile / uploadFile / previewFile / downloadBlob / exportJson / importJson` | [ARCHITECTURE.md](ARCHITECTURE.md) |
| [media](../src/media.js) | `openCamera / takePhoto` | [ARCHITECTURE.md](ARCHITECTURE.md) |
| [geolocation](../src/geolocation.js) | `locate / watchLocation` | [ARCHITECTURE.md](ARCHITECTURE.md) |
| [clipboard](../src/clipboard.js) | `copyText` | [ARCHITECTURE.md](ARCHITECTURE.md) |
| [share](../src/share.js) | `share` | [ARCHITECTURE.md](ARCHITECTURE.md) |
| [search](../src/search.js) | `filterItems / sortItems` | [ARCHITECTURE.md](ARCHITECTURE.md) |
| [pagination](../src/pagination.js) | `paginate` | [ARCHITECTURE.md](ARCHITECTURE.md) |
| [time](../src/time.js) | `formatDate / formatNumber / formatMoney / relativeTime` | [LOCALIZATION.md](LOCALIZATION.md) |
| [tasks](../src/tasks.js) | `singleFlight / debounce / retry` | [ARCHITECTURE.md](ARCHITECTURE.md) |
| [resources](../src/resources.js) | `createResource` | [ARCHITECTURE.md](ARCHITECTURE.md) |
| [logger](../src/logger.js) | `createLogger / redact` | [ARCHITECTURE.md](ARCHITECTURE.md) |
| [server/auth](../server/AuthApi.mjs) | `AuthApi` | [BACKEND.md](BACKEND.md) |
| [server/security](../server/security.mjs) | `` | [BACKEND.md](BACKEND.md) |
| [server/migrations](../server/migrations.mjs) | `applyMigrations` | [BACKEND.md](BACKEND.md) |
| [image-input](../src/image-input.js) | `prepareImage` | [AI.md](AI.md) |
| [server/credential-vault](../server/credential-vault.mjs) | `createCredentialVault` | [AI.md](AI.md) |
| [server/structured-chat](../server/structured-chat.mjs) | `createStructuredChat / ProviderError` | [AI.md](AI.md) |
| [server/structured-research](../server/structured-research.mjs) | `createStructuredResearch / createStructuredOutput / citationUrl` | [AI.md](AI.md) |
| [server/task-queue](../server/task-queue.mjs) | `createTaskQueue` | [TASKS.md](TASKS.md) |
| [product-label](../src/product-label.js) | `productLabel` | [TEXT.md](TEXT.md) |
| [text](../src/text.js) | `compactText` | [TEXT.md](TEXT.md) |

## Lifecycle rule

Subscriptions/listeners/watchers return cleanup or destroy handles; camera and
previews return stop/dispose; database returns close. The screen/app that creates
them owns cleanup. App-specific endpoints, policies and private data stay outside
these generic modules. Read individual returned values before integrating them.

## Local image viewer

`createImageViewer({document?, labels?})` creates an opt-in nested native bottom
sheet. Call `open(localDataUrl, {alt})`, `close()` on logout/draft cleanup and
`destroy()` on teardown. JPEG/PNG/WebP data URLs and caller-owned blob URLs only;
no remote fetch, upload, storage or blob revocation. Import the library base.css.
The viewer provides fit-to-screen and image-only 2x zoom with scrolling to pan;
app-wide viewport zoom remains locked. Photo panning does not dismiss the sheet.
Supply localized `{title,close,zoom,fit}` through the labels callback (English
defaults provided). Closing clears the source and returns focus to the opener.

```js
const viewer = createImageViewer({labels: () => ({
 title:i18n.t('appPhotoPreview'), close:i18n.t('appClose'),
 zoom:i18n.t('appZoomIn'), fit:i18n.t('appFitImage')
})});
previewButton.onclick = () => viewer.open(preparedImage, {alt:'Product label'});
// On logout: viewer.close(); on final teardown: viewer.destroy();
```

Server example: [Gemini structured transport](../examples/gemini-structured.mjs), single-request extraction or opt-in grounding; see [AI.md](AI.md).

Browser example: [custom icon input](../examples/custom-icon.js), static allowlisted SVG or a Bootstrap Icons class element. See [CUSTOM-ICONS.md](CUSTOM-ICONS.md).

Server example: [supplement research evidence](../examples/supplement-research-evidence.mjs), source-ID binding, identity preservation and exact NIH label verification; see [RESEARCH-EVIDENCE.md](RESEARCH-EVIDENCE.md).

Browser example: [password visibility](../examples/password-visibility.js), opt-in
accessible show/hide controls around existing password inputs. See [PASSWORD-VISIBILITY.md](PASSWORD-VISIBILITY.md).

Server example: [cached analysis localization](../examples/analysis-localization.mjs),
whitelisted descriptive text, fingerprinted variants and numeric-token validation.
See [ANALYSIS-LOCALIZATION.md](ANALYSIS-LOCALIZATION.md).

## Mobile workflow components (1.12.0)

| Module | Public surface | Guide |
| --- | --- | --- |
| mobile-ui | createSheet / createMobileNavigation / createProgress / createLoadingScreen | [Mobile workflows](MOBILE-WORKFLOWS.md) |
| wizard | createWizard | [Mobile workflows](MOBILE-WORKFLOWS.md) |
| selection-sheet | createSelectionSheet | [Mobile workflows](MOBILE-WORKFLOWS.md) |
| job-monitor | createJobMonitor | [Mobile workflows](MOBILE-WORKFLOWS.md) |
| proposal-review | createProposalReview | [Mobile workflows](MOBILE-WORKFLOWS.md) |
| activity-calendar | createActivityCalendar | [Mobile workflows](MOBILE-WORKFLOWS.md) |
| pause-editor | createPauseEditor | [Mobile workflows](MOBILE-WORKFLOWS.md) |
| report-view | createReportView | [Mobile workflows](MOBILE-WORKFLOWS.md) |
| server/workflow-store | createSqlWorkflowStore / createJobService / createProposalService / createReportService / workflowFingerprint / allowedProfile | [Server workflows](WORKFLOWS.md) |
| server/activity-history | buildActivityHistory / createPause / pauseActive / localMidnight / calendarDay / shiftDay | [Server workflows](WORKFLOWS.md) |

Example: [resilient localization provider](../examples/localization-provider.mjs).
The starter gallery provides live local examples; no AI keys or paid work required.
The starter now shows startup loading/retry and enables guarded automatic updates.

## Change history and launch contract

[CHANGELOG.md](../CHANGELOG.md) maps every 1.12 transfer to its file/API and records
the final update policy. setupPwa now exposes waitForStartup() and finishStartup();
automatic activation is permitted only during startup loading. Call finishStartup
before interactive content, and keep canReload guards for manual apply().
Generated apps carry their own starter CHANGELOG.md plus modules/CHANGELOG.md.

## Recurring intake and stock

[intake-plan](../src/intake-plan.js) exports normalizeIntakePlan, intakeSlots,
and stockChange. See [intake and inventory](INTAKE-PLAN.md) for day/slot identity,
transaction, historical version and undo requirements. No medical dose policy.

## Nullable rating groups

[rating-group](../src/rating-group.js) exports createRatingGroup. Host-owned
labels/artwork, accessible keyboard selection and explicit clearing; no persistence.
See [RATING-GROUP.md](RATING-GROUP.md) for lifecycle and examples.
