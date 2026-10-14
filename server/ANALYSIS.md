# Supplement analysis 1.2

POST /v1/supplements/jobs authenticates the owner, validates photo/text, serializes
one active job per account and returns 202 with an opaque job ID. Poll
GET /v1/supplements/jobs/:id; GET /v1/supplements/jobs returns the account's latest
job for resuming after iOS suspension. Reads are owner-scoped. No prompt/photo/key
is persisted in analysis_jobs. Finished state is retained seven days; supplement
request IDs remain unique per owner so saved requests are not billed twice.

A single API process owns at most four live jobs and four upstream requests. Raw
photo payloads are held in closure memory only until completion. API restart marks
unfinished jobs failed (AI_JOB_INTERRUPTED); it does not retry paid requests. This
is deliberately a single-instance worker, not a distributed durable payload queue.
An explicit retry can incur another provider charge after an ambiguous failure.

The stateless research adapter uses xAI Responses, required web_search, four agent
turns, an explicit low reasoning effort, a five-minute timeout and a bounded JSON response. It requests independent
tool source metadata, not just a model-generated bibliography. store:false is set;
provider retention terms still apply. Server never fetches model-supplied URLs.

Schema 1.2 inputs include name/manufacturer or label photo, every owned group and
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

## Multi-product photos (app 0.4.0, migration 005)

Camera and library are explicit separate file inputs. Library has no capture
attribute; both use the same resize/re-encode/validation path. A photo job first
uses createStructuredOutput (90 s, no tools) with photo-products schema version 1:
products[{name,manufacturer,variant,labelText,location}], skipped[{location,reason}],
overflow. Readable brand AND product are mandatory. Blurry/occluded background
bottles are never guessed. Exact duplicate identities are collapsed; at most 40
identities and 40 unreadable explanations are returned. Product text/name-only
requests retain the single-product research flow.

Distinct photo targets are researched sequentially with the original image and an
explicit selectedTarget. Each target sees current groups and ALL saved supplements,
including earlier successful siblings. Existing schema 1.2 provenance, dose/NRV,
compatibility and transaction rules remain in force per target. Duplicate/conflicting
products still require review and remain unassigned rather than being silently
accepted into a group. Photos cannot establish an unreadable back-label dose.

Jobs now expose total_count, processed_count, result:{items,skipped}. Each item has
name/status and either id (added) or safe error (failed). Skipped entries have a
location/name and plain reason or localized reasonCode. The job's supplement_id
is the first added record for old clients. Complete means at least one success;
the report must be checked for individual failures. All-failed/zero-identification
jobs are failed but retain explanations. Restart interruption preserves any already
saved records and progress. Raw images/prompts/keys are never stored in these rows.
Reports are owner-scoped and retained with the job for seven days.

Stable SHA-256-derived child UUIDs bind parent request ID + product index; resubmitting
a completed parent returns the same report without new provider calls. Failed items
are not retried automatically. Each submission uses one quota unit, with at most
one discovery call + one sourced research request per readable product (up to the
remaining 40-record capacity). Capacity overflow is reported, not silently truncated.
Provider calls are bounded at four globally; session/key are checked after discovery
and before/after each research call. This worker still requires one API instance.

Optional paid real-photo check in a disposable DB:

```bash
LIVE_RESEARCH=1 LIVE_PHOTO=1 \
PROVIDER_TEST_KEY_FILE=/private/path/xai_test_key \
LIVE_PHOTO_FILE=/private/path/test-photo.jpg server/scripts/test-isolated.sh
```

The supplied regression photo has seven readable foreground products and blurred
background labels. The check expects all seven readable targets to be processed, with every added or
failed target accounted for, and explains skipped objects. Source uncertainty may
legitimately produce a partial result; do not weaken provenance to force success. It prints only names/status/counts, never keys or raw provider data.

Photo validation record (2026-10-14): the supplied photo produced seven distinct
foreground targets; all seven were researched sequentially, six were saved in the
initial strict-source run and blurred background labels were reported separately.
The seventh exposed an unused bibliography URL on a different regional host.
After correcting unused-link handling, the captured actual provider response
passed source validation with two confirmed links, one omitted link and unknown
manufacturer directions retained as unknown. The private-response replay checks
save/check/delete in a disposable DB without repeating paid research. UI, ownership,
job resumption, partial-result and key-change checks pass. Installed iPhone camera/
library OS menus still need a physical-device check; desktop verifies the inputs.

To replay the private validated provider fixture without additional provider calls:

```bash
PROVIDER_RESULT_FILE=/private/path/provider-result.json server/scripts/test-isolated.sh
```

This optional fixture belongs outside Git. The fixture's group ID is mapped to the
test account's owned group before local schema validation; clinical content and
original encountered source metadata are preserved. Production records are unused.
