# Separate outbound mail service

This app has its own Postfix queue, subnet, sender restriction and freshly generated
TLS/DKIM keys. It does not connect to or reconfigure iphoneTest's SMTP/API/DB.
The SMTP listener is reachable only on an internal Docker network and requires
verified STARTTLS. It only accepts `supplements@perimove.com` from its private subnet;
no public port is published. Node signs recovery messages with selector `supplement`.
The private signing key and CA/server keys stay under .runtime, never in Git/images.

`DNS-records.json` contains only the PUBLIC key and requested domain TXT records.
Add them through the domain's DNS provider. Use one SPF record per domain: if an
SPF record was added elsewhere, merge authorized senders rather than duplicating it.
For providers requiring FQDN names: @ is perimove.com; supplement._domainkey is
supplement._domainkey.perimove.com; _dmarc is _dmarc.perimove.com. TTL may be default.

## Delivery check after DNS publication

From the repository root:

```bash
docker compose --env-file .runtime/compose.env -f server/compose.yml run --rm \
  -v /home/deploy/.secrets/supplement-tracker/initial_admin.json:/run/secrets/initial_admin:ro \
  --entrypoint node api scripts/check-mail.mjs --send
```

The command verifies actual DNS public-key correspondence and SMTP TLS before
sending ONE setup message to the private admin address. It does not print that
address or a password. Sender acceptance by local Postfix is not inbox delivery:
check remote relay acceptance (`status=sent`) and the recipient inbox/spam folder.
Do not print recovery URLs, token hashes or raw mail payloads while inspecting logs.
No SMTP setup can guarantee future inbox placement; receiving-server policy applies.

After successful delivery confirmation, set MAIL_DELIVERY_READY=true in the private
.runtime/api.env file and recreate api with docker compose. The API /health should
report passwordRecoveryAvailable=true. Exercise the app's Forgot password flow;
password reset links expire after 30 minutes, work once and revoke existing sessions.
Keep readiness false until these checks are completed. At initial preparation the
TLS check passes but domain SPF/DKIM/DMARC are absent; the user deferred DNS changes.

The check does not add DNS records or buy a mail service. Avoid rerunning key
creation: replacing a private DKIM key requires publishing its new public key too.
