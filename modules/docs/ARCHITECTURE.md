# Architecture and reading order

This is a browser PWA toolkit with an optional Node/MariaDB backend, not a native
Swift/IPA project. No frontend framework or browser runtime dependency is required.
English is the default and Lithuanian the second supported UI language.

Read MODULES.md for contracts, LOCALIZATION.md for texts, IPHONE.md before touching
layout, BACKEND.md for accounts/deployment, and DEVELOPMENT.md for checks/releases.

## Three source layouts

| Checkout | App source | Library | Public output | Backend |
| --- | --- | --- | --- | --- |
| Canonical pwa-toolkit | `starter/` | `packages/app-modules/` | `build/starter/` | template `starter/server/` |
| Independent starter export | `starter/` | `packages/app-modules/` | `docs/` | template `starter/server/` |
| Generated application | `src/` | `modules/` | `docs/` | optional `server/` |

Only edit source files. The canonical toolkit keeps a namespaced demo snapshot in `docs/`;
that folder has a different purpose there. The original tested demo and `example-v1`
tag remain in europolas/iphoneTest.
The library's source and server folders are the canonical reusable implementations.

## Startup and ownership

The app loads/validates configuration, creates namespaced storage and settings,
then a theme and one translator. Explicit saved settings override defaults.
Viewport and gestures apply iPhone behavior. Routes select screens; optional auth
loads only the local bundled template. Account state flows from AuthApi through
createAuth into the account screen. Each screen owns its event/permission cleanup.

UI data must become textContent, never arbitrary HTML. The sole app-template HTML
insertion accepts the bundled account.html, not API or user-provided markup.
Account inputs sit beside translation spans so language changes preserve values.

A service worker caches public static assets only. A content hash changes the
cache version; updates wait for activation and cannot reload dirty or busy forms.
API requests remain uncached. Offline local data lives in IndexedDB/storage;
remote operations require the API and an explicit idempotency strategy.

## Isolation and boundaries

Application IDs namespace local data and caches; they are not origin-level security
isolation. Separate domains/API instances/DB users are required for separate private
apps. Browser storage may be cleared by the OS. No secret belongs in local drafts,
logs, an outbox payload or a public archive. Account sessions use opaque tokens in sessionStorage by default. Applications may
explicitly opt into persistent sign-in (see BACKEND.md); only the revocable token
and expiry enter localStorage, never profile data, passwords or provider keys.

## Compact detail views with existing UI primitives

Use element('details') and a first child element('summary') for secondary metadata,
source tables or management controls. Native disclosure supports keyboard and
assistive technology without another global controller. Keep the primary content
outside, and update the summary with localized More/Less information on toggle.
When a parent screen redraws on polling or theme/language changes, capture open only
for the same record ID before replacing its DOM. A new record or logout resets it;
no private expansion history needs browser persistence. All remote text still uses
element/textContent. The screen owns detached nodes/listeners; no external observer
or timer is needed. This is a composition of existing element, not a new module.
