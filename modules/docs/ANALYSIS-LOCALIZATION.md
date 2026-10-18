# Cached analysis localization example

The server-only `examples/analysis-localization.mjs` demonstrates whitelisting text
fields, fingerprinted language variants and strict translation validation for saved
structured analysis. Adapt the field whitelist to your application's domain.

`analysisTexts(record)` returns descriptive text only. `textFingerprint(record)`
ignores caches and provenance. `localizationSchema(items)` requires every ID/key;
`validLocalization` also rejects changed numeric tokens. These checks prevent
structural/numeric changes, not every semantic mistranslation.

Store validated translations in `record.localizations[language]` with the original
fingerprint and translated `fields`. `localizedAnalysis(record,language)` returns a
view without overwriting source language/facts, or `localizationNeeded:true` when
the cache is missing/stale. Identity, amounts, units, source URLs and group IDs
remain original; only whitelisted descriptive fields are projected.

The caller owns authorization, credentials, rate/concurrency limits, async job
lifecycle and owner-scoped storage. Re-read and compare the fingerprint inside the
commit transaction so stale results cannot overwrite newer research. Never restore
deleted records. Reuse translations without another paid call; do not automatically
retry failed model calls. UI must hide wrong-language prose while preparing the
selected language and must ignore late responses after sign-out/language changes.

Supplement-tracker demonstrates batches of up to four products, the existing
background queue and job polling, plus source-preserving owner transactions. Its
English/Lithuanian preference is explicit; English remains the default.
