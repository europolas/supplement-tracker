# Production deployment

The HTTPS host is perimove.com. Nginx strips `/supplement-tracker/` to the static
server on loopback 8095 and `/supplement-api/` to the Node API on loopback 8094.
The account DB is the separate supplement-tracker MariaDB volume. The application
DB user receives only SELECT/INSERT/UPDATE/DELETE; migrations use a private CLI.

## Current prepared deployment (2026-10-14)

- Fresh account/tracker migrations applied and initial admin provisioned from the
  private initial_admin.json file. An existing password is never overwritten by
  bootstrap; reruns verify it before granting admin.
- The admin's xAI key saved through its authenticated endpoint, encrypted with the
  independent vault key. Initial registration groups seeded once per account.
- API/web containers have restart policies, loopback ports, non-root UID, dropped
  capabilities, read-only filesystems and health checks.
- The managed locations from nginx-perimove.locations.conf are inserted into the
  existing HTTPS block. Other locations are preserved. Private backup is
  `.runtime/nginx-perimove.before.conf`. Syntax of the added routes was checked.
- The user reloaded Nginx. Public page, manifest, icons, worker and API health
  now return HTTP 200. Real browser login and scoped worker activation passed,
  with four groups and no JavaScript errors. The original iphoneTest API stayed healthy.

Run in the server terminal (password stays in that terminal):

```bash
sudo nginx -t && sudo systemctl reload nginx
```

For future configuration changes, check public HTTPS status, manifest, icons and service worker, then sign in using
initial_admin.json credentials. In iPhone Safari choose Share → Add to Home Screen.
The manifest uses relative id/start_url/scope, so installation stays under this app's
path. API responses are uncached; CORS allows only configured origins.

## Later releases

From the repository root, after passing checks:

```bash
npm ci
npm run build
docker compose --env-file .runtime/compose.env -f server/compose.yml build
docker compose --env-file .runtime/compose.env -f server/compose.yml run --rm migrate
docker compose --env-file .runtime/compose.env -f server/compose.yml up -d api
docker compose --env-file .runtime/compose.env -f server/compose.yml up -d --force-recreate web
```

Recreate web after every build: the builder atomically replaces the generated docs
folder, and an existing Docker directory bind mount otherwise keeps its old inode.
Never copy .runtime or private .secrets into the image/public directory. Persist the
independent runtime secrets and DB volume securely; losing the vault key prevents
reading saved provider keys. Backup/restore and credential rotation require their
own procedure. Do not move release tags or reuse another application's credentials.

The separate Postfix service is configured with fresh TLS/DKIM keys and its own
private network/queue. TLS verification passes, but SPF/DKIM/DMARC DNS records have
not been published yet (user deferred this). Recovery remains explicitly unavailable.
Follow mail/README.md and mail/DNS-records.json, verify real delivery, then enable
MAIL_DELIVERY_READY in private configuration. Never reuse iphoneTest mail secrets.

Research/dosage/NRV schema 1.2 is implemented; see ANALYSIS.md. Migration
003_analysis_jobs adds only job metadata, never raw photos. Startup marks abandoned
jobs failed instead of repeating a paid request; run exactly one API instance.

Version 0.3.1 applies migration 004 before starting the new API: session expiry is
nullable and currently active rows become permanent. Expired rows are never revived.
The app runtime explicitly enables persistentSessions; generic toolkit defaults
remain twelve hours. Tokens stay hashed in DB and all revocation paths remain.
