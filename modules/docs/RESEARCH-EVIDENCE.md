# Supplement research evidence example

This optional server example pairs with the Gemini structured transport example.
It does not change any application's provider or database. It assumes a research
contract with sources, dosage, nutrients, compatibility and a known selectedTarget.

1. Run grounded search on the public selected identity only. Keep tool-evidenced
   citations, titles and redirect aliases. Do not send private routine IDs to search.
2. Assign short S1/S2 source IDs. `referencedSchema(schema, ids)` restricts every
   sourceUrl and source-list URL to these IDs. The extraction model never copies
   long opaque Google redirect URLs.
3. `verifiedLabels(citations, target)` optionally checks at most three encountered
   NIH DSLD /label/<id> URLs via the fixed official API host. Each request has a 7s
   deadline, redirects disabled and a 256 KB bound. Known brand and normalized exact
   product name must match. No arbitrary publisher URL is fetched. Missing or
   mismatched labels produce no verification proof. The result is a Map, not cache.
4. Include server-verified label records in the extraction catalog. Call
   `bindEvidence(raw, book, target, language)` where each book item has id, url,
   publisherUrl, title and optional verified label data. Persist no API keys.
5. Independently validate the expanded result and every source claim. A
   label_registry kind alone is NOT proof: the source policy must require the
   server's verified-label URL list. Quantities/frequency must match registry data.

Unsupported manufacturer quantities/directions become unknown; they are never
replaced with another product's dose. Known brands are preserved, and another
maker's claims cannot replace the selected product. Background requests cannot
claim to have read a supplied photograph. Reserved summary/review fields are
normalized deterministically; clinical assertions are not invented or silently
approved. Empty incompatibility alerts do not establish safety.

NIH labels are manufacturer-label records, not clinical endorsements. Matching
identity/quantities does not establish personal suitability, label currency or
complete formulation equivalence. Keep sources and uncertainty visible where
relevant, and retain explicit recheck/retry controls. All work is per request;
there is no timer/listener lifecycle or shared credential storage.
