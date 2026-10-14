# Supplement Tracker · 0.2.0

Independent PWA generated from europolas/pwa-toolkit starter and app-modules 1.3.0.
Sources: src/; versioned shared library: modules/; public build: docs/; API: server/.
Design A uses sage/off-white with persisted light, dark and system/auto themes.
English is the first-use default; Lithuanian remains an explicit saved choice.
The toolkit's full-height iPhone scroller, keyboard behavior, hidden scrollbar and
smoothly masked blur remain in place.

## Running functions

- Account registration/sign-in/profile/password change/logout/deletion and admin
  user blocking. Recovery forms exist, but email remains unavailable until SMTP
  configuration and real delivery verification are complete.
- Account-owned xAI key save/replace/delete. AES-256-GCM encrypted server storage;
  plaintext keys are never returned or saved in browser persistence.
- Day groups with their own name and benefit/description. Home shows each group's
  title, benefit on another line, then a supplement table with the check control
  first, clickable name and benefit. Taken rows turn green.
- Product name/manufacturer or an explicitly selected photo can be sent to xAI.
  All groups and all existing supplements are included for compatibility review.
  JSON Schema is checked again on the server; incompatible/duplicate products are
  left unassigned for review. Analysis has sending/completed/error states.
- Supplement detail, manual group reassignment and deletion. Daily completion is
  derived using device timezone on the server; new local dates start unmarked while
  old completion records remain. No background midnight job is necessary.
- Public PWA shell can install/cache offline. Account data and changes require
  internet. API data, photos and keys never enter the public worker cache.

The current structured AI adapter does **not** perform live web research. Exact
manufacturer-source verification, source-linked dosage extraction and EU nutrient
reference-intake calculations requested for the next analysis revision remain
pending. Product names alone never establish a dose. Current AI results explicitly
request readable label directions or null and general cautious information.
Do not describe this release as having those research/dosage features.

Previous 0.1.x device-local records are preserved but not automatically imported into
an account: importing private local records requires an explicit user decision.
Photos are resized/re-encoded in memory and sent only with an explicit Send action;
raw images are not stored. Requests can incur xAI charges. Maximums: 30 groups,
40 supplements, 3 analyses/minute and 30/day per user in this initial release.
An explicit retry after an interrupted provider request can incur another charge;
completed saved requests reuse the request ID and do not call AI again.

## Development and checks

```bash
npm ci
npm test
npx playwright install chromium
npm run test:browser
npm run build
npm start -- --port 4175
```

```bash
docker build -t supplement-tracker-api server
server/scripts/test-isolated.sh
```

The DB workflow starts an ephemeral, separate MariaDB instance, generates temporary
credentials and removes it afterwards. It never reads deployment DB configuration.
CI runs both browser and isolated server workflows. Provider regression checks use
mocks. A manual paid provider smoke check reads only a mounted private key and never
uses account records or emits raw provider responses.

## Reused and contributed modules

config, storage, settings, theme, i18n, viewport, gestures, router, forms, ui, network,
auth, auth-screen, pwa/worker, daily-log (calendar key) and generic server AuthApi,
security/migrations. New image-input, server/credential-vault and
server/structured-chat examples are contributed to canonical pwa-toolkit, with
contracts/tests in modules/docs/AI.md. App schema and supplement policy stay here.

## Publication

See server/DEPLOYMENT.md. Target URL: https://perimove.com/supplement-tracker/.
Public HTTPS, manifest, worker and real browser administrator login were verified
on 2026-10-14. No browser JavaScript errors were observed.
The server uses separate DB, credentials and loopback API/static ports. This deploy
never synchronizes the original iphoneTest API or DB. Private bootstrap/key files
live outside Git; .runtime/ contains deployment secrets and must never be published.
GitHub Pages is optional; this deployment uses the existing perimove.com HTTPS host.

Keep .npmrc (install-links=true) and package-lock.json aligned for npm ci.
