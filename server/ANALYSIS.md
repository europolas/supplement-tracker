# Supplement analysis 1.3

POST /v1/supplements/jobs authenticates the owner, validates photo/text, serializes
one recognition at a time per account and returns 202 with an opaque job ID. Poll
GET /v1/supplements/jobs/:id; GET /v1/supplements/jobs returns the account's latest
job for resuming after iOS suspension. Reads are owner-scoped. No prompt/photo/key
is persisted in analysis_jobs. Finished state is retained seven days; supplement
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

Schema 1.3 inputs include name/manufacturer or label photo, every owned group and
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
duplicates/conflicts are not automatically assigned to a routine group.

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

Job JSON includes phase (recognizing/enriching/done), language and result items with
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
40 supplements, 30 groups and 3 submissions/minute/30 per day. The queues are bounded
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
