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

This adapter does not perform web research or verify sources. Applications requiring
current product research must add explicit retrieval and source validation before
claiming those features. Prompts alone do not establish that a web search occurred.

Share a single `createAuth` instance via `setupAccount(config,{auth,i18n})` when
app screens and account forms need the same session state. `createAuth({timeout})`
allows an AI-capable app to set a request timeout deliberately. Account form cleanup
remains the responsibility of the composition root.
