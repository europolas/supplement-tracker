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

SMTP is not configured/verified, so password-recovery requests return an explicit
unavailable response instead of claiming an email was sent. This does not prevent
sign-in, registration or PWA installation. Live product research and source-linked
nutrient/dose calculation remain outside this release's implemented AI adapter.
