# Optional AI integration examples

These generic modules contain no supplement data or medical policy. Their callers
own authentication, authorization, quotas, domain schema, consent and DB transactions.
Browser modules never import server code.

## Photos (browser)

`prepareImage(file)` from `image-input` validates an explicitly selected image,
limits input to 20 MB/80 megapixels, resizes to 1800 px and re-encodes JPEG (up to
3 MB) to strip metadata. It disposes temporary blob URLs/bitmaps. Clear the returned
data URL and file input on modal close/logout; never store them in browser drafts,
logs or worker caches. HEIC decoding depends on browser/device support.

## Credentials (server only)

```js
import {createCredentialVault} from '@europolas/app-modules/server/credential-vault';
const vault = createCredentialVault(private32ByteBuffer);
const context = {owner: authenticatedUser.id, provider: 'xai'};
const encrypted = vault.seal(userSuppliedKey, context);
const key = vault.open(encrypted, context); // server memory only
```

AES-256-GCM uses fresh nonces and owner/provider authenticated data. Keep the master
key outside Git, public builds and DB backups. Return only configured/update metadata
to the browser. Deleting DB rows does not delete old backups; coordinate backup
retention and key rotation separately. This example does not implement key rotation.

## Structured requests (server only)

`createStructuredChat(options)` calls the xAI-compatible Chat Completions API with
`store:false`, strict JSON Schema and a caller-supplied local validator. Supply
`key`, `model`, `messages`, `schema`, `validate`, optional `name` and `maxTokens`.
The result is `{result, model}`. The adapter bounds responses to 256 KiB and requests
to 85 seconds by default, rejects redirects/refusals/truncation, and returns safe
`ProviderError` codes. It never retries: repeating an AI request can incur another
charge. Provider retention terms still apply; store:false is not a retention guarantee.

The createStructuredChat adapter does not perform web research or verify sources. Applications requiring
current product research must add explicit retrieval and source validation before
claiming those features. Prompts alone do not establish that a web search occurred.

Share a single `createAuth` instance via `setupAccount(config,{auth,i18n})` when
app screens and account forms need the same session state. `createAuth({timeout})`
allows an AI-capable app to set a request timeout deliberately. Account form cleanup
remains the responsibility of the composition root.

## Research with encountered sources (server only)

`createStructuredResearch` accepts the structured-chat contract but uses the xAI
Responses API, image input conversion and mandatory web_search. It disables provider
storage, inline citation markup and redirects, caps body size at 512 KiB, bounds
agent turns to four and time to five minutes (explicit low reasoning effort). It never retries. max_turns is not a
hard count of billable tool invocations. Return: `{result, model, citations, searches}`.

`citationUrl` canonicalizes public HTTPS URLs; returned citations come from provider
tool metadata, not generated answer text. Caller must bind returned claim URLs to
these citations and validate domain-specific provenance. Encountering a URL does
not prove every claim on that URL, manufacturer identity or clinical correctness.
The application must state uncertainty; this adapter does not replace expert review.

Long research belongs in a short HTTP job submission and owner-scoped polling flow.
Do not raise a public proxy timeout and assume a mobile page will remain active.
Keep photo payloads in memory; after restart, terminate abandoned jobs explicitly
rather than automatically repeating a potentially billable request. Persist only
state/result metadata, authorize job reads and recheck session/key/collection before
committing results. This job policy is application-owned; the adapter is stateless.

## Structured identity extraction without research (server only)

`createStructuredOutput` is an additional named export from
`@europolas/app-modules/server/structured-research`. It uses the same bounded
Responses transport, JSON Schema and local validator, with tool fields omitted (xAI rejects tool_choice when no tools are supplied). Its `{result,model,citations,searches}` return contract is the
same, but successful extraction does not require searches or citations. Never
present extracted identities/OCR as source-backed research or medical advice.

```js
import { createStructuredOutput, createStructuredResearch }
  from '@europolas/app-modules/server/structured-research';
const extract = createStructuredOutput({ timeout: 90000 });
const research = createStructuredResearch();
// schema/validator/messages are application-owned. Include image data only with
// explicit consent, validate readable identities, then research each target.
const { result } = await extract({ key, model, messages, schema, validate });
```

For a multi-product photo: extract all readable product+brand identities, reject
ambiguous background objects, deduplicate identical identities, then research each
selected target separately. Explicitly identify the target so neighboring labels
are not merged. Refresh the user's full collection before each target when later
results must consider earlier additions. Persist progress and individual failures;
keep successful records when another target fails. Show skipped identities/reasons.
Bound product count, concurrency and billable submissions, disclose additional calls,
recheck owner/key before every target, and do not automatically retry paid failures.
Raw photos remain in closure memory; no browser cache or job table should store them.
The app owns orchestration and validation; this reusable adapter has no job/database
state and requires no cleanup beyond awaiting the bounded request.

Provider contracts: [xAI Responses](https://docs.x.ai/developers/rest-api-reference/inference/responses)
and [image understanding](https://docs.x.ai/developers/model-capabilities/images/understanding).
