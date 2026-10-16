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

# Supplement analysis 1.4

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


POST /v1/supplements/jobs authenticates the owner, validates photo/text, serializes
one recognition at a time per account and returns 202 with an opaque job ID. Poll
GET /v1/supplements/jobs/:id; GET /v1/supplements/jobs returns the account's latest
job, active jobs and recent history for resuming after iOS suspension. Reads are
owner-scoped. Only the safe submission name/kind is saved as queue metadata; no
full prompt, raw photo, API key or bearer token is persisted in analysis_jobs. Finished state is retained seven days; supplement
request IDs remain unique per owner so saved requests are not billed twice.

A single API process owns at most eight live jobs and four upstream requests. Raw
photo payloads are held in closure memory only until recognition completes. API restart marks
unfinished jobs failed (AI_JOB_INTERRUPTED); it does not retry paid requests. This
is deliberately a single-instance worker, not a distributed durable payload queue.
An explicit retry can incur another provider charge after an ambiguous failure.

The stateless research adapter uses xAI Responses, required web_search, four agent
turns, an explicit low reasoning effort, a five-minute timeout and a bounded JSON response. It requests independent
tool source metadata, not just a model-generated bibliography. store:false is set;
provider retention terms still apply. Server never fetches model-supplied URLs.

Schema 1.4 inputs include name/manufacturer or label photo, every owned group and
all existing supplements (including available ingredient/dose data). The prompt
prohibits following instructions inside photos, existing records or web pages and
prohibits using private routine context in search queries. Only public product and
ingredient names should be used for web search. Existing routine data still enters
the user's chosen AI provider as disclosed before Send.

The response includes identity/variant, potential benefits, timing, manufacturer
serving/directions, ingredient quantities, source references and exactly one
compatibility assessment for each existing supplement. Local validation enforces
owned group/supplement IDs, complete assessments, numeric limits and required keys.
Every retained source must appear in provider search citations. An unused extra
bibliography link outside those citations is omitted with a visible review notice
(research.omittedSourceCount); it cannot discard otherwise sourced product details.
An unverified link supporting manufacturer dose/amounts still fails closed, as does
a result without any confirmed sources. Label-photo sourceUrl is cleared unless it
also points to a confirmed source. Manufacturer-dose
claims require a manufacturer source or an actual supplied readable label photo;
otherwise dose and amounts stay unknown. This proves encountered URL provenance,
not independent clinical truth or correctness of every AI statement. Ambiguous
variants, insufficient information and potential interactions require review;
duplicates/conflicts keep their planning slot, with compatibility review prominently visible. A time slot is not a safety approval.

Before insert, recheck session, unchanged encrypted key and collection snapshot in
a transaction. Logout/key deletion/routine changes during research cannot silently
commit a result based on invalidated context. AI responses use textContent in UI.
Older 1.1 analyses remain readable; newer optional sections only render when present.

## Serving, daily amount and EU NRV

nutrient-reference.mjs owns the 27 adult food-label reference constants from
Regulation (EU) 1169/2011 Annex XIII Part A, consolidated 2025-04-01:
https://eur-lex.europa.eu/eli/reg/2011/1169/2025-04-01/eng

These are NOT personalized recommended doses, clinical RDAs, treatment doses or
upper safety limits. For example, the EU label reference for vitamin D is 5 µg;
it must not be relabeled as a personalized daily recommendation. Some non-vitamin
supplement ingredients do not have an assigned value in this table.

All ingredient amounts refer to the same label servingSize. dailyServingsMin/Max
count those servings, not individual capsules unless the serving itself is one
capsule. Server computes daily amounts and NRV percentages. Only g/mg/µg elemental
or equivalent vitamin quantities are converted. Compound mass, IU, uncertain forms
(e.g. DFE vs folic acid), absent quantities or unknown frequency do not produce
invented percentages. Values are rounded only for display; exceeding 100% NRV does
not by itself establish either toxicity or suitability.

## Checks

- Mocked Node/browser tests and a disposable MariaDB workflow cover provenance,
  units/ranges, owner isolation, job state/idempotency, full context and conflicts.
- Explicit LIVE_RESEARCH=1 workflow mounts a private provider test key into that
  disposable workflow, exercises a real researched product end to end and removes
  all temporary accounts/tables. CI never incurs paid provider usage.
- Manual provider checks can exercise an official public product photo and a
  public-product existing-supplement fixture. Raw upstream debug output is optional,
  private and only for public-product fixtures. Never enable it on real user data.

Validation record (2026-10-14): real public-product exact-name research returned
manufacturer dose and ingredient amounts; photo-only Lithuanian analysis with an
existing identical product returned a duplicate assessment and no automatic group.
The live disposable-DB workflow passed full background-job save/check/delete.
Browser checks cover NRV/source rendering, resumption, terminal failures, photo
re-encoding and full-height layout. SMTP TLS is verified; DNS/inbox delivery is
explicitly deferred by the user and not claimed complete.

## Progressive recognition and research (0.5.0, migration 006)

POST /v1/supplements/jobs accepts name/photo, requestId and selected language en/lt.
ONE fast structured-output request includes the entire input, all owned groups and
all existing supplements. English instructions request concise human-facing text
in the selected language. Schema v2 returns products[], each with readable brand/name,
variant, proposed owned groupId, short preliminary reason/benefit and optional exact
existingId, plus skipped[]/overflow. Foreign IDs and language markers fail validation.
Grok 4.3 reasoning none has image/schema support. The provided photo took 5.8 s for
seven targets in one real test; latency and identification quality are not guaranteed.
Use grok-4.7 low for detailed web research; its reasoning cannot be disabled.

Recognition commits ALL new draft-1 records atomically and moves the job from
recognizing to enriching. Products appear before any detailed research completes.
Drafts contain no dose, nutrient amounts or source-backed safety claim. Grouping,
brief benefits and timing remain explicitly provisional. A failed detailed lookup
retains the readable product and its retry state. No raw photo is retained after
recognition or resent with background research; exact extracted identity/label text
and the original supplied name suffice to start source research.

Background tasks run one at a time, with four bounded provider slots and higher
priority for waiting recognition. Each detailed request sees all other records,
including every draft from the same photo. Pending records with unknown amounts
cannot get no_known_issue merely because their information is incomplete. Detailed
schema 1.3 adds an en/lt language enum fixed to the request; all free text must follow
that language, while JSON keys/instructions stay English. Prior analyses 1.1/1.2
remain readable. Historical text is not silently translated when UI language changes.

Job JSON includes phase (queued/recognizing/enriching/done), language and result items with
id/name/status=added, research=queued/researching/complete/failed/reused. total_count
counts recognized records; processed_count counts terminal research/reuse states.
GET /v1/supplements/jobs returns latest job plus active[] for resuming every job.
The client refreshes records when progress changes, can add a new input while other
jobs enrich, and does not block PWA updates solely because durable research is active.
Private API data never enters the public worker cache.

Same-owner exact identity (normalized manufacturer/name/variant) may reuse confirmed
source data for 30 days ONLY if its saved language matches. Duplicate candidates and
already queued identities do not create/bill another record. This is not a cross-user
medical catalog. Different variants are never merged based only on a guessed AI ID.
The detail endpoint POST /v1/supplements/:id/research explicitly refreshes/retries
in the selected language without recognition or another supplement row. On source
failure, unknowns remain unknown. No automatic paid retry after failure/restart.

Enrichment rechecks session/key before/after research and verifies target ownership
and job identity under a row lock before updating. Deleted products cannot reappear;
manual group reassignment wins. If collection context changes, sourced quantities
are retained, compatibility.stale is set and review is required. The app never turns
a stale comparison into a safety clearance. Existing single synchronous analyze
endpoint retains its strict snapshot contract for older clients.

One simultaneous recognition per account; four active jobs/account, eight globally,
40 supplements, 30 groups and 4 submissions/minute/30 per day. The queues are bounded
in-process helpers, not a distributed system. Restart fails jobs and marks interrupted
drafts failed; no private photo, credential or bearer token is stored in job rows.
Opaque authorization is held only in the active task closure. Tasks have bounded
provider timeouts. Finished metadata is retained seven days.

Regression workflows use isolated DBs and fake provider contracts. Optional paid
LIVE_RESEARCH=1 with LIVE_LANGUAGE=lt tests one real localized product. LIVE_PHOTO=1
adds a real photo fixture. PROVIDER_RESULT_FILE replays a PRIVATE actual provider
response without additional billing; it is never committed. A provider failure can
legitimately produce a failed enrichment while recognition remains successful.
Source provenance, manufacturer direction evidence and EU NRV rules above apply
unchanged to detailed records.

Migration 007 fixes the owned-group foreign key cascade so removing an account also
works when supplements remain in several groups. The public group-delete route
still unassigns supplements first and preserves their records. The isolated suite
now exercises manual reassignment followed by complete account removal.

Real validation: a seven-product photo returned a Lithuanian preview in 5.779 s
and an English preview in 5.967 s; default language is en. A separate real product
workflow returned the preview in 3.435 s, then sourced Lithuanian dose/NRV details
in the background (280 s total), and passed save/check/delete in an isolated DB.
These timings explain why source research is not on the interactive critical path.

## Upload process queue (0.6.0, migration 008)

Accepted uploads start in queued phase and keep submission={name,kind} plus timestamps.
GET jobs includes owner-scoped recent[] (latest 20 by activity) and all active[].
The dialog shows a timeline and per-product detail progress; it merges history by
opaque ID and preserves expanded/collapsed cards. The composer is independent: only
the short upload POST disables it. Closing/reopening never clears history or the
next unsent name/photo, and polling never resets another draft. Full reload restores
server history, not unsent photos. Logout clears all private modal/history state.

A per-owner createTaskQueue({concurrency:1,maxPending:3}) serializes recognition.
Its slot ends immediately after preview records commit, before awaiting enrichment.
Thus queued photos include the latest recognized collection without waiting minutes
for detailed web research. The existing global provider/research queues stay bounded.
Validate the session before executing delayed recognition and recheck key/ownership
before saving. Acceptance is idempotent before quota consumption under the owner lock;
limits are four active jobs/account, eight globally, four accepted uploads/minute and
30/day. A full queue returns AI_QUEUE_FULL while leaving the next draft intact.

Queued raw photo bytes live only in bounded server memory; no browser outbox, DB
payload or worker cache stores them. Server restart explicitly fails abandoned jobs,
recording failedPhase for an accurate failure timeline; no automatic billable replay.
The isolated DB tests cover serial FIFO acceptance, four-slot capacity, idempotency,
owner isolation and history without image leakage. Browser tests cover closing,
reopening, queue additions during recognition, preserving a subsequent draft while
older research progresses, reload restoration and logout cleanup. Provider calls in
these checks are mocked; they do not incur paid research.

## Short summaries, timing and dose fallback (0.7.0, schema 1.4)

benefitSummary is a separate required field, <=80 characters and <=6 whitespace
words, with 2–5 concise words requested. Full explanations remain in benefits.
Legacy Home text uses the shared compactText display helper without overwriting it.
No SQL schema change: analysis JSON is forward-extensible and older records render.

Both prompts require the most specific supplied timing group, e.g. fat-containing
meals prefer an existing breakfast/lunch with fats group over generic meals. The API
no longer nulls groupId solely for low overall confidence (the reported Q10 bug).
Unknown manufacturer dose and insufficient compatibility data stay review flags.
Potential conflicts/duplicates still null automatic assignment. Manual group changes
while research runs still win. Provisional photo timing never certifies safety.

If manufacturer daily directions are unknown, doseFallback research is required.
Its basis is established_adult_intake, usual_adult_supplement_range, unavailable or
not_needed. An available entry has ingredient, positive ordered daily min/max, unit,
explanation and an encountered source of kind clinical or regulatory. Source URLs
are checked against independent provider citations; fabricated/unqualified fallback
sources fail closed. Include food/total-intake assumptions and population limits.
Missing references are explicitly unavailable; not_needed requires verified daily
manufacturer directions. Do not substitute clinical treatment regimens, upper limits,
other brands or EU label NRVs. Multi-ingredient/region-ambiguous formulas may lack
any applicable standard. The app displays this reference separately, never deriving
capsule counts or filling label servings/ingredient/daily NRV math from it.

A clearly identified product may retain clinical/regulatory-only research without
an accessible official label. This never permits manufacturer-dose/ingredient claims
without exact manufacturer/actual label-photo evidence; those validators are unchanged.
No new dose is silently written into older analyses. Explicit detail refresh requests
the updated contract. Private replay tests adapt old schema metadata with a marked
unavailable fallback; that adaptation is not new medical evidence.

Regression checks: two-column Home summary/full-detail separation, conditional dose
reference UI, schema length/ranges, citation/kind rejection, unchanged NRV unknowns,
and low-confidence timing assignment through both synchronous and background routes.
Existing conflict, manual edit, account isolation, queue lifecycle and iPhone checks
remain required. One-time reported-account maintenance condensed existing benefits
only and restored the stored, owned Q10 timing proposal; it did not rewrite doses.

Real public-product contract check (2026-10-14): xAI returned valid schema 1.4 in
Lithuanian, a three-word summary, an existing meal timing group and verified sources
for ALERTEN BIOEMULCAP. Exact regional daily directions and a supported general
adult norm were unavailable; the fallback correctly stayed unavailable rather than
copying a regional capsule count or a disease-treatment trial regimen. This tests
provider contract/provenance, not clinical truth. Group specificity follows the
returned source-supported timing; a fat-specific assignment requires that evidence.

## 0.9.0 latency and grouping correction

Observed legacy jobs took 224–843 seconds for 2–7 products while initial recognition
was 4.4–9.0 seconds. Full research was serial, and later results erased initial groups
for missing exact label timing or any overlap/interaction. These are separate concerns.

Use the measured fast grok-4.3/none recognition path; detailed research still uses the
account-selected model (grok-4.7/low). A same-photo A/B measured 8.6 s vs 22.5 s and
7/7 assigned for both models, so substituting 4.7 for preview was not a speed fix.
All drafts commit before research starts. Schedule the whole batch into an existing
bounded queue with concurrency 3, leaving provider slot 4 available for recognition.
No extra paid calls/retries are introduced. Report writes are serialized per job to
avoid regressing progress under concurrent completion. Each research result still
invalidates compatibility if its collection snapshot changed while it was running.

routineGrouping preserves an owned detailed recommendation, or an owned provisional
slot if research cannot establish timing. Conflicts and duplicate ingredients retain
review warnings independently. Explicit manual grouping (including unassign) has a
persisted JSON marker and always wins. Removed/foreign groups cannot be restored.
Prompts distinguish optional ingredient-based planning from verified manufacturer
instructions and request concise explanations; source/dose validation is unchanged.

The explicit scripts/reconcile-groups.mjs maintenance command repairs only the chosen
owner's legacy automatic omissions (null group, readable saved preliminary group,
no manual marker). It asks one structured 4.7/low call about the full stored routine,
backs up rows/proposals to a required private mount, then rechecks key, owner, groups
and every row snapshot. Already assigned/manual/concurrently edited rows are skipped.
It preserves manufacturer quantities, sources and warnings; historical timing text
remains in grouping.previousWhenToUse and secondary details. Never run on startup.

Validation (2026-10-15): real seven-product photo completed recognition/grouping in
7,245 ms; all seven sourced detail records finished in 210 seconds, no failures,
each with six sibling assessments and 2–4 sources. This is a single measured run,
not a latency guarantee. Isolated regression: 29 passed, paid test skipped on the
subsequent offline run; the paid photo test passed separately. Browser: 17 passed.
Legacy owner-scoped reconciliation restored five automatically removed group slots
in 25 seconds with private before/proposal backups; no source or dose edits.

0.10.0 verification: real 7-product photo, exactly 1 provider request, recognition
10,177 ms; all seven saved as complete basic-1 with groups and Lithuanian benefits.
31 isolated tests passed in the real run; 3 compact/identity contract tests and
18 browser tests passed. No production supplement records changed by testing.

0.10.2 adds confirmed account-scoped DELETE /supplements with {confirm:true}.
It deletes supplements/completions and analysis jobs only; groups, API credentials,
preferences and account/session remain. The owner row lock serializes recognition
commits; recognition checks its job still exists inside that transaction, preventing
late results from restoring deleted data. Queued recognition checks before sending.
Already-sent provider requests cannot be recalled; their results are discarded.
Client resets private upload/history state and invalidates outstanding reads. Test
only isolated DB data; never invoke destructive smoke checks on production users.

0.11.0: one submission accepts images[] (up to 5) and legacy image. The browser
prepares images sequentially with a 600,000-byte JPEG budget each, reducing longest
side only as needed. The aggregate data URL budget is 4,300,000 characters, below
existing Node/proxy limits; no proxy reload needed. All image parts go into ONE
structured request, with cross-photo product deduplication. Raw images stay in
memory and are dropped on success/error. Draft previews survive sheet closure,
selection can append more photos, and remove clears the batch. No extra research.

0.11.0 live validation: two copies of the seven-product fixture in one request;
one provider call, seven unique products, 4,044 ms provider elapsed. All 34 isolated
checks passed including the live test. Browser selection/re-encoding/multiple-preview
checks passed after correcting trusted local JPEG preview assignment.

0.11.1 changes benefit/benefitSummary prompts to 2–3 comma-separated single-word
keywords in the selected language, with noun forms and no support/health filler.
Examples are formatting only; unsupported benefits must not be invented. Applies
to both compact recognition and opt-in detailed research. Existing stored results
are preserved; no automatic re-analysis or paid requests on opening the app.

0.12.0 live verification: two photos, seven identified products, recognition
4,733 ms; exactly one Grok 4.7 sourced review call returned two proposed moves.
Total job 140 seconds; no changes applied without acceptance. All 35 isolated
checks in that run passed, plus the separate malformed/foreign proposal test.
22 browser flows and focused visual checks passed. This is a measured sample,
not a latency or medical-correctness guarantee.

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

Validation: both live Grok 4.3 runs identified all 16 foreground products after
the same browser compression as the app (21.3s and 14.7s). Bio-Zink is the visible
label spelling; the fixture accepts both Zinc/Zink. This is regression evidence,
not a guarantee of perfect recognition for every future photo. Unit/browser and
isolated database checks passed; no UI layout change.

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

Validation: 40 shared unit checks and 42 isolated backend checks passed (two
opt-in paid suites skipped there); all 23 browser cases passed, one login-timeout
case on focused rerun. Real four-photo recognition returned 16 products twice
after removing duplicated prompt instructions. A separate real sourced review
assigned one test target each to the supplied fats, empty-stomach and before-bed
groups with supporting manufacturer links. These are observed tests, not a
guarantee of clinical correctness or perfect recognition on future uploads.

## 0.12.6 — Grok 4.7 in both adding stages

Recognition now uses grok-4.7 with reasoning low (the API rejects none), preserving one all-photo request
and the per-photo inventory contract. Review still uses grok-4.7/low with mandatory
web sources and explicit acceptance. Only review opts into parallel tool calls;
independent product searches can overlap. Its prompt limits research to targets,
reuses formulation sources and stops once timing is established, requesting one
short reason per target. Keep the four-turn/180s ceiling as a safety budget, not
a speed guarantee. No automatic retries, source-check removal or existing-data
rewrites. Detailed information retains its separate opt-in research settings.

Validation: 43 isolated checks passed (2 paid tests skipped), 40 shared unit checks
passed; 22/23 browser checks passed initially and the login-timeout case passed
a focused rerun. A real four-photo 4.7 run initially omitted a readable package
because of its inferred category; inventory now separates visual identification
from uncertain regulatory classification without asserting permission to use it.
The follow-up returned all 16 expected identities in 37.1s. A three-target sourced
review took 21.2s versus the earlier 30.5s sample; this is not a controlled latency
benchmark or a guarantee. First-stage 4.7 may be slower than previous 4.3.

## 0.13.0 — Grok identity/composition, JEV grouping/tags

Production selects `AI_PIPELINE=grok-jev`; `grok` preserves the old 0.12.6 factory.
One Grok 4.7/low request inventories every photo, extracting product names, visible
brands and active ingredient names only. Amounts are deliberately empty: printed
capsule counts can be mistaken for strength. A missing manufacturer is explicit
Unknown, not a whole-batch failure or an invented manufacturer. Every readable
product survives even when its ingredients are unknown.

Composition method: read visible label/name first, reuse exact owner-scoped fresh
composition (30 days) second, including verified nutrients from opt-in research.
Only a fully legible ingredients panel may be called complete. Back-panel photos
are the fastest reliable way to fill gaps without searches. No inferred full formula
or guessed amounts; no automatic per-product web searches. Optional existing detailed
research still obtains manufacturer information on explicit user action. Cache matches
include product/brand/visible strength; cached partial composition stays partial.

JEV 1.14.0 receives identified text/ingredients and groups, never photos or keys.
Four products/request, at most three requests globally at a time. Each product has
one Choice over owned group IDs and 100 independent Score questions. No Grok grouping
review follows. Scores are purpose-label relevance, not efficacy/probability of
health improvement. Thresholds (score >=2, confidence >=.5) are provisional, not
clinically calibrated. Up to five tags survive, one per near-synonym family; no
known ingredients means no benefit tags. Composition-only grouping is a provisional
recommendation, not a verified manufacturer schedule; manual moving remains available.

BENEFITS.md and src/benefits.json define the 100 EN/LT labels. Some accurate concepts
need multiple words. UI localizes tags without another paid request. Metadata is
persisted alongside the legacy basic-1 format, atomically with the product. Ownership,
clear-all races, group snapshot checks and no automatic retry remain in TrackerApi.
The TypeSafe service key is mounted from private .runtime/typesafe_key; existing user
xAI keys remain encrypted. Consent text names both providers and the shared JEV
connection. Existing records are not re-analyzed or moved automatically.

Account -> AI dashboard uses existing owner-filtered last-20 job history. It shows
stage, queue-inclusive elapsed time, Grok/JEV/total processing time, model IDs, calls,
questions, JEV input tokens, composition completeness and failures. In-flight metrics
persist before the next stage; partial/failed runs retain available values. Missing
legacy metrics show a dash. No raw photos/keys/prompts are persisted in diagnostics.
The clock refresh is local, not a new polling loop or API call each second.

Live regression after transport/schema fixes: two separate four-photo runs each
returned all 16 expected names, with 15 partial compositions and 1 unknown. Run 1:
Grok 22,816ms + JEV 1,611ms = 24,427ms. Run 2: 34,449ms + 1,544ms = 35,993ms.
Times exclude browser image preparation, queue delay and DB commit. They are not a
latency guarantee. This checks identity coverage/structure; no claim of 100% medical
correctness for group or benefit assignments. Initial tests exposed unknown-brand
rejection and JEV rounded probability/score tolerances; both have regression tests.

## 0.13.1 — independent timing and repeat-input cache

The user's reference schedule is a comparison target, not clinical ground truth.
Three independent JEV Score questions now evaluate fasting, fat-meal and bedtime
fit per product; a separate Choice reads each group's name AND description. The
fallback Choice no longer has an instruction favoring generic meals. The resolver
uses an expected score >=1.5 as a provisional preference, picks one owned group,
and retains the highest-supported factor. Equal scores use a documented stable
order, not an assertion that a particular constraint always medically wins.
Food and bedtime can coexist. Low-evidence fasting falls back to a general meal;
unknown composition does not produce benefit tags. Model scores are NOT calibrated
medical confidence. Timing factors/fallback/source are persisted in classification.

`product-timing-facts.mjs` supplies a small reviewed manufacturer-directions cache,
not a product/group lookup table: exact brands/formulations only, 90-day freshness,
no dosage or guessed complete formula. Explicit meal directions suppress fasting.
Sources are embedded beside each fact. NOW's 600 mg ALA directions prefer a meal,
so matching the screenshot's fasting placement is deliberately not a pass criterion.
L Cell NAD+ Formula explicitly recommends before breakfast. KAL and Zenyth allow
flexible timing, including evening; do not present evening as their only safe time.
Unknown ALERTEN manufacturer/composition remains unresolved rather than silently
asserting it is the matching Q10 registration. Never claim this reference proves
that all the products are safe together. The screenshot also includes ashwagandha,
which is absent from the four-photo/16-product fixture.

Grok remains 4.7/low, one request for all photos. A shorter prompt and string-only
ingredient wire format remove redundant empty quantity fields; normalized stored
composition remains compatible. English ingredient identifiers avoid mixing JEV
instructions and translated ingredient terminology. Visible strengths remain OCR
and can be misread; count-based tests do not establish dose/strength accuracy.
No lower model or paid priority tier was silently enabled. Public 4.7 has no
non-reasoning setting; 4.7 Fast is not on the public API (xAI developer guide).

A 15-minute, 32-entry process-local cache avoids repeating Grok on identical input.
The SHA256 fingerprint includes owner scope, credential, model, language and exact
name/photos. It stores bounded extracted text, never raw photos/keys; is not durable;
restart/expiry/key change prevents reuse. JEV ALWAYS reruns against current groups.
Other owners cannot hit it, and authorization/key checks still precede saving.
Dashboard reports cache reuse and zero Grok calls. No automatic re-billing/retries.
Existing saved/manual assignments are not silently migrated by this release.

Paid benchmark (four original photos, disposable DB-free script): intermediate two
cold runs 24.692s and 24.600s; final cold run 30.636s (Grok29.335s/JEV1.301s).
Two exact repeats with cached extraction took 1.255s and 1.246s; each still called
JEV, and each returned all 16 identities. Cold-call improvement is NOT established:
provider variability still dominates. The report checks fat slots for astaxanthin,
Q10, resveratrol, tomato extract; bedtime for both magnesiums and tryptophan;
before breakfast for NAD; non-fasting for manufacturer-directed ALA. It does not
assert a medically unique schedule for NAC, lysine or zinc, or identify ALERTEN's
hidden ingredients. Results roughly match 11/16 reference slots; five differences
are documented, not hidden by changing the fixture or assigning fixed products.

## 0.17.0 — reconcile AI timing during full detail research

Gemini recognition explicitly treats manufacturer meal recommendations (including
"preferably with a meal") as incompatible with fasting. Flexible any-time slots
permit food unless their description excludes it. Reviewed NOW Extra Strength ALA
facts match its exact named formulation when strength is split/missing; an unnamed
ALA without strength does not match. The post-recognition guard now recognizes
neutral any-time groups as well as explicit meal groups.

Full details receive every owned group's name/description, the target's current
ID and assignment basis. The existing extraction request returns groupId plus a
short reviewReason, using the same retrieved timing evidence as the usage fields.
No third provider call or separate grouping request is added. Public Search still
receives only product identity, never private group/routine contents. Focused legacy
non-full details retain their null-group contract.

The atomic commit applies an owned proposal only to a documented AI assignment,
with a verified manufacturer/label source, a nonempty reason and unchanged group
semantics/current assignment. Manual moves, same-group manual choices and manual
unassignment always win, including edits during research. Missing provenance is
preserved; legacy identity.groupId can establish an unchanged AI-origin assignment.
Unknown evidence never unassigns a product. The saved grouping retains reason,
source and check time. Manufacturer mismatch discards the timing proposal alongside
unsupported product claims. Timing changes do not resolve systemic interactions.
All new recognition records explicitly store grouping.basis=provisional.

No database migration or bulk rewrite. Existing products are reassessed on their
next detailed-information refresh; only the reported ALA is targeted for correction.

## 0.18.0 — universal, concise Gemini product requests

Supersedes 0.17's reviewed-product cache: product-timing-facts.mjs is removed,
including imports and overrides in Gemini and dormant JEV classification. Production
code contains no product/brand-specific timing list. Gemini's owned group decision
is not changed by product-name or group-name matching code. General prompt guidance
still prioritizes actual manufacturer directions and one compatible group.

Recognition prompt: 3,760 -> 1,482 characters (61% shorter). Retains whole-photo
inventory/blisters, cross-photo deduplication, exact identity/partial ingredients,
one group and localized benefit keywords. No product-specific examples.

Full detail prompt: 6,622 -> 1,059 characters with AI timing context (84% shorter).
Research gathers only manufacturer/identity, composition, brief benefits and one
usage instruction. No interactions/restrictions, other routine products, adult
reference-dose searches or repeated when/how prose. Search/extraction remain two
bounded calls with source-ID binding and exact-brand/label validation.

The Gemini wire schema omits legacy flags, cautions, compatibility, fallback doses,
NRV fields and duplicate usage strings. The server expands product facts into the
existing 1.4 storage contract with empty/not-determined defaults. Source provenance
is retained. Existing stored records are not mass-rewritten or re-billed.

For a manual assignment, omit ALL group fields/instructions from messages AND the
Gemini wire schema; only product identity is sent. For an AI assignment include
owned groups/current ID and an optional sourced timing decision. Atomic manual/race
protections remain. Product-only research does not invalidate compatibility when
unrelated products change. Historical legacy non-focused analysis stays available.

Live checks (DB-free; real Gemini, original four photos): two recognition calls
returned 16/16 identities in 9.513s and 8.694s. Both still provisionally put ALA in
the fasting group; these are identity/latency results, not 100% grouping accuracy.
The compact sourced detail request corrected that artificial fasting context to
an owned meal group in 19.773s without any product-specific server rule. Separate
checks took 15.355s with AI timing and 13.228s with manual timing omitted. Single
runs do not establish a stable latency improvement. Transport tests inspect the
entire manual extraction schema/context to enforce complete group omission.

## 0.19.0 — selected-language views of historical AI information

New recognition/research already use the explicit client language. Historical
results now receive cached text-only translations when their source language differs
from the current preference. GET dashboard's language=en|lt applies only a fresh
fingerprinted variant. It never changes source language, dose numbers/units,
manufacturer identity, URLs or group assignment. Without a cache it marks
localizationNeeded; the UI hides mismatched prose while preparing that language.

POST /supplements/localize starts an owner-scoped async job using existing job
storage. Up to four products / about 48K input characters per call, one running
locale job per owner, rate limit 60/hour and the shared three-slot background queue.
Gemini translates whitelisted text only, with no Search/new product research.
Validate IDs, exact keys and numeric tokens; compare fingerprints during the commit.
Manual grouping and newer source facts cannot be overwritten. No automatic paid
failure retry. Cached English/Lithuanian variants remain private analysis data.

The client includes its selected locale in dashboard reads, new submissions,
research and translation. Existing polling sequentially prepares missing batches;
logout clears attempt state. Cached languages are reused without another provider
call. Translation timings/tokens are included in diagnostics. No DB migration.

Detailed research normalization (0.20.3): only the short benefit display preview
is bounded to the existing six-word/80-character contract before validation. The
full benefit text and evidence-bearing product fields are preserved; wrong types,
invalid group IDs, unverified sources and quantities still fail validation. A
nine-word preview previously caused the reported Magnesium research to fail after
both provider calls completed. No extra provider request or automatic paid retry
is introduced.
