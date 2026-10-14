# Supplement Tracker · 0.1.1

An independent PWA foundation generated from europolas/pwa-toolkit starter and
app-modules. English is default; Lithuanian and light/dark/system themes persist.
The shared iPhone viewport, keyboard, hidden scrollbar and gradual blur fixes remain.

## Initial functions

- Add a supplement with a name, your own amount/label and optional preferred time.
- View today's active routine and mark/undo taken entries.
- Persist supplements and daily completion records in device-local IndexedDB.
- Archive items with confirmation. Archived items and past completion records stay
  stored for future history/archive screens; this action is not permanent deletion.
- Install as a Home Screen PWA; public assets and existing local records work offline.
- Activate updates with protection for unsaved forms, active writes and open dialogs.

No cloud account, API/database server, notifications, history viewer, edit screen,
export/backup or dosage recommendations have been activated. The optional time field
is descriptive and does not schedule reminders. No supplement records are sent to
an external service. Records are browser-local and unencrypted; clearing site data
or OS storage removal loses them. This foundation does not claim clinical behavior.

## Development

```bash
npm ci
npm run build
npm start
npm test
npx playwright install chromium
npm run test:browser
```

Source is src/, versioned shared code is modules/, generated public output is docs/.
Run npm run build after source changes. app.css is explicitly copied and hashed by
scripts/build.mjs. Do not edit generated docs/ manually. Browser checks run on port
4175 and cover persistence, plain-text rendering, en/lt, theme, archive and offline.
Module tests include local-calendar logging and namespace separation.

## Modules reused and contributed

Used directly: config, storage, settings, theme, i18n, viewport, gestures, router,
forms, ui, network, database, pwa/worker, and the newly contributed daily-log.
Other copied toolkit modules remain available for later features but are not active.
The reusable daily-log example and guide have been contributed to canonical
pwa-toolkit/packages/app-modules/. It is generic for routines and checklists and
contains no application records, private data or dosage logic.

The generated app carries @europolas/app-modules 1.2.0. Keep modules/ and its
package metadata aligned; upgrade deliberately. No automatic pull from the library
runs during app startup. Read AGENTS.md and modules/docs/ARCHITECTURE.md first.

## Optional publication

GitHub CI tests every main push. Configure Pages with GitHub Actions and set Actions
repository variable PAGES_ENABLED=true for automatic deployment; alternatively run
Deploy application manually after configuring Pages. SSH deploy keys upload code
but cannot change those settings. Until then, no hosted app URL is claimed live.
The intended Pages URL is https://europolas.github.io/supplement-tracker/.
No backend is deployed by this workflow. Each future backend must have its own
secrets, DB/user and configuration; never reuse iphoneTest's production API/data.

Keep .npmrc (install-links=true) with package-lock.json so file: module packaging
uses the same mode with npm ci on local machines and GitHub runners.
