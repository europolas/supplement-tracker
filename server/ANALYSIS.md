# Supplement analysis 1.4

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
