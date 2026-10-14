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
| [text](../src/text.js) | `compactText` | [TEXT.md](TEXT.md) |

## Lifecycle rule

Subscriptions/listeners/watchers return cleanup or destroy handles; camera and
previews return stop/dispose; database returns close. The screen/app that creates
them owns cleanup. App-specific endpoints, policies and private data stay outside
these generic modules. Read individual returned values before integrating them.
