# Reusable module library

Read `docs/ARCHITECTURE.md`, `docs/MODULES.md`, then the guide for the feature.
English is always the default and fallback; Lithuanian is the second supported
language. Preserve saved language choices. Keep dictionary keys aligned and run
localization tests when editing text. `docs/LOCALIZATION.md` explains the API.

Keep frontend code in `src/`, server-only classes in `server/`, and reusable CSS
in `styles/`. Backend secrets never enter the frontend. Preserve all iPhone fixes
listed in `docs/IPHONE.md`. Public functions need contract comments; update the
appropriate guide when changing a contract or adding a module.

Run `npm ci` and `npm test` in a standalone library checkout. The parent toolkit
also runs browser and isolated database tests. Release versions are immutable;
change package version and lockfile together. Backend consumers must explicitly
upgrade copied template classes rather than silently changing a production API.

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

## Startup-only automatic updates

Automatic updates are allowed only while the launch loading screen is visible.
Use setupPwa({autoUpdate:true}), await waitForStartup(), then call finishStartup()
BEFORE revealing interactive content. Preserve the bounded default 4s budget and
dirty/editor/task guards. Never add idle, foreground, online or periodic automatic
reloads; another tab activating a worker must not reload a running app. Manual
apply() remains explicit and guarded. See the mobile workflows guide and changelog.
