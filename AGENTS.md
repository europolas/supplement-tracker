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

## Supplement Tracker 0.4.0

Read README.md and server/ANALYSIS.md for research/schema 1.2, provenance, serving
units and EU adult label NRV policy. modules/ is 1.6.0. App state is now account-scoped through the isolated
Node API/MariaDB in server/. Never use the production DB for regression tests:
server/scripts/test-isolated.sh provisions a disposable database instance. Initial
admin and xAI keys live in private /home/deploy/.secrets/supplement-tracker files;
never read their contents into logs or commit them. Current SMTP readiness is false: a separate TLS-tested mail service is prepared,
but the user deferred SPF/DKIM/DMARC publication. Records: server/mail/DNS-records.json.
Do not claim delivery or enable recovery before DNS and real delivery verification.

Preserve design A and persisted light/dark/system preferences, en/lt defaults and
all iPhone fixes. Home is a sequence of group blocks: name, benefit/description,
then a table with check control first, clickable name and benefit. Completion day
comes from the server's current date in a validated device timezone; history remains.

scripts/build.mjs copies app.css and hashes all public assets. Docker web binds
that generated docs/ folder: recreate the web container after rebuilding docs/,
otherwise the bind mount references an old directory inode. Follow
server/DEPLOYMENT.md. The public URL was verified working after the user reloaded Nginx on 2026-10-14.
Future proxy edits still require root validation/reload and a new HTTPS check. Backend/DB remain separate from
iphoneTest. No automatic production/API synchronization from the canonical toolkit.

Account forms share the same createAuth instance with app screens. Never cache keys,
photos or private API responses; only the opaque session token and expiresAt live in localStorage.
The app explicitly opts into persistent auth. NULL server expiry has no clock limit;
logout/password changes/resets/blocking/deletion still revoke it. Migration 004
upgrades only active old sessions. Never revive expired or revoked sessions.
Preserve dirty-form, in-flight write and open-dialog protections for worker updates.
New shared features belong in pwa-toolkit first, with tests and usage documentation.

Analysis uses owner-scoped short HTTP jobs and server-side bounded research. Keep
raw photos in memory, never DB/job rows. API startup fails abandoned running jobs
without paid retries. This deployment runs one API instance, not distributed workers.
Browser tests build to .runtime/browser-public; never rebuild mounted docs during
tests. NRV constants are server-owned; do not infer personal dosage or convert
unknown/IU/compound amounts blindly. Older saved analysis 1.1 remains readable.

Multi-product photos use photo-products.mjs for strict identity extraction, then
one sourced analysis per target. Keep selectedTarget in prompts, all earlier batch
successes in compatibility context, and deterministic child request IDs. Migration
005 adds job progress/result JSON (no raw images/prompts/keys). Partial successes
remain saved and failures/skipped labels are visible after reload. Camera input
has capture=environment; library input MUST omit capture. Both use prepareImage.
Submission quota applies once per photo, not per product. Max 40 products/routine,
four upstream calls globally; no automatic paid retries. Check the optional paid
LIVE_PHOTO workflow only with an explicitly supplied private test photo/key.
