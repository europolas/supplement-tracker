# Generated application: agent handoff

Read README.md, then modules/docs/ARCHITECTURE.md, MODULES.md and LOCALIZATION.md.
Edit src/ for app behavior; modules/ is the copied versioned library. docs/ is
regenerated public output, not developer documentation. server/ is optional.

English is the default, Lithuanian the explicit second language. Add every UI key
to both modules/src/translations dictionaries. Preserve saved language choices,
translation spans around form labels, and the iPhone fixes in modules/docs/IPHONE.md.

Never commit .runtime or include it in builds/archives. Never use another project's
DB, token keys or production data. API deployment and SMTP verification are separate
from the Pages workflow. Browser library modules must not import server-only code.

Document app-specific decisions here and in README.md. When changing a library
module, update its contract comments and guide, and keep copied server classes
consistent. npm run build rebuilds docs/; npm start previews locally. Library checks
can run with npm --prefix modules ci and npm --prefix modules test. Before release,
verify account forms, language switching, offline behavior, dirty updates and real
iPhone keyboard/blur behavior for your actual screens.

## Mandatory reuse and contribution workflow

Before creating any new application, inspect the current canonical
`europolas/pwa-toolkit` repository: `starter/`, `packages/app-modules/README.md`,
`packages/app-modules/docs/MODULES.md` and the relevant module source. Reuse or
adapt existing code before writing a replacement; do not rely only on an older
module copy in another app. Record which modules the new application uses.

If the new application requires a module not yet available in app-modules, add a
reusable example of that new module to `pwa-toolkit/packages/app-modules/` for
future applications. Include usage instructions/examples, contract comments,
cleanup requirements and appropriate validation; update the module catalog and
exports when relevant. Keep project-specific configuration, credentials and
private data out of the shared example. Follow the existing package version/lockfile
and release rules. Adding an example does not automatically upgrade other apps.

This is a standing user instruction, recorded on 2026-10-13 in JOURNAL.jsonl at
the canonical repository root. Carry it into each generated application's AGENTS.md.

## Supplement Tracker foundation

App ID: supplement-tracker. Current version: 0.1.0. Sources live in src/ and shared
library copy in modules/ (1.2.0). src/app.js owns the supplement schema and screens;
modules/src/daily-log.js owns generic completion records. Read README for the reused
module list and current feature boundaries. All UI translations currently live in
the copied modules/src/translations/en.js and lt.js, matching the canonical toolkit.

Records in IndexedDB records store have kind supplement or daily-completion; the
log uses supplement-log namespace. Archive retains the item and old completions.
Daily keys use the device calendar; focus/visibility/minute checks refresh the day.
No account API, reminders or server exists yet. Do not imply those work based only
on the presence of generic unused modules. Do not add medical dosage rules implicitly.

scripts/build.mjs is the generated builder with explicit app.css copying, so CSS
participates in the worker content hash. Preserve this when upgrading the builder.
Run npm test and npm run test:browser after behavior changes. Use textContent through
the toolkit element helper for all user data. Keep dirty forms/write/dialog guards
when adding update flows. Close database/watch/listener resources if the app shell
is later converted into a dynamically mounted component. Pages is optional and gated
by PAGES_ENABLED until repository settings are configured.
