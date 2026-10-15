# Generated application: agent handoff

## Current behavior: 0.10.1 (2026-10-15)

The user explicitly reduced scope to one AI call per submitted name/photo. The
production TrackerApi defaults to singlePass=true. The compact strict contract
returns only name, manufacturer, an owned groupId, and a 2–5 word benefit for each
readable product (plus localized skipped-label explanations). English instructions
request the user's en/lt response language. All existing groups and product names/
manufacturers/group IDs are supplied. No web search, per-product research, automatic
retry, dose or compatibility analysis follows this call. basic-1 records are saved
as complete; their detail sheet shows the brief benefit and group, with existing
manual move/delete controls. Existing detailed records remain readable unchanged.
The old synchronous analyze path remains disabled. The product sheet exposes an
explicit Get detailed information action (Gauti išsamią informaciją). Only that click
starts one selected-product research job via /research; adding and opening sheets
never trigger it. The action disables while pending, reports progress, and uses the
selected UI language. Closing the sheet does not cancel the server job. Existing
records are enriched in place, with manual grouping and sourced-data validation
preserved. No automatic retries. Tests opt into singlePass=false only to cover the
historical automatic pipeline.
The notes below describing progressive research document historical releases and
must not be interpreted as current production behavior. No database migration.


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

## Supplement Tracker 0.9.0

Read README.md and server/ANALYSIS.md for research/schema 1.4, provenance, serving
units and EU adult label NRV policy. modules/ is 1.10.1. App state is now account-scoped through the isolated
Node API/MariaDB in server/. Never use the production DB for regression tests:
server/scripts/test-isolated.sh provisions a disposable database instance. Initial
admin and xAI keys live in private /home/deploy/.secrets/supplement-tracker files;
never read their contents into logs or commit them. Current SMTP readiness is false: a separate TLS-tested mail service is prepared,
but the user deferred SPF/DKIM/DMARC publication. Records: server/mail/DNS-records.json.
Do not claim delivery or enable recovery before DNS and real delivery verification.

Preserve design A and persisted light/dark/system preferences, en/lt defaults and
all iPhone fixes. Home is a sequence of group blocks: name, benefit/description,
then a table with check control first, clickable name with a short muted benefit below it. Completion day
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

Progressive analysis: photo-products.mjs schema v2 identifies/groups text OR all
photo products in ONE grok-4.3 none call, English instructions + selected response
language en/lt. Migration 006 adds job phase/language; all drafts are committed
before enrichment. Raw photo is cleared before queueing background research.
Detailed schema 1.4 has a language enum constrained to that submission's preference.
Each target sees all other records including drafts; incomplete context is never
blanket safe. A three-concurrent background queue + prioritized provider queue comes from
canonical task-queue.mjs (library 1.8.0). No automatic paid retries. On restart mark
jobs and queued/researching drafts failed but keep records. Retry from details is
explicit, localized, owner-scoped and does not repeat recognition/add another row.
Preserve manual group edits and flag compatibility stale on concurrent changes.
Reuse only exact owned identities, matching language and source freshness (30 days).
The client observes all active jobs, unlocks adding after server acceptance, refreshes
records on progress changes and clears all progress state on logout. Preserve camera
capture and the separate library input with no capture. Do not rebuild mounted docs
during browser tests. No changes to the original demo, its API/DB or deferred mail.

Migration 007 changes the supplements group-ownership FK to ON DELETE CASCADE for
account removal. Group DELETE must keep its explicit unassign-first transaction;
never replace it with raw group deletion if records are meant to remain.

Migration 008 adds phase=queued. Each owner's bounded recognition queue runs one
preview at a time and releases its slot before awaiting background research. Up to
four active jobs/account, eight globally, four accepted submissions/minute and 30/day.
GET jobs returns latest, active[] and recent[] (20 entries) with created/finished
metadata and safe submission name/kind, never raw photo. The add dialog retains
history and an unsent draft/photo when closed; server polling must never clear the
next draft. Reload restores server history only. Logout clears all account-scoped
UI state. Startup records failedPhase before failing abandoned jobs; no paid retry.

Schema 1.4 adds benefitSummary (nonempty, <=6 words / 80 characters) and a separate
source-verified doseFallback. Prefer strict timing matches to owned groups; low
confidence or unknown dosage alone must not unassign a clear timing group. Actual
potential_conflict/duplicate assessments require review but do not erase time slots. Never conflate a general
adult intake/supplement range with manufacturer directions, a personal prescription,
a clinical treatment dose, label NRV or capsule count. Unknown fallback stays null
with an explanation. Clinical/regulatory-only research can retain identification
but cannot populate unverified manufacturer dose/ingredient quantities. Historical
1.1–1.3 data stays readable; Home compactText only limits legacy display, not storage.

Detail initially shows dose, benefits, compatibility and timing only. Secondary
metadata/evidence and management actions live in native details/summary. Preserve
expansion for the same product during redraws, never across products/accounts.
Dose fallback qualification and stale compatibility stay in the relevant primary
section; do not expose draft dosage as verified. No backend or AI changes in 0.8.1.

0.8.1 uses canonical bottom-sheet (library 1.10.0). Keep main as the underlying tab
scroller; native route-dialog hosts account/details and returns to baseRoute. Do not
hide/clear the outgoing sheet contents before the close animation completes. All
new sheet actions preserve existing in-memory drafts until explicit save/logout.
Group creation/edit uses group-dialog. The upload queue stays in add-dialog and
Home's latest report is a collapsed disclosure. Never synthesize dose quantities;
unknown/draft primary dose is a localized small italic label. Use native modal focus
isolation, opt-in sheet confirmations, reduced motion and shared --app-height.

0.8.1 uses productLabel to split display-only titles, manufacturer and explicit
trailing label variant. Do not mutate stored identities or infer strength from
nutrient/serving data. Home has no group-benefit or table-heading row. Keep each
product's manufacturer bold and benefit regular in the same muted metadata line.
Touch dismissal is handled through non-passive touchmove in bottom-sheet; do not
regress to handle-only pointerup (Safari cancels pointers during native scrolling).

0.9.0: inspect server/ANALYSIS.md before changing AI execution. Three background
research tasks run concurrently; provider concurrency is four to reserve preview
capacity. jobProgress serializes writes per job. Day grouping is scheduling, never
compatibility clearance. Keep warnings on Home/detail, preserve manual JSON markers,
foreign/deleted group checks, source validation and no automatic paid retries.
