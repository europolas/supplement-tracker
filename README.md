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


Independent PWA generated from europolas/pwa-toolkit starter and app-modules 1.10.1.
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
