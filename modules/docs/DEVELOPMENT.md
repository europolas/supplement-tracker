# Development, verification and releases

Source modules begin with a responsibility/constraint comment. Read that contract
before changing behavior; update it and the guide when public behavior changes.
Avoid comments that merely repeat an assignment or narrate every line.

In the parent toolkit: npm ci, npm test, then npx playwright test (install Chromium
once). Library unit tests run independently with npm ci and npm test in the library
root. Database integration runs against disposable MariaDB with temporary users/
schemas; the GitHub workflow supplies this service. Never test against production DB.

Relevant checks include first-use English, saved Lithuanian, translation fallback,
input preservation, safe text insertion, session races, dirty-form update protection,
scoped caches, offline reload, namespace isolation and account permission boundaries.
Desktop automation does not prove iOS hardware permission or keyboard behavior.

Parent scripts create independent applications, build public assets, and export two
source repositories. Generator output must be a new directory. Public builds and
archives must exclude .runtime, DB state, test app folders and node_modules. Generated
server startup/API deployment is an explicit separate task, not a Pages workflow side effect.

For release: align package.json and package-lock.json, run affected checks, export,
push and verify Actions + live assets. Tag a new version without moving old tags.
The parent deployment exposes original demo, /starter/ and /downloads/. Consumers
must deliberately upgrade their copied module version; existing app databases and
secrets never move automatically between projects.
