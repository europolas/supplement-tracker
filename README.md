## 0.32.0 — scored conclusions, period-focused PDF designs and retained usage

Conclusion synthesis now returns a strict score {value:integer 0..100,explanation}
using one stable rubric: supplement selection/known overlap 30, group/timing fit
30, complete routine/goals fit 40. This assesses plan coherence, not health,
proven benefit, safety or unprovided adherence/wellbeing. More products/higher doses
never earn points by themselves. No new provider stage or automatic generation.
Validation rejects missing/malformed/out-of-range scores on new responses. Current
and archived reports retain/show the returned value and explanation; history rows
show a short score label. Legacy reports are explicitly unscored, not fabricated
or regenerated. Score 0 is preserved. Existing profile consent stays unchanged;
private journal observations are still absent from AI requests.

Migration 018 adds deleted_at and lifetime first_taken_at, backfilled from real
completions. A privileged AFTER INSERT trigger retains first_taken_at after Undo.
Single removal uses owner/product locks shared with Taken/AI commits: never-used
products are deleted; products ever marked Taken are hidden and retained. Bulk
Clear all removes active records with the same rule and preserves usage, while its
existing job/latest/archived-conclusion clearing behavior remains. Account deletion
still cascades all owned data. Updated clear helper explains retained usage/groups.

Dashboard, recognition matching/deduplication, research/localization, Recheck,
Conclusion snapshots and mutation lookups exclude deleted_at rows. Background
writes cannot revive them. A newly submitted matching name/photo gets a fresh UUID,
default plan/stock and no inherited completion. Replaying the exact old request ID
remains idempotent rather than a new submission. Group deletion still unassigns
all retained rows before the group FK cascade; completion/group snapshots survive.

Usage reads include retained products, original names/brands, per-day plans and
group snapshots. Recorded occurrences remain on their real day; unrecorded slots
stop at removal, so no future pending/missed entries appear. A removed product's
history row is readable and labelled, without a link to a missing live detail.
A later matching product is an independent history item. Former hard-deleted data
and old Taken-then-Undo events without any surviving evidence cannot be recovered.

Both synthetic PDF design variants now have four A4 pages: period intake graph and
summary plus wellbeing graph/summary; full three-section routine and groups; all
16 supplements on one readable table page; latest AI conclusion/score with only
dates/scores for earlier conclusions. Missing diary days remain gaps and are
excluded from averages. Today pending is separate from past unmarked occurrences.
The generator checks page/footer overflow and all 16 table rows before printing.
Samples contain no private data, real AI analysis or inferred causal health claims.
Actual private data export remains a separate feature, not implied by sample PDFs.

Deploy migration 018 before starting the API; the startup query now requires its
column. Use a private backup and brief write pause. Do not apply to the toolkit or
other projects. Existing nav top layer and launch-only auto-update remain intact.

## 0.31.1 — persistent nonmodal navigation layer

The same iPhone partial-navigation overpaint was reported again after 0.30.1.
Stacking/isolation alone did not eliminate the intermittent physical-device paint
problem. On engines supporting the Popover API, the existing nav now uses one
manual nonmodal top-layer surface, independent of the document's asynchronous
scroll/backdrop/mask painting. Its links, pill shape, translucency, positions,
size, safe-area clearance and graduated body edge masks are preserved. Reset
popover UA right/max-size constraints so phone/tablet geometry stays identical.
There is no fullscreen backdrop, light-dismiss or focus trap.

renderNavigation opens only after authenticated startup is revealed, and closes
on logout. Repeated dashboard/locale/Taken updates do not set the attribute again
or promote an already open nav, so subsequently opened native dialogs remain
above it. Keyboard visibility stays CSS-driven. Unsupported engines retain the
original fixed navigation. No shared library, API or database change.

Regression covers top-layer state, high-z masked body edge, all tabs/scroll
positions, refresh/Take, Escape, modal ordering through background refresh,
logout, startup, fallback and unchanged 320/402/768px geometry. Desktop Chromium
cannot certify the intermittent physical-iPhone compositor behavior. Local WebKit
cannot launch because the host lacks its GTK/GStreamer dependencies.
Reference: https://webkit.org/blog/14445/webkit-features-in-safari-17-0/#popover

## 0.31.0 — earlier AI conclusions and export design samples

Account → Tools → AI conclusion history opens the existing conclusion bottom sheet
on its History view. Home Conclusion opens Current. History lists date, a short
plain-text preview and the original product count where known. Keyset pagination
loads 20 at a time; selecting a record reads the full immutable five-section text.
Archived text has no actionable group proposals or generation action. Current
report decisions keep the existing guarded per-product acceptance behavior.
Native sheet close, themes, EN default/LT explicit, narrow widths and account
cleanup reuse the established app components. Reads never call a provider.

Migration 017_conclusion_history creates owner-cascaded immutable report archives
and backfills the one currently stored report per account. Every successful future
analysis inserts the archive in the same transaction as latest-report/job completion.
Failed analyses add no record and retain the latest report. Later routine/product
or proposal changes cannot rewrite the archive. Reports overwritten before this
migration are unrecoverable. Aggregate product/group counts are saved for new
reports; unavailable legacy counts are omitted rather than inferred from today.
No raw profile, credential, prompt, research evidence or actionable proposal is
copied to history. Existing report prose may contain the personal context the
user previously allowed. Clear all supplements also clears reports/history, as it
already cleared the latest conclusion; account deletion cascades owner data.

GET /v1/conclusions/history?before=<report UUID> returns {items,next}; each item is
{id,createdAt,language,preview,inventory|null}. Cursor lookup is owner-scoped.
GET /v1/conclusions/history/:id returns {report:{id,createdAt,language,sections,
optional inventory}}. Foreign/missing records return 404, malformed cursor 400.
No archived mutation endpoint. Browser keeps history in session memory only;
serial/owner guards reject late selection/logout reads. Live generation, not
history reads, remains the sole paid action.

Before API startup, back up the DB and apply migration 017 with the privileged
migration CLI. Stop API writes for the brief backfill to preserve the latest text.
Do not synchronize schema/data into the canonical toolkit or other apps.

scripts/preview-data-export.mjs generates deterministic synthetic Lithuanian PDF
samples in design/exports: A is a three-page visual report; B a two-page compact
print view. HTML sources, PDF files and page previews are review artifacts only.
The public build exposes PDFs/cover previews under exports/, outside worker cache.
Static servers declare application/pdf. No private-data export endpoint, paid
analysis, export settings or automatic personal-data publication is implemented.

## 0.30.3 — compact Schedule and stock control

Reset inherited details top padding on the intake disclosure. Its summary and
border now total the same 50px height as the surrounding group/action controls,
with matching 13px text and 12px section gap. Expanded form stays in normal flow.
App-only CSS correction; no shared library, API or data changes.

## 0.30.2 — aligned supplement detail cards

Composition, Usage, Benefits and additional detail sections use one flex header
with vertically centered icon/title. Body text starts at the card's normal left
inset instead of inheriting an icon gutter. Semantic lists retain their structure
without visible bullets or indentation; subtle theme-aware rules separate adjacent
items, with no trailing rule. Ingredient amounts and their notes remain together.
The expanded More information content and source list follow the same text layout.
App-only presentation change; no API, data, provider or shared-module changes.

## 0.26.1 — unified bottom sheet headers

Usage calendar is now a native createBottomSheet dialog over Account, with the
same height as Daily routine. Its data/filter/date state remains session-only.
A product opened from history stacks above that dialog; closing returns to the
same calendar selection and scroll, then closing the calendar returns to Account.
Logout closes both layers immediately and clears data/requests. Existing PWA dirty
and open-dialog protections apply. No API/database/provider change in this release.

All sheets share .sheet-header: one flex row, 27px title (25px on narrow phones),
44px X, aligned vertical centres, same horizontal padding, handle and rounded shell.
This includes group/add/detail/diagnostics/recheck/pause, routine/editor, calendar
and transient confirmations. Confirmation X invokes the toolkit Cancel action;
no separate promise/cleanup lifecycle. Product h1 now lives in the header and retains
its aria-labelledby/data-sheet-focus contract. Outgoing content survives close
animation. Wizard back/step controls remain below its common title row.

## 0.26.0 — immutable historical groups

Migration 013 records append-only assignment/name/icon/order events and an immutable
JSON group snapshot on every newly inserted completion. Database triggers run in
all existing write transactions: manual moves, recognition, research, accepted AI
moves, group rename/icon/order updates, and the unassign-before-delete group path.
Historical group IDs deliberately have no day_groups FK, so deleted/renamed groups
remain readable. Product/account deletion and explicit clear-all retain their existing
cascade contract. Trigger definer is the privileged migration role; runtime remains
DML-only. The deployment must stop API writes briefly while baseline/triggers install,
after confirming no active AI work, then start the updated API.

Taken entries use their captured completion group, including changes later on the
same day. Pending/missed/paused entries use assignment events at now/day end, in
the calendar timezone. Historical name/icon/order versions have distinct stable
keys, so a deleted group or two same-day names cannot collapse into today's group.
The owner-only read API returns per-day snapshot groups, never substitutes current
inventory groups. Existing records start a migration-time baseline; assignments
before tracking began are explicitly Group not recorded / Grupė neužfiksuota.
No backdated guesswork from current grouping; earlier true assignments cannot be
reconstructed. Product names/manufacturers remain current labels.

Usage UI removes the subtitle/current-group note, separates group sections by 22px,
reduces product/manufacturer text to 13px/11px with no extra metadata margin, and
uses row separators only between products in the same group. No trailing group
border. Paused rows also identify their historical group alongside return date.

## 0.25.0 — Usage calendar (selected history B)

Account → Tools → Usage calendar opens a full main-scroller page, preserving the
same app navigation with Account selected. Weekly day cards and a month grid share
one selected date, period navigation, taken/missed/paused filters, progress and
current-group journal rows. Each product opens the existing detail sheet and returns
to the calendar. Paused records have their own section outside the daily denominator.
EN/LT, dark theme, narrow viewports, request retry, focus/midnight refresh and session
cleanup are supported. design/intake-history-b.png is the mandatory visual reference;
.runtime/usage-calendar-b-light.png is the comparable running-app capture.

GET /v1/usage?from=YYYY-MM-DD&to=YYYY-MM-DD&timezone=IANA is owner-scoped and
read-only, accepts at most 42 inclusive days, never calls AI and needs no migration.
Only stored current inventory and its surviving completion/pause rows contribute.
A completion wins over a pause; future dates and pre-creation dates are never missed.
Past days sample effective pauses at local day end, today samples now. DST conversion
uses local midnight, while scheduled pause expiry retains its original timezone.
Today unmarked is pending, past unmarked is missed. No retrospective writes or
fabricated history. Deleted product/account/clear-all history follows the existing
explicit cascade policy. Group/identity labels reflect CURRENT inventory: older
versions did not store group/name snapshots, so earlier assignments cannot be
reconstructed. This is stated beneath the journal. Dates/counts are server-derived;
browser caches are session-memory only and cleared/aborted on logout.

## 0.24.0 — supplement pauses

The product sheet offers Pause supplement and Resume. Pausing hides the product
from active Home groups, Taken totals and new Recheck requests, while retaining
inventory access in a Paused supplements list, metadata, assigned group and every
completion. Groups inventory counts continue to include paused products.
An optional return date is inclusive: active from midnight of that date in the
validated timezone captured at pause creation. Dashboard/recheck/completion reads
compute effective state without a cron job; the app refreshes on focus and local
midnight. Pausing never fabricates or removes a completion; unmarking remains
available via the API for correction. Explicit resume restores today's existing
completion, if any. Pausing/resuming does not call AI.

Migration 012 adds the cheap current snapshot and owner-scoped supplement_pauses
periods. History periods retain start/resumed timestamps plus scheduled date/zone;
effective end is the earlier of manual resume and scheduled midnight. Deletion
of product/account or clear-all cascades those periods. Repeated identical state
writes are idempotent; pause_revision prevents in-flight Recheck results from
surviving a pause/resume cycle. Old pending product moves are dismissed; active
research can still enrich metadata but cannot move a paused product's group.
API: PUT /v1/supplements/:id/pause with {paused:boolean, resumeOn:YYYY-MM-DD|null,
timezone:IANA}; future valid dates only. Sessions derive ownership; no client IDs
or dates can overwrite completion history. No history screen is implemented yet:
design/intake-history-a.png and b.png are light-theme concept images only.

## 0.16.2 — grounded research evidence binding

Research extraction selects short source IDs from a strict schema enum; server
code resolves them to encountered URLs. Model-generated/copy-corrupted URLs
cannot become citations. Grounding titles and verified redirect aliases stay
attached to sources. This does not add an LLM request or automatic retries.

Known scanned manufacturers are preserved. A different returned brand cannot
replace identity or contribute its dose/composition/compatibility claims. Invalid
manufacturer provenance becomes unknown quantities/directions rather than
discarding the whole useful result; safety/source validation still runs afterwards.

NIH DSLD label evidence is accepted only after a bounded server lookup of an
encountered exact /label/<id> URL, matching known brand and normalized product name.
No arbitrary publisher URL is fetched. Verified registry evidence has its own
label_registry source kind; numeric quantities and daily serving range are checked
against that label. Unverified regulatory/retail data cannot establish manufacturer
quantities. Background lookups cannot claim to have read a supplied photo.
The original Gemini TEST2 recognition/grouping request is unchanged.

## 0.16.1 — background completion timing fix

The batch clock is scoped to runProgressive rather than its recognition callback.
Recognition and background durations are separate. A failed individual research
request stays on that item and does not fail the committed batch. Diagnostics
displays completed-with-issues for such partial outcomes. Regression covers the
real timed pipeline shape with 16 products, 15 success and one provider rejection.

## 0.16.0 — concise significant incompatibilities

Home never displays a compatibility badge. Full research returns sparse,
source-backed severe supplement conflicts only, prioritizing same-group pairs.
Ordinary overlap, unknown quantities and compatible pairs are omitted. Empty
alerts do not establish safety. The compatibility section is absent when no
explicitly graded severe alert exists; ungraded historical pair essays are hidden.
Drug/contraindication cautions and the doctor footer remain separate.

Each alert has an owned supplement ID, severity=severe, short reason, source URL,
canSeparate, optional owned recommendedGroupId and brief recommendation. Sources
must be encountered and classified as manufacturer/clinical/regulatory. A timing
recommendation is allowed only for a supported separation mechanism and another
compatible existing group. No automatic moves or claims that time fixes systemic
interactions. Deleted/current-group recommendations are not displayed.
Group names/descriptions, selected group ID and each existing product group ID
are extraction context; private routine data still never goes to Search.
No DB migration or automatic paid rewrite of old analyses.

## 0.15.1 — built-in group icon picker

Group editing exposes the original local sun/meal/moon and other app glyphs as
buttons plus Automatic. Choosing a glyph populates the existing SVG icon field;
the same validated SVG API persists it. Custom SVG/Bootstrap input remains available
with a live safe preview. Original glyph paths are unchanged; no backend migration.

## Current production behavior: 0.15.0

Newly added supplements are committed immediately, then researched automatically
in the bounded three-worker background queue. Recognition remains one Gemini
3.8 Flash call; each new product then uses grounded lookup + structured extraction.
This explicitly supersedes the earlier opt-in-only policy below. Existing/reused
products are not automatically re-billed. Failed/interrupted research keeps the
product, stops the Home pulse and offers the explicit retry/details action.

Full research includes known composition/amounts, dose/timing/food, detailed benefits,
existing-routine compatibility, concrete drug interactions/contraindications/adverse
effects and sources. Only public selected identity goes to Search; private routine
context goes to the extraction call with tools disabled. Missing manufacturer is
resolved from grounded evidence, persisted in analysis + identity and shown by Home.
Original identity aliases prevent duplicate rows on re-upload. Manual grouping
and existing cancellation, key-change, account ownership and clear-all guards remain.

Queued/researching Home rows pulse subtly; reduced-motion uses a static tint.
Migration 010 adds group icon text, exposed only in the owner dashboard. Icon text
never enters AI grouping context. SVG is reconstructed with a static-shape allowlist;
Bootstrap `<i class="bi bi-…"></i>` uses locally hosted Bootstrap Icons 1.13.2 assets
(MIT license included). `src/custom-icon.js` mirrors the reusable toolkit example.

## Current production design: 0.14.0 — Gemini TEST2

Gemini 3.8 Flash / LOW is the default (`AI_PIPELINE=gemini`). Adding calls
Gemini exactly once for identity, partial composition, one owned group and
2–4 localized benefit words. No JEV, automatic review, search, cache or research
follows adding. Instructions are English, response language follows en/lt.
Grouping instructions are universal; no fixture product list or desired count
is included. After identification, the existing reviewed exact-manufacturer
food constraint cache prevents a known required-food product staying in fasting.
This is a local guard, not another AI call or a reference-table override. Existing manual routines are preserved.

Google keys are encrypted per owner in `google_provider_credentials` (migration
009), with provider-bound encryption. Legacy xAI keys are not sent to Google.
Legacy factories remain for explicit rollback; switching server pipeline also
requires matching UI provider labels. Google is the only active UI model.

The explicit details button uses two Gemini calls: grounded lookup, then strict
JSON extraction; grounded citations are validated by the existing source policy.
This is separate from the single-request adding path. No silent retries.
See `reports/gemini-release.md` and `reports/gemini-request-example.json`.
Historical sections below describe earlier versions, not the active pipeline.

# Supplement Tracker · 0.10.2

## Current: 0.12.0 — automatic grouping review

This supersedes the historical one-request-only policy below at the user's explicit
request. Adding has ONE fast identification call, then ONE focused Grok 4.7 review
call with web search (180s, max 4 turns, no retries). Already-saved products remain
visible. Review receives identified names/manufacturers and the complete routine;
it verifies manufacturer meal/fat instructions, not dosage/full descriptions. The
review returns owned group IDs, concise localized reasons and consulted sources.
Only cited proposals become actionable. No automatic moves: upload history and
Home's recent report show source-linked proposals and an explicit Apply button.
The owner transaction checks the original routine/group snapshot, preserving manual
edits and rejecting stale/cross-account proposals. Repeated apply is idempotent.
Clear-all cancels stored jobs/proposals; late results cannot recreate rows. Failed
or interrupted review keeps the initial groups and shows failure, never re-bills.
Existing products outside a submitted batch are context, not automatic move targets.
Per-thumbnail remove controls keep the three-column sage grid and remaining order.


## Current behavior: 0.10.2 (2026-10-15)

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


Independent PWA generated from europolas/pwa-toolkit starter; shared app-modules currently 1.14.0.
Sources: src/; versioned shared library: modules/; public build: docs/; API: server/.
Design A uses sage/off-white with persisted light, dark and system/auto themes.
English is the first-use default; Lithuanian remains an explicit saved choice.
The toolkit's full-height iPhone scroller, keyboard behavior, hidden scrollbar and
smoothly masked blur remain in place.

## Running functions

- Account registration/sign-in/profile/password change/logout/deletion and admin
  user blocking. Recovery forms exist, but email remains unavailable until SMTP
  configuration and real delivery verification are complete. The separate mail
  service is prepared and TLS-tested; the user deferred publishing its DNS records.
- Account-owned xAI key save/replace/delete. AES-256-GCM encrypted server storage;
  plaintext keys are never returned or saved in browser persistence.
- Day groups with their own name and benefit/description. Home shows each group's
  title, benefit on another line, then a supplement table with the check control
  first, then clickable name and a short muted benefit below the name. Taken rows turn green.
- Product name/manufacturer or an explicitly selected photo can be sent to xAI.
  Separate camera/library controls are available. A photo may contain several
  readable products: each is independently researched and saved with progress,
  partial successes and unreadable/failed explanations. All groups and existing
  supplements (including earlier batch additions) are included for compatibility review.
  JSON Schema is checked again on the server; compatibility warnings remain attached to their timing groups. Analysis has sending/completed/error states.
- Supplement detail, manual group reassignment and deletion. Daily completion is
  derived using device timezone on the server; new local dates start unmarked while
  old completion records remain. No background midnight job is necessary.
- Public PWA shell can install/cache offline. Account data and changes require
  internet. API data, photos and keys never enter the public worker cache.

AI now performs real web research via xAI Responses. Exact manufacturer directions,
serving size, ingredients, cautious benefits, timing and whole-routine compatibility
are validated against a strict 1.4 schema; source URLs must occur in provider tool
metadata. Details include manufacturer dose, per-serving/daily quantities and
server-calculated EU adult food-label NRV percentages for 27 vitamins/minerals.
Ambiguous variants or unsupported units stay unknown instead of inventing a dose.
NRVs are label references, not personal medical prescriptions or upper limits.

Analysis is progressive. ONE fast structured response identifies and provisionally
groups every readable product from a name/photo, with all groups and the existing
routine included. English instructions request the selected app response language
(en by default, persisted lt when chosen). Schema 1.4 enforces the language marker
for detailed results. Real test: the supplied seven-product photo was recognized
and provisionally grouped in 5.8 seconds using grok-4.3 with reasoning none; this is
one measurement, not a latency guarantee. Exact brand names remain untranslated.

All recognized records are saved immediately with visible queued/researching/failed
states. A bounded queue researches up to three missing/stale details concurrently
using the selected research model (grok-4.7, low reasoning). Source/dose/NRV rules
remain strict. Each target sees every other draft/saved product; uncertain contexts
cannot receive blanket safe assessments. UI polling resumes after iOS suspension,
allows new queued inputs during recognition or enrichment and never puts photos/keys in browser storage.

Within an account, exact product/variant identities reuse confirmed information in
the SAME language for up to 30 days. In-flight identical products are not rebilled.
Historical saved text retains its language until explicit refresh. The detail page's
refresh action uses the current app language and makes one research request without
recognition or a duplicate product row. Manual group edits win; compatibility is
marked stale if the collection changes during research. Interrupted queues are not
automatically retried; their records remain visible with retry controls.

Limits: 30 groups, 40 supplements; 4 submissions/minute and 30/day per owner;
one simultaneous recognition and at most four running jobs/account, eight globally.
Four bounded provider slots with recognition priority; one background research at a
time leaves capacity for interactive work. A fast submission plus per-product web
research may incur several xAI charges. Raw photos are released before background
work begins. Single API instance; no distributed queue/payload durability is implied.
The add dialog displays each upload's queued, recognizing/grouping, researching and
finished/failed stages, including every recognized product and skipped label.
Closing/reopening keeps the process view and the unsent draft/photo in memory.
Reload restores active jobs and the latest 20 history entries from the authenticated
API (seven-day retention); an unsent photo is intentionally not persisted. The form
unlocks after the server accepts an upload, so another name/photo can join the queue
while earlier recognition runs. Up to four uploads can be active per account.
Read server/ANALYSIS.md for provenance, lifecycle and calculation limits.

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
server/structured-chat and server/structured-research examples are contributed to canonical pwa-toolkit, with
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

Optional explicit paid end-to-end verification against a disposable DB:

```bash
LIVE_RESEARCH=1 PROVIDER_TEST_KEY_FILE=/private/path/to/key server/scripts/test-isolated.sh
```

Browser checks build to .runtime/browser-public so they never disturb mounted
production docs. Mail DNS records and delivery activation steps: server/mail/README.md.

## Remembered sign-in

Sign-in survives app/browser restart and has no server time expiry. Only the
revocable opaque token and nullable expiry are persisted on the device, never a
password/profile/API key. Logout, password change/reset, admin blocking or account
deletion revoke access. Clearing site data or OS eviction still removes sign-in.
Migration 004 upgrades only still-valid sessions; a previously lost session requires
one new sign-in. Reusable toolkit defaults remain session-scoped and twelve hours.

## Compact Home, timing groups and reference dosing (0.7.0)

AI schema 1.4 separates benefitSummary (2–5 words, maximum 6 / 80 characters) from
full benefits. Home uses a two-column check/name table, with the short summary under
the name. Full evidence-qualified prose remains in details. Older records fall back
to compactText without changing full saved text. The reusable plain-text limiter is
contributed to app-modules 1.8.0 with Unicode/length tests and TEXT.md usage guide.

Grouping uses the most specific existing timing group (including with-fat meals).
Dose/variant uncertainty and low overall confidence require review but do not erase
an otherwise explicit timing match. Potential conflicts/duplicates still block
automatic assignment, and manual edits during research remain authoritative.

When exact manufacturer daily directions are unavailable, research must attempt a
separate doseFallback from authoritative clinical/regulatory primary sources: an
established adult intake reference or an explicitly supported usual adult supplement
range. Detail labels it separately with source, population/limits and explanation.
It is not a personal prescription, capsule count or replacement manufacturer claim.
Absent suitable evidence, the amount remains unavailable with a reason. Clinical
trial regimens, upper limits and EU label NRVs must never become default doses.
Fallback amounts do not fill label servings, ingredient amounts or NRV daily math.
Old analyses remain readable; explicit detail refresh obtains the new dose lookup.

## Compact supplement detail (0.8.1)

The initial detail view contains dose (with qualified fallback when available),
benefits, full compatibility and timing. A native, keyboard-accessible More/Less
information disclosure contains manufacturer/variant, longer review explanations,
how-to text, cautions, nutrients/NRV, source links, research metadata and refresh,
group and delete actions. No saved information is discarded. Expansion survives
redraws for the same product but resets for another product or sign-out; it is not
persisted. A stale compatibility notice remains with compatibility so its meaning
is clear. Draft doses stay pending until detailed research is ready.

## Design A and sheets (0.8.1)

The Sage mockup now drives the complete UI: warm paper, sage buttons and completion
rows, a serif wordmark/titles, a real daily progress ring and integrated group cards.
Benefits remain short, muted and below each product name per the later user request.
Light/dark/system preferences still persist. Home has no fabricated streak/health
statistics; completed upload reports collapse behind Recent additions.

Home and Day groups are primary tabs. Detail and Account are routed native bottom
sheets; Add supplement and group editing are sheets too. Close, Escape and a downward
swipe on the grabber dismiss them. Browser Back closes routed sheets; the underlying
tab and scroll position remain. The upload draft/history survive dismissal. Native
focus containment, reduced motion, safe-area padding and the shared keyboard height
are reused from app-modules/bottom-sheet. Confirmations opt into sheet presentation.

Detail keeps four primary cards and More information disclosure. An unavailable or
still-researching dose displays small italic `not determined` / `nenustatyta`; verified
manufacturer directions and qualified adult fallback amounts retain their meaning.
No model prompts, accounts, production API or database data changed in this release.
Browser checks cover EN/LT, themes, drafts, navigation, focus, disclosures and unknown
dose. Desktop/WebKit checks cannot replace a final installed-iPhone hardware review.

0.8.1 tightens the product hierarchy: Home group descriptions/column-heading rows
are removed. Each product has a title, then a bold manufacturer and regular short
benefit on one muted line. Details start with that same clean title and separate
manufacturer/explicit label strength/form. productLabel is presentation only:
source names and research records stay unchanged; no strength is derived from doses.
The previous extra supplement wordmark is removed from the product sheet.

Downward dismissal accepts the full sheet header and noninteractive content at its
scroll top. iOS uses a non-passive touchmove path, because Safari can cancel native
pointer scrolling. Downward pulls within an already scrolled document scroll as
normal; inputs/buttons and upward movement never dismiss. The grabber still works
with a mouse. Both synthetic gesture isolation and real Chromium touch input are
covered; final installed-iPhone behavior requires the actual device.

## 0.9.0 analysis performance

Recognition still returns a single concise preview for every readable photo product.
Up to three detailed research requests now run concurrently instead of serially;
new photo recognition retains a reserved provider slot. Time groups are planning
slots, separate from compatibility review. Potential conflicts keep a visible Home
warning and full detail explanation; they no longer silently remove the schedule.
Unknown manufacturer timing may retain a clearly provisional slot. Manual grouping
is preserved, including unassign. Existing dose/source validation remains intact.
See server/ANALYSIS.md for measured baselines and owner-scoped legacy reconciliation.

0.10.2 adds confirmed account-scoped DELETE /supplements with {confirm:true}.
It deletes supplements/completions and analysis jobs only; groups, API credentials,
preferences and account/session remain. The owner row lock serializes recognition
commits; recognition checks its job still exists inside that transaction, preventing
late results from restoring deleted data. Queued recognition checks before sending.
Already-sent provider requests cannot be recalled; their results are discarded.
Client resets private upload/history state and invalidates outstanding reads. Test
only isolated DB data; never invoke destructive smoke checks on production users.

0.10.3: one Upload photo / Įkelti nuotrauką file input (accept=image/*, no capture).
iPhone owns the camera/library/file chooser. Keep single-column full-width picker
and the one-request/explicit-detail consent text. Removed forced camera input;
photo cleanup and handlers must never reference a missing camera control.

0.11.0: one submission accepts images[] (up to 5) and legacy image. The browser
prepares images sequentially with a 600,000-byte JPEG budget each, reducing longest
side only as needed. The aggregate data URL budget is 4,300,000 characters, below
existing Node/proxy limits; no proxy reload needed. All image parts go into ONE
structured request, with cross-photo product deduplication. Raw images stay in
memory and are dropped on success/error. Draft previews survive sheet closure,
selection can append more photos, and remove clears the batch. No extra research.

0.11.1 changes benefit/benefitSummary prompts to 2–3 comma-separated single-word
keywords in the selected language, with noun forms and no support/health filler.
Examples are formatting only; unsupported benefits must not be invented. Applies
to both compact recognition and opt-in detailed research. Existing stored results
are preserved; no automatic re-analysis or paid requests on opening the app.

0.11.2 groups all selected photo previews into one padded sage grid: three equal
square thumbnails per row, center-cropped only in CSS. AI payloads remain uncropped.

0.11.3 adds an accessible per-thumbnail remove button. Removing invalidates any
pending image preparation, keeps remaining order, changes submission ID, and never
submits removed data. Existing remove-all and three-column crop grid remain.

## 0.12.1 — focused opt-in product details

Get detailed information now researches only the selected identity in one web-backed
request. product-details.mjs narrows the stored 1.4 contract: composition (amountNote
is a short ingredient explanation), verified usage and 2–3 benefit sentences. Reserved
compatibility/caution/evidence prose fields are empty. No routine contents are sent.
The API preserves the selected group; automatic grouping review remains separate.
Quantity/source verification and distinct adult-reference fallback remain intact;
unknown quantities are null, never invented capsule doses. The UI shows Composition,
Usage and Potential benefits for new and historical records, plus a localized doctor
consultation footer. Source links and management remain in the disclosure. Existing
records are not rewritten or billed automatically; explicitly refresh old prose.
No DB migration or mail changes.

## AI pipeline and diagnostics (0.13.0)

Grok extracts identities and visible ingredients; JEV assigns one group and up to
five localized benefit categories. The previous Grok pipeline remains selectable
through `AI_PIPELINE=grok`. See [analysis contracts](server/ANALYSIS.md) and the
[100 English/Lithuanian benefit categories](server/BENEFITS.md).

Open **Account → AI dashboard** for the latest 20 requests: persisted stages,
provider timings, queue-inclusive elapsed time, models, calls, product counts,
composition coverage and errors. Older jobs may have no detailed metrics. This
is owner-only diagnostic data; credentials and images are never shown.

Version 0.16.3 refines supplement details: restrictions/interactions are inside
More information, followed by a full-width Get detailed information action.
The Sage light/dark presentation, pending state and expanded disclosure are preserved.

Version 0.16.4 moves Refresh information into the More information disclosure.

Version 0.17.0 checks the selected day group during full product research and
corrects an unchanged AI assignment using manufacturer timing evidence. Manual
choices remain unchanged. Initial recognition also respects meal recommendations
and flexible any-time groups; no additional grouping request is introduced.

Version 0.18.0 removes product-specific timing rules and shortens Gemini prompts.
Detailed research returns manufacturer, composition, brief benefits and usage only;
AI-selected groups are checked, while manual assignments send no group context.

Version 0.18.1 adds accessible show/hide password eyes to login and registration.

Version 0.19.0 replaces top navigation with a floating Home/Groups/Account pill.
Recent additions remain available in the upload dialog and are removed from Home.
Historical AI descriptions are translated and cached in the selected English or
Lithuanian language; new requests also use that explicit preference. Home's desktop
header follows the latest reference: ring left, Today/date and the Add action stacked right, without motivational copy.

The Add supplement sheet uses a centered name placeholder and a collapsible Upload
queue with an active-job spinner. Cancelling the native picker preserves the draft.
Launch shows only a theme-aware central progress bar while session/dashboard and
public worker updates are checked; available updates activate before opening Home.
The update check is bounded at 3.5 seconds for offline/slow connections; later updates
continue to use the existing unsaved-edit guard. No private profile is cached.

Version 0.19.1 lowers the floating navigation to match the bottom placement in the
reference, with a 20px bottom gap on a 34px iPhone safe area (12px minimum elsewhere).

Version 0.20.0 makes Account a normal main-scroller tab beside Home and Groups;
the floating navigation stays interactive. Profile, preferences, AI connection and
data actions have separate Sage cards. Only product details and diagnostics use
the routed sheet. Home's summary-to-groups gap is 8px, reduced by 40px.

Version 0.20.1 adds Training (flexed arm) and Sleep (Zzz) group icons. Leaf,
Time, Home, Calendar and Information leave the picker; saved custom SVGs remain valid.

Version 0.20.2 removes the header wordmark and global brand footer. Version is
shown only in Account. The Home summary has 18px above (after the status safe area)
and below, increasing its gap to groups by 10px. Main bottom scroll clearance uses
the actual navigation height/offset plus 16px, with no trailing group margin.

Version 0.20.3 bounds the detailed-research benefit preview before validation, so
a verbose preview cannot discard valid ingredient/usage evidence. Full benefits,
amounts, source binding and manual group protection are unchanged. Research checks
the official local-language site and may use primary ingredient references when
an exact label is unavailable; retailer quantities remain unverified.
Product details always show Refresh information and Delete supplement below the
group selector. More information contains only actual researched extra content and
is absent for basic/draft records. The generic consultation footer is removed.

## 0.21.0 — selected Groups B / Account A

The chosen reference images are mandatory: Groups B uses the summary strip, joined
icon/count rows, overflow menus, Training/Sleep quick templates and custom creation.
Daily order, the Reorder action and the generic Edit group row are omitted. Grip
dragging, arrow keys and menu move actions persist all owned IDs atomically via
PUT /groups/order; failed/cancelled movement restores the server state.
Account A uses a profile/edit card, automatically persisted language/theme rows,
AI connection management, Security and Tools cards, clear data, logout and version.
Native auth forms and ownership rules remain; administrator controls stay role-bound.
There is no preferences Save button. API key suffixes are not invented or exposed.

Latest explicit research policy supersedes earlier primary-only quantity rules:
show all returned AI quantities and usage, including retailer-reported data. The
focused pipeline stores those values with evidence=reported instead of erasing
them or failing the whole request; no invented citation becomes a link. Source
kinds and reported status are retained separately, with manual groups preserved.
Unrelated-brand substitution and invalid payload types still cannot overwrite
the selected product. Raw requests/photos/keys remain private and out of Git.
Product controls use a 12px gap with no visible Day group label. More information
is one connected sage surface; confirmation actions share one 50/50 row with gap.

## 0.21.1 — unified typography

Groups supplies the system sans-serif stack for all pages, authentication, product
sheets, editors, confirmations and image previews. Account uses the same page-title
size/weight as Groups and its section/item hierarchy. No serif heading overrides
remain; icon fonts, editable-field sizing and viewport/keyboard behavior are preserved.

0.21.2: Account preference selects inherit the model-row text size and line height.
Native select padding/min-height no longer inflate rows; the parent retains its
44px touch target and the shared card padding remains unchanged.

0.21.3: Account removes the standalone AI connection card. Manage connection
now lives in Tools, retaining key/model save/removal and connection status inside
the disclosure. Setting cards use a reduced bottom inset because rows already
provide vertical padding; preferences retain 44px touch targets.

## 0.21.4 — bounded focused extraction recovery

Focused Gemini detail research may repair an invalid extraction exactly once using
the existing grounded evidence; it never repeats search or retries key/network/rate
errors. Normal success remains two calls. This supersedes the earlier no-repair
policy for focused extraction only. Successful records store extractionAttempts.
An unpaired optional group decision becomes null, preserving independently valid
composition/directions without applying a move. Foreign groups and invalid product
facts still fail validation. Failed jobs/products store only closed stage/reason
enums (lookup/extraction; invalid_json/incomplete_output/invalid_fields/provider_error),
never provider bodies, prompts or keys. Legacy/recognition transports stay unchanged.

## 0.21.5 — compact upload results and actual group changes

Upload results are full-width compact product buttons, grey while pending, green
for completed/reused research and rose for failure. Status is accessible without
repeated visible text or list bullets. Actual automatic group moves are captured
in the enrichment transaction with before/after IDs and name snapshots, saved
in the product and owning job, and listed below the products. Manual/concurrent
choices and rejected proposals never become move events. Legacy upload history
may use matching researched analysis/initial identity only; new tracked jobs never
infer moves. No extra provider calls or database migration.

0.21.6: Per user styling, native buttons/selects, disclosure controls, navigation
and the photo picker show no focus ring. Actual keyboard focus/activation and
selected-state styling are retained; editable text-field focus is unchanged.

## 0.21.7 — composer and account control refinements

The composer uses a muted name/manufacturer placeholder and a centered queue
control close to Send. Provider/charge information lives in Account diagnostics,
with disclosure expansion retained across diagnostic redraws. Native focus/visibility
resume skips Home refresh while the composer is open; empty file selections still
leave the draft untouched and existing background jobs keep polling independently.
Empty-group text is left-aligned. Groups/Home add discs are SVG circles with square
bounds. Account deletion confirmation has a 20px native checkbox inside a 44px
clickable label; generic text-input styling no longer stretches it.
Group description and custom icon textareas start at 46px (one row), retaining
vertical resize and the existing input limits.

## 0.22.0 — explicit whole-routine recheck

Home Recheck all starts one Gemini structured request with every group and stored
product fact (manufacturer, composition/amounts, usage, benefits and sources). This
explicit review uses existing evidence, not Search or new product research. Manual
groups may receive proposals but are changed only by individual owner acceptance.
The reusable toolkit bottom sheet shows indeterminate queued/checking progress.
A separate pending-suggestions button reopens saved proposals without another bill.

GET/POST /rechecks and PATCH /rechecks/:job/:proposal ({action:accept|remove})
reuse owner-scoped analysis_jobs JSON, without migration. Pending reads are not
limited to the latest 20 jobs; routine checks stay out of upload history. Repeating
a live request is idempotent. New checks refresh unresolved proposals for the same
product in place and retain other unresolved proposals. Closing/reloading preserves
work; API restart marks interrupted work failed without billing it again.
Accept validates that product facts, assignment origin and group meanings still
match the proposal, then moves only that supplement atomically as a manual choice.
Completion and translation caches do not invalidate proposals. Remove discards only
the proposal. Clear/account deletion cancels late writes and erases private jobs.
No credentials, raw prompts or photos are stored in proposals/browser persistence.


## 0.22.1 — routine loading on the Taken ring

Home has no separate routine-loading/status paragraph. Dashboard reads, completion
writes and active upload/research/localization work animate a dedicated stroke on
the Taken circle without rotating its count or shifting groups. Settled reads,
failures and session reset clear the indicator; reduced motion uses a static arc.
Detailed job progress/errors remain in Upload queue and action errors use toasts.


0.22.2: Recheck uses a theme-aware indeterminate progressbar with a 25% segment
that moves smoothly back and forth using ease-in-out/alternate. The animated node
stays connected across polling so its movement never resets on server refresh.
Reduced motion shows a static centered segment; no fabricated percentage.


## 0.22.3 — distinguish ordinary food from fat-specific scheduling

Recognition, focused researched timing, explicit Recheck and legacy adapters use
one shared model-side timing policy. A group name/description is read as a whole:
a meal-with-fats slot requires explicit fat-meal directions or a supported relevant
fat-dependent absorption benefit of the actual formulation. Ordinary with/after-food
directions alone use a plain-meal group, or a flexible slot if no plain-meal group
exists; usage still retains the food instruction. No product-name overrides, quotas
or forced distribution are permitted. Current AI grouping is not independent
evidence and is retained only after checking the group's defining conditions.

The grounded lookup preserves required/preferred/optional food wording and never
adds fat advice to justify a chosen group. Search remains mandatory for detailed
research; private groups enter extraction only. Manual research still omits timing
context and schema fields. Manual assignments and source/snapshot guards remain
unchanged. Recognition classification.policyVersion is 2 for new results.

Previously stored analyses/groups are not silently rewritten or re-billed. Recheck
uses the new policy to save individual proposals; acceptance remains explicit.


## 0.22.4 — permitted timing versus a useful routine preference

Shared AI policy distinguishes mandatory timing, supported preferences and merely
allowed alternatives. An explicit permitted bedtime option or documented compatible rest/sleep
purpose supports a bedtime scheduling preference; allowance of morning does not
justify demoting an already compatible bedtime group to Any time. Do not apply
a bedtime rule to every form of the same mineral/ingredient or claim sleep efficacy.
The same grounded lookup now includes official product usage/FAQ timing notes,
keeping these separate from exact label requirements. No extra search stage,
product-name rule, automatic rewrite or manual-assignment override is introduced.
New recognition classification.policyVersion is 3. Existing records can receive
individual explicit Recheck proposals; full research still obeys owner/snapshot guards.


## 0.22.5 — clear-all finishes Taken animation

Every start/finish of the shared write counter refreshes the Taken busy state,
including Account clear-all, explicit research, upload submission and recheck
decisions. Clear-all's final counter decrement previously left a stale loading
class after reset/dashboard had already rendered while that write was active.
Keep the ring active for genuine outstanding reads/jobs and settle it on both
success and failure. No API, AI, scroller or private persistence changes.


0.22.6: Empty Home hides the entire Recheck footer. Available public app updates
show one full-width Update Application button, without an explanatory surface or
paragraph, separated from preceding content by 16px. EN/LT labels and existing
startup activation, dirty-form/photo/write guards remain unchanged.


0.22.7: Groups and Account use exactly the Home floating navigation geometry,
typography, icon sizes and surfaces. Remove tab-specific navigation overrides,
including --nav-height, so footer clearance and safe-area positioning agree on
all three pages. Only the active aria-current pill changes on tab navigation.

0.22.8: Home navigation keeps the original outline house glyph even when active; only its surrounding selected pill changes.

## 0.23.0 — Routine wizard B

Account → Preferences → Daily routine opens the selected B design from
[design/routine-wizard-b.png](design/routine-wizard-b.png): an editable day timeline,
contextual time sheet and grouping preferences. Existing sheet, color, typography,
icons, native select and iPhone scroller contracts are retained. English is the
first-use default; Lithuanian and both themes are supported.

Breakfast/lunch/dinner each have eat/skip/varies choices. Exercise has yes/no/varies,
weekly frequency and timing. Sleep has timing. Times use a selected 15-minute clock,
predefined approximate windows (including midnight crossings), or explicit variable
time. Skipped events omit timing. Daily regularity, rhythm/fewer/keep strategy and
an optional evening-rest preference complete the profile. Every event must be
answered before moving on; no free text or invented daily schedule is saved.

Migration 011 adds owner-only `tracker_preferences.routine` and `routine_revision`.
GET/PUT `/settings/routine` uses `{routine,revision}` and optimistic revision checks.
Strict enum/shape validation rejects arbitrary instructions. Clear-all retains
preferences; account deletion cascades them. Drafts stay in memory only, and are
cleared on logout. Cancelling a time editor does not change the wizard draft;
closing a changed wizard offers discard confirmation. Failed saves preserve edits.
A revision conflict requires closing/reopening against the latest server state.

Saving starts no AI call and does not move existing supplements. Recognition gets
the profile for new initial assignments; focused details gets it only for AI timing,
and Recheck gets it with the owned routine. Search receives public product identity
only. Manufacturer constraints/manual choices still win. With a saved profile,
detailed research stores facts and an optional `groupingSuggestion` without moving
an existing assignment; use Recheck for individually accepted moves. Preference
revisions invalidate in-flight classification/rechecks and old pending proposals;
changing preferences during research cannot apply an outdated automatic move.
No scheduling preference is a dose, safety conclusion or sleep efficacy claim.

Validation includes owner isolation, persistence, malformed choices, optimistic
conflicts, profile changes during AI work, Search/manual privacy, editor cancellation,
failed-save recovery, EN/LT, themes, responsive layouts and the selected design states.
Design preview PNGs remain available at `/previews/`, outside the worker asset cache.

## 0.27.0 — personal routine and durable conclusions

Account Tools follows the user card and contains Daily routine (sliders icon).
The wizard now has My day / About me / Preferences tabs, no numbered steps or
policy paragraph. Version 1 saved routines remain readable; explicitly saving the
three-step editor upgrades to version 2 with optional personal fields. Not specified
is a valid answer. The goal sheet provides 36 stable choices, at most 3, plus none;
Save changes only the local draft, X discards that selection. Main Save is still
revision-guarded, scrolls with content and never calls AI or changes groups.

Personal includes optional sex/date of birth/height cm/weight kg/muscle kg/goals
and allowAI=false by default. routineForAI is the only provider serialization path
in recognition, detailed timing, Recheck and conclusions. Without consent omit the
whole personal object; with consent omit every null/unspecified parameter and empty
goals, and replace date of birth with ageYears. Search remains product-only. Private
profile/report data never enters browser persistence. Profile validation bounds
numbers/dates and rejects more than 3/duplicate/unknown goals and muscle>body weight.

Migration 014 creates the latest owner-only durable routine_conclusions report.
GET /conclusions is read-only; POST with requestId explicitly starts one async,
rate-limited structured report using server-owned grouped products, groups, routine
and consent-filtered personal data. Version 2 routine required, unspecified personal
fields allowed. Existing queue/model/credentials used; no new provider configuration.
Report jobs stay out of Upload queue. Restart marks unfinished jobs failed without
retrying or charging twice; prior completed text remains. Reports and pending
individual suggestions survive upload-job expiry/reload until regeneration/decision;
valid pending proposals carry into regenerated reports. Clear-all/account deletion
erases reports and invalidates late writes. No raw prompts/photos/keys are persisted.

Report sections cover routine, possible benefits, overlaps, recommendations and
unknowns. Model must distinguish facts/possibilities, avoid invented doses/diagnoses,
consider exercise/optional muscle mass without diagnosing adiposity from BMI, and
avoid adult assumptions for children. Paused grouped products are context only.
No automatic group changes: PATCH /conclusions/:report/:proposal accepts/removes one
proposal with routine revision, product/pause and group fingerprint guards. Suggestions
for other products remain actionable after one accepted move. Report inputs have a
semantic hash: routine/profile/consent, grouped product facts/directions/cautions,
pause state and group meanings. Changes show an outdated warning; Taken changes and
translation caches do not. Old text stays visible during refresh/failure. Logout/clear
aborts polls and closes/clears all new sheets. EN default/LT, common header, cards,
switches, animated progress and existing PWA dirty/update guards remain in use.

## 0.27.4 — resilient translation jobs and honest queue results

Translation used one product-specific anyOf schema and rejected the whole batch
when any field/numeric literal differed. The new localization-provider adapter
uses deduplicated stable text slots, opaque exact-number placeholders and a simple
wire schema. Server restores quantities and enforces the original strict checks.
One bounded repair retries only invalid/missing slots; key/network failures never
retry automatically. Good products persist even when a neighbour fails. Cache
fingerprints still reject stale source text; no source amounts/groups/provenance
change. Provider text and credentials never enter logs or diagnostics.

Localization items are existing products, not additions. Queue steps, progress,
summary, product aria-labels and retry action are translation-specific, including
legacy failed jobs. Generic format errors no longer claim Nothing was added.
Original details/amounts/benefits remain visible with an original-language notice
until translation is ready. Retry translation submits up to four owned product IDs
to the localization endpoint only. No recognition/research/addition is triggered.
Per-product saved/stale/failed outcomes remain explicit. A job existence/owner lock
prevents late translations after clear-all. No schema migration required.

## 0.28.0 — app-modules 1.12.2 and launch-only automatic updates

Upgraded the copied shared library from 1.11.1 to canonical pwa-toolkit 1.12.2
(fab694d). App-specific EN/LT strings now live in src/translations/ and merge over
the unchanged upstream dictionaries; the build includes these overlays. The existing
copied password-visibility browser adapter remains compatible. Confirmations use
the new shared lifecycle with the app's existing header and two action columns.

setupPwa owns one bounded four-second startup check, covering registration,
installation and activation. The app awaits waitForStartup() and calls
finishStartup() before hiding its existing themed loading screen. onUpdate only
offers the explicit Update Application action; it never calls apply automatically.
No background/foreground/idle auto-update checks or reloads. Late/other-tab worker
activation cannot reload interactive UI. Dirty form, photo, password, pending write,
report and wizard guards still apply to manual updates. A stalled worker cannot
leave the loading screen stuck. Saved-session restoration still precedes reveal.

Generic workflow server files are included as library source only. No app API
classes, SQL schema, data or deployment are upgraded by this frontend release.
Validate unit and browser suites, including startup, late update, other-tab
activation and blocked registration; preserve existing iPhone appearance.

## 0.29.0 — supplement inventory and recurring usage schedules

The product detail sheet has a Schedule and stock disclosure styled like existing
controls, with explicit Save/Cancel. Frequency supports daily, selected ISO weekdays
or every 2–90 local-calendar days from a chosen date. Up to six distinct exact times
and an explicit integer quantity/unit per occurrence. No AI dosage inference and no
notifications. An untimed daily plan remains the backwards-compatible default.

Inventory is optional, owner-scoped and configured on the same product page:
remaining amount, low-stock threshold, and direct remaining-count adjustment after
refill. Low stock appears on Home and in the editor. Completion and stock movement
share an owner/product transaction. Unique (product, local day, slot) makes repeated
or concurrent Taken requests idempotent. Undo credits only the actual debit; stock
never becomes negative and zero stock does not block recording a real intake.
Tracking epochs prevent pre-disable undo events from inventing new inventory.

Home shows/checks each scheduled occurrence independently; the ring counts intakes.
Rest-day products remain reachable in a Not scheduled today disclosure and do not
count as pending/missed. Paused products retain existing pause behavior. Usage
calendar projects immutable plan versions plus each completion's time, amount,
unit and historical group snapshot. New schedules start today only with no recorded
intakes; otherwise tomorrow. Subsequent edits cannot rewrite older days. Inventory
changes apply immediately. Existing completion records migrate to the daily slot.

Drafts survive polling/native picker focus; Save uses intake revision checks and
conflicts retain the draft. Cancel loads the latest known state; closing/logout
clears it and invalidates late saves. Unsaved/busy intake edits guard manual updates.
Schedule context reaches private Recheck/Conclusion synthesis and invalidates old
reports/proposals semantically; stock and Taken changes do not invalidate reports.
Manufacturer facts/ingredient mg stay separate from the user's inventory units.

Migration 015_intake_stock adds plan/inventory fields, immutable plan history and
occurrence-level completion columns/key. Apply before starting the new API. User
and product deletion cascade through the new history; existing data stays intact.
No new secrets or paid provider calls. Shared pure intake-plan functions contributed
to canonical pwa-toolkit/app-modules 1.13.0 and copied for the isolated API container.
See modules/docs/INTAKE-PLAN.md for contracts and validation.

## 0.30.0 — wellbeing journal matching the selected reference

Account → Tools → Wellbeing journal opens a full-height bottom sheet above Account.
The mandatory reference is design/wellbeing-journal-reference.png. The screen keeps
its composition: centred title/X, previous/next local-day navigation, seven ISO
week day pills, five expressive face ratings, sleep/energy/digestion dot ratings,
six inline observation toggles, a note, actual intake summary and in-flow Save.
Native calendar day labels remain correct (the generated reference's weekday/date
mismatch is not copied). App typography, sage colors, theme variables and safe-area
scroller are reused. English default/Lithuanian explicit. No external icons/fonts.

Four ratings are nullable integers 1–5; a selected rating can be cleared, keyboard
arrows/Home/End select with roving focus. Observations are six stable allowlisted
IDs, note <=1,000 characters. All are optional; a completely blank new day disables
Save. An existing entry can be cleared explicitly. Nothing auto-saves. Prev/next,
week pills, X, swipe/Escape and browser Back preserve a dirty draft until the user
confirms discard. Save conflicts/network errors retain it; reloading a saved entry
asks before discard. Busy saves prevent leaving. Manual updates guard this draft.
Date/owner epochs and aborts prevent late requests from repainting another view.
No private journal cache/storage; logout clears DOM/draft immediately.

GET /v1/wellbeing?from=&to=&timezone= reads a bounded 42-day maximum window and the
existing owner-scoped historical usage projection for per-day intake counts.
PUT /v1/wellbeing/YYYY-MM-DD accepts {revision,entry,timezone}; the owner comes only
from authentication. A user/day key, owner lock and optimistic revision prevent
cross-device overwrites. Invalid/future dates and unknown fields/tags are rejected.
The earliest editable date is 2000-01-01. No AI, medical/causal conclusions, stock,
completion or group writes. Journal data is not added to any AI prompt.

Migration 016_wellbeing_journal adds independent owner/day records and account
cascade cleanup. Clear all supplements retains personal journal entries. API read
refactoring reuses TrackerApi.usage without another auth/limit dispatch. Shared
nullable rating-group contributed to canonical app-modules 1.14.0 with keyboard,
validation and lifecycle browser regression plus usage documentation.

Visual checks cover EN/LT, light/dark, 320/402/768px and a 480px keyboard-sized
viewport; actual top/bottom screenshots are compared with the selected reference.
All controls remain reachable and Save is never fixed/sticky. Schema/API checks use
only the disposable DB, never production journal data or paid AI calls.

## 0.30.1 — floating navigation paint isolation

Fix the reported iPhone navigation being partially covered by scrolling product
rows. Main now owns an isolated z=0 stacking context; accelerated table/card layers
cannot escape into the fixed navigation. The translated navigation shell has its
own stable layer and isolation. Its translucent blurred glass surface is a separate
pointer-transparent ::before layer; links/icons/labels paint above that surface.
No filter is applied to the interactive shell. Both light/dark surfaces retain the
existing gradients, geometry, selected pill, safe-area positioning and keyboard
visibility. Shared graduated body edge masks and full-height scroller stay intact.

Regression stresses accelerated/high-z product cards at multiple scroll offsets
on Home/Groups/Account, checks hit testing over every tab, and verifies native modal
sheets remain above navigation. Existing phone/tablet geometry, safe-area and
keyboard tests remain applicable. This is an app-only CSS fix; no API/DB or shared
module upgrade. Desktop checks cannot reproduce the physical iPhone compositor.
