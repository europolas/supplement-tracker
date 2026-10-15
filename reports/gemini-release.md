# Gemini 3.8 Flash — universal prompt, release 0.14.0

Final prompt contains no fixture product names or reviewed product list. Five fresh paid runs of the same four photos. One Gemini request per run, no JEV. Instructions English, output Lithuanian.

| Run | Seconds | Recognized | Provider requests |
|---|---:|---:|---:|
| 1 | 7.913 | 16/16 | 1 |
| 2 | 9.581 | 16/16 | 1 |
| 3 | 7.576 | 16/16 | 1 |
| 4 | 9.736 | 16/16 | 1 |
| 5 | 7.155 | 16/16 | 1 |

Median **7.913 s**, range **7.155–9.736 s**. Times exclude browser preparation, upload and DB saving. All 80 products had one existing group, no duplicates.

Grouping is not identical to the reference: lysine chose morning; zinc chose ordinary meals. One run chose ordinary meals for magnesium taurate; one chose fats for liposomal vitamin C. The prompt prioritizes exact directions and general timing/absorption rules; it cannot guarantee precise manufacturer instructions from front photos alone.

The existing reviewed manufacturer constraint cache is consulted only after identification, never sent in the prompt. Where an exact match requires food, a fasting assignment is moved to an available ordinary-meal slot. This prevents the known NOW ALA 600 mg food contradiction without another AI call. It does not enforce the reference table for other products. Both the raw model choice and the server rule must be considered when assessing grouping.

Composition remains explicitly partial/model-inferred; 16/16 identity recognition is not proof of a complete or verified formula. Existing manual assignments are preserved.

Validation: 40 library tests; 25 browser flows; isolated server suite 60 passed, 2 explicitly paid legacy checks skipped. Optional Gemini detail lookup + extraction passed real source validation in 13.292 s. This two-call opt-in research path is separate from single-call adding.

Exact redacted request: `gemini-request-example.json`. No keys or photo bytes stored in Git.

---

# Development results before universal prompt

2026-10-16. Actual production adapter, LOW thinking, HIGH image resolution. The same four user photos, five sequential requests; no production DB writes, no JEV, no search or follow-up calls. Time includes provider transport/validation, excludes browser image preparation, upload to app and DB saving.

| Run | Seconds | Requests | Products | Group-policy agreement |
|---|---:|---:|---:|---:|
| 1 | 8.845 | 1 | 16/16 | 15/16 |
| 2 | 10.396 | 1 | 16/16 | 16/16 |
| 3 | 10.798 | 1 | 16/16 | 16/16 |
| 4 | 11.278 | 1 | 16/16 | 16/16 |
| 5 | 10.695 | 1 | 16/16 | 16/16 |

Median: 10.695 s. Range: 8.845–11.278 s. All 80 recognized products received one existing group, no duplicates. Group-policy agreement is not medical accuracy: 79/80 match the explicit scheduling policy; one magnesium bisglycinate result chose the ordinary meal slot instead of evening. Both can satisfy the manufacturer’s with-food directions.

Compared with the user’s original illustration, NOW ALA 600 mg is intentionally placed with a meal, following the exact manufacturer directions. NAC morning and lysine evening are organizational preferences, not mandatory clinical timing. Existing manual assignments are preserved. No fixed product count or expected answer array is included in prompts. The prompt contains transparent ingredient-category rules and reviewed exact-product timing facts.

Composition is marked partial, derived from label or exact-product model knowledge, never guaranteed complete. These tests verify inventory/grouping and schema; they do not certify every ingredient in a full manufacturer formula.

Initial integration run failed on provider schema size keywords; transport now strips unsupported length constraints while keeping strict server validation. Earlier development prompt produced inconsistent general-meal/fat choices; final table is a fresh five-run set.

The exact redacted request is in gemini-request-example.json. No credentials or image bytes are committed.
