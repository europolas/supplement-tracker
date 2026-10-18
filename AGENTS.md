## 0.33.2 — custom export dates only, iOS input sizing

Data export renders From/To editors and their range hint only for Custom period.
7/30/90 presets still calculate dates in memory and send the same validated API
payload, including when no editor exists. Switching to Custom retains preset dates.
iOS date fields use explicit appearance/inline sizing, zero intrinsic grid minimums,
a shared 46px height and a single column at <=360px. Native date pickers remain.
Navigation, PDF rendering, backend and shared modules are unchanged.

Validation: 42 unit checks and both export flows pass in Chromium and WebKit.
Custom controls were measured at 320/402/768px in both themes and the actual
WebKit screenshot inspected. Live LT checks confirm hidden preset editors,
custom-field sizing and hiding again when switching back to 90 days.

## 0.33.1 — navigation bounded by the visible iPhone viewport

Repeated partial navigation was previously treated as scroll-layer overpaint
(0.30.1 isolation/glass split; 0.31.1 manual popover). Those changes cannot repair
coordinates below the visible viewport. Navigation still used --app-height,
which setupViewport deliberately sets to full screen.height in installed iPhone
mode. screen.height and the currently visible browser viewport can differ after
restoration, browser chrome changes or keyboard dismissal.

src/navigation-viewport.js measures min(innerHeight, visualViewport.height plus
nonnegative offsetTop), updates --nav-viewport-bottom once per animation frame on
resize, orientation, visual viewport resize/scroll, pageshow and visibilitychange,
and offers cleanup. Navigation uses that bound, preserving its existing dimensions,
safe-area clearance, top-layer lifecycle, modal order and active tab appearance.
The verified shared full-height main scroller and graduated edge masks are unchanged.
No toolkit, server or database change. scripts/build includes the new local module.

Regression first failed on the old code with an off-screen tab target when the
installed screen is taller than its visible viewport. It now covers all tabs,
scroll ends, 874→792→874px resizing, visual-only keyboard resize and pageshow restore.
Desktop emulation does not certify every physical iPhone/WebKit rendering state.

Validation: 42 unit and all 91 Chromium browser checks pass. The viewport
regression also passes in WebKit 27.2 in an isolated disposable container with
local static assets and mocked API responses on the same origin (no production
write/provider call). Live read-only review passes all three tabs, both themes,
three scroll positions and modal/logout ordering with a shortened visual viewport,
no browser errors; actual Account-at-bottom screenshot inspected. Earlier cross-origin WebKit attempts failed at CORS
preflight before login; the same-origin harness isolates the layout behavior.

## 0.33.0 — private period PDF export, selected B layout

Account → Tools → Data export opens the standard bottom sheet, with 7/30/90-day
presets and a custom from/to range (max 366 inclusive, ending today or earlier).
EN default/LT explicit, native full-width date fields and theme-safe app controls.
An explicit Download prepares the PDF, starts a Blob download and retains a local
Download again link; Refresh PDF explicitly refreshes the same range. Changing
range, closing or logout revokes the Blob URL. Epoch/abort guards suppress late
responses immediately on dismissal, without waiting for the close animation.
Ordinary polling does not redraw the date picker. No export state in localStorage,
IndexedDB, service worker cache or public file tree. Manual update guards include
export activity; launch-only auto-update behavior and navigation remain intact.

POST /v1/exports/pdf accepts only {from,to,timezone,language}. Authentication supplies
owner. One transactional snapshot serializes with owner writes; routine and current
inventory are explicitly labelled as current at export, while usage/assignments
and wellbeing are historical. Removed products with period history are included.
Routine profile fields in this private owner download do not depend on AI consent;
no data is sent to AI. The latest saved conclusion up to period end is included
with original text/score, and earlier period conclusions contain only date/score.
No invented score, missing diary rating, dosage, causal summary or provider request.

JSON response {filename,mime:'application/pdf',pdf:<base64>} uses the existing
credentialed JSON API client, never a public/bearer download URL. API cache-control
remains no-store. Browser validates PDF prefix/MIME/size before creating its own
Blob URL. The generic element URL guard stays strict: only the internally created
Blob URL is assigned to the download anchor directly. Rate limits 3/min and 30/day,
one render slot/process, bounded 366-day range/1000 prior reports/50 PDF pages and
8MiB output. Account/session validity is rechecked before returning PDF bytes.

B reference: design/exports/duomenu-eksportas-b-{1..4}.png. Current report is rendered
from a fixed, escaped HTML/CSS template with packaged DejaVu fonts, no JavaScript,
no service workers and all browser network blocked. A fresh Chromium process closes
on success/error/timeout; output remains in RAM and is not published. Docker installs
pinned Playwright 1.64.0, its Chromium headless shell/system deps and DejaVu. The
container remains nonroot/read-only/cap-drop; the renderer only accepts the fixed
app template, never arbitrary user HTML or navigation. Up to ~16s render budget
including browser launch fits the existing 20s API client. No schema migration.

Selected B composition preserves the two charts and summaries, full three-section
routine/group page, one-page inventory and complete saved AI report. Long reports
continue in matching pages, rather than clipping text. Inventory is fitted on its
own A4 page without truncating names/rows; very large lists necessarily shrink text.
No missing diary values are joined across gaps; periods over 12 days use labelled
consecutive groups with summed intake counts and averaged available ratings.
All bar counts are horizontally centered inside their bars, with the same 2-unit
baseline offset; zeroes are shown at that baseline without a fabricated bar.

scripts/sync-export-labels.mjs generates server/src/data-export/labels.mjs from app
and shared EN/LT dictionaries; edit src/translations and regenerate, not the label
artifact. Public synthetic A/B design PDFs also use the new count placement. Private
real-data exports never overwrite those synthetic public previews.

Validation: 42 unit checks; browser suite 89 passing plus both export flows passing
after the Blob download fix; isolated server integration 126 passing (2 opt-in
paid tests skipped). Live authenticated download verified with all 16 current
products on page 3, both themes at 320/393/768px and no browser errors. The real
7-page PDF was visually checked against B; no private report is published.

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

Validation: 42 unit, 88 browser and 122 isolated server checks pass (two paid
provider tests skipped). Read-only live LT review at 320/393/768px in both themes
confirms legacy unscored reports and public PDF downloads, without AI or data edits.
Actual score and retained-history UI screenshots inspected from mocked browser
flows; retention/new-name/new-photo behavior verified against disposable MariaDB.

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
Validation: 42 unit tests pass; 86 full-suite browser cases pass and the final
2 focused lifecycle/fallback cases pass after correcting their mock fixture.
Read-only live review passes all three tabs, both themes, three scroll offsets,
modal ordering and logout. Actual screenshots inspected with safe-area emulation.
Reference: https://webkit.org/blog/14445/webkit-features-in-safari-17-0/#popover

## 0.31.0 — earlier AI conclusions and export design samples

Account → Tools → AI conclusion history opens the existing conclusion bottom sheet
on its History view. Home Conclusion opens Current. History lists date, a short
plain-text preview and the original product count where known. Keyset pagination
loads 20 at a time; selecting a record reads the full immutable five-section text.
Archived text has no actionable group proposals or generation action. Current
report decisions keep the existing guarded per-product acceptance behavior.
Validation: 42 unit checks, 85 browser flows and 120 isolated server checks pass
(two opt-in paid provider tests skipped). Final targeted history/current flows pass.
Read-only live LT review covers 320/393/768px in both themes, legacy backfill and
full-text opening; both public PDF downloads return valid application/pdf.
Actual Chromium screenshots reviewed; physical iPhone Safari not tested here.

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
Verified: 42 unit and 84 browser checks pass. Read-only live Chromium review
with actual six-ingredient NAD+ Formula covers 320/393/768px in both themes,
center alignment, list rules and overflow; no AI requests or data changes.
Physical iPhone compositor remains outside desktop verification.

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

## 0.27.8 — conclusions without displayed sources

Grounded research remains mandatory, but the synthesis prompt omits source IDs,
URLs and bibliographies. API reads strip legacy S-number markers and withhold the
source list; stored evidence stays intact. The UI also hides sources/markers for
legacy API responses. No regeneration or migration is required for existing reports.

## 0.27.7 — readable conclusions and research headings

Conclusion synthesis explains recent findings in everyday language, short paragraphs
and practical benefits, without statistical tables or unexplained scientific jargon.
Grounded search and source references remain required. Research heading is localized
in EN/LT; a legacy-dictionary fallback uses the established Sources translation
rather than exposing the section key when static assets span releases.

## 0.27.6 — research-backed benefit conclusions

Explicit conclusion generation performs a grounded Google clinical-literature search
using public product/ingredient identities only, followed by private routine-aware
synthesis. Search receives no owner/product IDs, profile, goals or group context.
Require grounding metadata and encountered HTTPS sources; missing grounding fails
the refresh while retaining the previous report. Recheck consent/revision and job
existence between calls. Research does not update facts or automatically move groups.

Reports emphasize body-system benefits and recent human evidence with study years
and source IDs. Research replaces the missing-information/limitations section in
the schema, API reads and UI, including legacy reports. Grounded source links are
persisted with the report and rendered as safe external HTTPS links using existing
card styles. Evidence strength stays beside claims; never fabricate efficacy.
No migration; existing reports and unresolved group proposals remain supported.

## Conclusion inventory count correction

Conclusion prompts include server-calculated total, active, paused and per-group
product counts alongside every product record. Products with incomplete research
remain in the review; ingredient counts and group proposals are not inventory
counts. Existing strict assignment validation requires every submitted product ID.
No schema or frontend change. Regression covers 16 products including four with
incomplete details and a paused product.

## 0.27.5 — consistent main page gutters

Home, Groups and Account share the same responsive horizontal gutters and maximum
content width. Home retains its existing header top spacing. No API/schema change.

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

## 0.27.3 — paired Home routine actions

Conclusion/Recheck share equal-width columns separated by 12px, with 32px top
padding. Existing visibility rules remain independent; one available action fills
the row, neither leaves no empty space. Pending Recheck decisions span the row below.
No API/schema change.

## 0.27.2 — integer-only personal measurements

Height, weight and muscle mass each use one full-width native integer select.
Decimal controls are removed. Existing fractional measurements are rounded in the
editor draft and written only on explicit Save; opening/cancelling never changes
stored data. The server remains compatible with older profiles. Date sizing and
unspecified/consent behavior are preserved. No API/schema change.

## 0.27.1 — native personal measurement pickers

About me no longer offers Other for sex. A legacy Other value opens as unspecified
and only persists that change on explicit Save. Height/weight/muscle use native
whole-number and tenths selects, not editable number inputs. This keeps 0.1 precision
without thousands of options in one wheel; maximum values permit only .0. Clearing
a measurement returns null and retains the existing consent/omission contract.
The Safari date control is bounded to the same 46px border-box height/full width as
adjacent selects, including its intrinsic WebKit date value. No API/schema change.

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

## 0.26.3 — simpler routine headings

Routine removes the introductory breadcrumb/subtitle, preferences back arrow and
strategy section heading. The day tab and recap Edit action still return to the
first step without discarding the draft. Shared title/X headers are unchanged.

## 0.26.2 — scrolling routine actions

Continue and Save routine stay in normal document flow after the final form card.
Neither action is sticky or pushed down with an automatic flex margin; both scroll
inside the existing full-height wizard sheet without covering its choices.
No API or database change.

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

## Upload limit: 0.14.1

Up to six photos per submission. Browser compression shares the remaining 4.3 MB
encoded-image budget across selected photos (10 KB reserve); server/proxy limits
remain enforced. EN/LT help and server count validation agree.

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

# Generated application: agent handoff

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


Read README.md, then modules/docs/ARCHITECTURE.md, MODULES.md and LOCALIZATION.md.
Edit src/ for app behavior; modules/ is the copied versioned library. docs/ is
regenerated public output, not developer documentation. server/ is optional.

English is the default, Lithuanian the explicit second language. Add app UI keys to both src/translations dictionaries; shared toolkit keys stay
in modules/src/translations. Preserve saved language choices,
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
scroller; native route-dialog hosts product details/diagnostics and returns to baseRoute. Account is a main tab (0.20.0). Do not
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

## 0.12.2 — exhaustive multi-photo inventory

The compact identification prompt inventories each numbered photo independently
before deduplication, explicitly including separate blister strips, rotated foil
text, small/edge containers and distinct same-brand formulations. A final coverage
pass accounts for unreadable candidates by photo/position in skipped. No product
count is supplied to the model; unreadable identities must not be guessed. The
four-field response, one recognition call, existing grouping review and detailed
research remain unchanged. Photos still use high detail and the existing compressor.

An opt-in paid regression is available with `INVENTORY_PHOTO_DIR` (the four original
files named `1-Photo-1.jpg` through `4-Photo-4.jpg`) and `PROVIDER_TEST_KEY_FILE`:
`node scripts/check-photo-inventory.mjs`. It uses real browser compression, performs
two independent recognition calls and checks all 16 expected identities. Neither
photos nor keys are committed; no production account/database is modified.

## 0.12.3 — per-photo structured coverage

The production discovery adapter now requires exactly one indexed inventory for
every submitted photo, with a physical package position per product. This remains
one provider call; text-only input keeps its compact contract. The server validates
coverage (no missing/repeated/foreign photo indices), then deduplicates exact product
identities and saves the original four-field result. Same-brand distinct formulas
remain separate. Job metadata stores recognized/skipped counts per photo, not images.
Malformed coverage fails rather than silently saving a partial photo set. This
structural check cannot prove that the model saw every object in an individual
image; it is not a guarantee of perfect visual recognition. No automatic retries.
Regression uses actual user's group names and browser-compressed four-photo fixture:
three independent calls returned 4+3+7+2 products (16 total), in 7.7–9.6 seconds.
Missing production item was Bio-Zink; previous successful counts did not establish
reliable coverage. Existing user records are preserved, not automatically re-added.

## 0.12.4 — grouping priorities and photo viewer

Recognition still inventories each photo, then considers the complete routine for
consistent grouping. Explicit product directions precede ingredient absorption
considerations. Sourced review must not remove a suitable fat-meal assignment only
because a label says "with food" or does not require extra fat. Actual source-backed
changes still require user acceptance; manual assignments are preserved. No
existing product or pending review is silently rewritten.
Photo controls use scoped 44px touch targets and small glass trash/expand icons.
The reusable image-viewer from toolkit 1.11.0 shows the full prepared (uncropped)
image with optional 2x zoom/pan; close clears its source, preserves the upload
draft, restores focus and makes no request. Logout/draft cleanup closes it.

## 0.12.5 — one supplement, one group

Recognition and sourced review share grouping-policy.mjs. Each product must receive
one owned group ID, considering empty-stomach, fat-meal and before-bed constraints
against exact label/manufacturer instructions and formulation evidence. No fixed
medical ranking overrides verified restrictions when constraints overlap: choose
one best-fitting slot, keep additional conditions in usage/review text, and preserve
an existing suitable/manual assignment. Missing evidence must not become an invented
fasting/fat/bedtime requirement. Unknown identity/timing remains explicitly qualified.

Compact results reject duplicate exact identity rows. Photo inventories can repeat
a product across images, but all occurrences must agree on one group before exact
deduplication; conflicting choices fail closed without a paid retry. Review schema
requires one non-null owned group ID per target and rejects repeated target IDs or
group arrays. This validates structural consistency, not medical correctness or
fuzzy identity equivalence. Existing data is not automatically rewritten.

## 0.12.6 — Grok 4.7 in both adding stages

Recognition now uses grok-4.7 with reasoning low (the API rejects none), preserving one all-photo request
and the per-photo inventory contract. Review still uses grok-4.7/low with mandatory
web sources and explicit acceptance. Only review opts into parallel tool calls;
independent product searches can overlap. Its prompt limits research to targets,
reuses formulation sources and stops once timing is established, requesting one
short reason per target. Keep the four-turn/180s ceiling as a safety budget, not
a speed guarantee. No automatic retries, source-check removal or existing-data
rewrites. Detailed information retains its separate opt-in research settings.

## Experimental branch: JEV assessment (not deployed)

Read server/JEV-EVALUATION.md. Production 0.12.6 is preserved at a050520.
Grok wiring is extracted to server/src/providers/grok.mjs; it retains existing
behavior. JEV evaluation is a separate DB-free script and must never be plugged
into the sourced-research interface as if it returned citations/free text. It
accepts given facts and group choices only; full photo extraction needs a separate
solution. Live JEV validation requires the private typesafe_test_key file.

## Current 0.13.0 — hybrid pipeline and diagnostics

Supersedes prior experimental-only status: see server/ANALYSIS.md 0.13.0 and
server/BENEFITS.md. Keep legacy Grok factory intact for rollback. New adds use one
Grok extraction plus bounded JEV classification, with no automatic Grok review.
Never mark a front-label ingredient list as full composition or infer capsule dose.
Server key TYPESAFE_KEY_FILE is private; no account key/image in diagnostic logs.
Account AI dashboard reads existing owner-scoped job history. UI tags are EN/LT.

## Current 0.13.1 — timing dimensions and recognition cache

See server/ANALYSIS.md. Three JEV timing scores + group semantics + deterministic
one-group resolver replace the long all-in-one grouping prompt. Exact reviewed
manufacturer facts take precedence over reference screenshots; no hardcoded
product/group table. Recognition cache is owner/key/input scoped, 15min/32 entries,
text-only/process-local. New photos remain ~25–31s in observed tests; cache repeats
~1.25s. Do not describe cold speed or all grouping as solved/medically verified.

## 0.16.3 — compact supplement details

Keep restrictions/interactions in the collapsed More information disclosure with
sources and management. Composition, usage, benefits and explicit severe routine
conflicts remain primary. The full-width research action follows the disclosure,
with consistent touch padding and spacing in both themes. Preserve pending-action
disabling and disclosure expansion through polling redraws; no AI/API changes.

0.16.4: the full-width Refresh information / Atnaujinti informaciją action is
inside More information, after the management controls, hidden until expanded.
Pending research still disables it; closing the disclosure never cancels work.

## 0.17.0 — source-backed automatic timing corrections

Full detail research now reassesses one group using all owned groups/current ID.
See server/ANALYSIS.md. Preserve explicit manual assignments (including unassign
and same-group edits) and group-snapshot checks. Only evidenced AI assignments
can move; retain source/reason/check time. Do not restore the old full-details
null-group restriction or discard reviewReason during evidence binding. Existing
non-full details keep their old contract. Never send private groups to Search.

## 0.18.0 — universal compact product research

No brand/product-specific timing cache or server override is permitted. Gemini
returns the group directly. Detail requests contain product facts only; omit all
group context, prompt instructions and provider-schema fields for manual assignments.
Use compactDetailsSchema/expandCompactDetails for provider output and local 1.4
storage compatibility. Do not reintroduce interaction/caution/routine/fallback-dose
research or duplicate usage prose. Source binding and manual/concurrency protections
remain mandatory; see server/ANALYSIS.md for the superseding contract.

0.18.1 adds opt-in password visibility to login/register only, including confirmation.
Reuse modules/src/password-visibility.js (canonical toolkit example) and retain native
input/autofill/caret. Remask on form reset, auth-tab change, sheet close and auth-state
changes. Buttons are type=button with localized show/hide labels and aria-pressed;
right-aligned 44px touch controls use 80% opacity SVG icons. No credential persistence.

## 0.19.0 — floating three-tab navigation

Navigation is outside main, fixed above its bottom mask, with Home/Groups/Account
and the selected pill from the user's reference. Keep the footer/last-row scroll
clearance, safe-area inset, 44px touch targets, keyboard hiding and EN/LT labels.
Account is a main-scroller page (0.20.0), with its tab selected and navigation
visible. Details/diagnostics return to their originating tab. Do not duplicate the
account control in the header. No Recent additions/analysis result block lives on Home; upload dialog
retains server-backed history/results and grouping-review actions.

0.19.0 also projects historical AI information into the selected EN/LT locale.
Use language on dashboard reads and the owner-scoped asynchronous localization job;
cache source fingerprints and descriptive text only. Never show original prose in
a different selected language while translation is pending. Preserve numeric facts,
URLs, identities, manual groups and newer research. See server/ANALYSIS.md and the
canonical toolkit analysis-localization example. No automatic paid failure retry.

The latest Home reference (725px wide) is authoritative: logo only above a
186px ring on the left and Today/date plus Add supplement stacked on the right,
with a fine vertical divider. Scale the two-column composition for smaller phones.
Do not restore motivational copy, brand caption or top navigation.

The Add supplement sheet uses a centered name placeholder and a collapsible Upload
queue with an active-job spinner. Cancelling the native picker preserves the draft.
Launch shows only a theme-aware central progress bar while session/dashboard and
public worker updates are checked; available updates activate before opening Home.
The update check is bounded at 3.5 seconds for offline/slow connections; later updates
continue to use the existing unsaved-edit guard. No private profile is cached.

Version 0.20.0 makes Account a normal main-scroller tab beside Home and Groups;
the floating navigation stays interactive. Profile, preferences, AI connection and
data actions have separate Sage cards. Only product details and diagnostics use
the routed sheet. Home's summary-to-groups gap is 8px, reduced by 40px.

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

## 0.23.0 — chosen Routine B design

`design/routine-wizard-b.png` is the mandatory visual reference. Account Preferences
opens `src/routine-wizard.js`, using the shared bottom sheets and current app tokens.
Preserve the timeline, two steps, contextual meal/exercise/sleep choices, approximate
and exact time modes, variable options, cancellation, three strategy cards, rest
switch, editable recap and save action. Profile choices are EN/LT codes, not prose.

Migration 011 and `server/src/routine-preferences.mjs` own strict server validation;
`settings/routine` is owner-only with revisions. Keep new fields on AI grouping
context only, never public Search or browser persistence. Manual research omits
profile/group context. Saving preferences is free of AI calls and group writes.
A configured profile disables automatic existing-group moves from detail research;
Recheck is the explicit owner-accepted application path. Revisions protect in-flight
recognition/review and pending acceptance; late facts may save without stale moves.
Clear-all retains the profile; account/session reset erases in-memory drafts.
