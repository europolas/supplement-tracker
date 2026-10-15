# JEV experiment — 2026-10-15

Branch `codex/jev-evaluation` starts from production commit `a050520` (0.12.6).
Production is not switched by this experiment. The preserved xAI pipeline lives in
`src/providers/grok.mjs`; HTTP composition imports that factory instead of assembling
three transports inline. TrackerApi still has xAI-specific encrypted credential
storage and research contracts. This is not a completed provider migration.

## Documentation findings

- [Introduction](https://docs.typesafe.ai/introduction): typed decisions, multiple
  independent questions per call. This is a plausible fit for group selection.
- [API](https://docs.typesafe.ai/api): Choice selects from supplied criteria (up to
  255); no arbitrary text-generation or built-in web-search tool is documented.
- [Images](https://docs.typesafe.ai/images): experimental image input requires the
  `TypeSafe-Danger-Zone-Images: true` header. Image understanding does not imply OCR
  output of arbitrary unseen product names. [Box](https://docs.typesafe.ai/primitives/box)
  locates a specified object, it does not return an unknown product inventory.
- [Generation limitations](https://docs.typesafe.ai/model-jaggedness/jev-1.13): use
  candidate extraction or a generative model before closed-set selection. Do not
  synthesize names character-by-character via chained Choice requests.
- [Models](https://docs.typesafe.ai/models): pin version for evaluation; at review
  time latest points to 1.13.0, preview to 1.14.0. The experiment pins 1.14.0.
  English performs best; keep English instructions and map response IDs to en/lt UI.
- [Confidence](https://docs.typesafe.ai/confidence): derived from the option
  distribution, not an independent verification of medical correctness.

## What is implemented

`src/providers/jev-evaluation.mjs` constructs one Choice per GIVEN product, using
supplied directions and groups. It validates response IDs, choices, probability
ranges/distributions and confidence. Unknown is an explicit non-group review result.
No account writes, images, xAI calls, citation claims or automatic fallback.
`scripts/check-jev-grouping.mjs` sends one explicit paid request with five synthetic
label-fact fixtures (fasting/fats/bed/general meal/missing facts), prints timing,
choices and token usage, and checks expected choices. This measures classification,
not visual discovery or autonomous clinical research. Live results are recorded below; they do not establish photo recognition or
medical correctness.

```bash
TYPESAFE_TEST_KEY_FILE=/home/deploy/.secrets/supplement-tracker/typesafe_test_key \
  node scripts/check-jev-grouping.mjs
node --test server/test/jev-evaluation.test.mjs server/test/research-transport.test.mjs
```

The key file is private (600), outside Git. Do not log its contents. Never substitute
an xAI key or send an existing user's routine to a new provider implicitly. No
automatic retries: the CLI explicitly fails on timeout, HTTP error or bad answers.

## Next decision

For arbitrary new-photo products, a separate OCR/vision extraction stage or a known
product catalogue is required. Product usage evidence must come from labels or a
retrieval layer; JEV alone cannot replace the current web-backed fact gathering.
Candidate approach: photo -> OCR/vision -> verified product data -> one batched JEV
classification -> one owned group per product. Store/reuse verified product facts;
select benefit IDs from an EN/LT dictionary rather than asking JEV to write prose.

First benchmark JEV on supplied facts and reordered group options, then on the
actual product dataset with independent expected labels. Unknown, conflicting
constraints and low confidence must remain reviewable; don't force a medically
unsupported answer to satisfy a one-group rule. Do not present experimental JEV
results as sourced reviews or silently apply them. Final end-to-end latency includes
OCR and evidence retrieval, not just the JEV request.

## Live validation — 2026-10-15

Private test key accepted; model reported `jev-1.14.0`. Four explicit requests,
no retries, no production records read or written:

| Fixture | Correct | End-to-end HTTP time | Input tokens |
| --- | --- | --- | --- |
| Initial five supplied directions | 5/5 | 487 ms | 1592 |
| Five directions, matrix baseline | 5/5 | 446 ms | 1592 |
| Same five, reversed group order | 5/5 | 196 ms | 1592 |
| Sixteen synthetic directions, including negation/missing/conflicting facts | 16/16 | 253 ms | 4628 |

Run the matrix explicitly with `JEV_TEST_MATRIX=1` plus the key-file environment
variable shown above. It sends three separate paid requests, outputs mismatches
and exits nonzero if any expected choice differs. This is an easy closed-set
classification benchmark: known text directions are inputs, not facts discovered
by JEV. Unknown is the expected result for absent/conflicting directions. The
small sample, possible provider warm-up/caching and network variation preclude
a latency guarantee or a direct speed ratio against Grok's web-backed research.
The live application still uses the preserved Grok pipeline.
