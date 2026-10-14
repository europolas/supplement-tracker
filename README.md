# Supplement Tracker · 0.7.1

Independent PWA generated from europolas/pwa-toolkit starter and app-modules 1.8.1.
Sources: src/; versioned shared library: modules/; public build: docs/; API: server/.
Design A uses sage/off-white with persisted light, dark and system/auto themes.
English is the first-use default; Lithuanian remains an explicit saved choice.
The toolkit's full-height iPhone scroller, keyboard behavior, hidden scrollbar and
smoothly masked blur remain in place.

## Running functions

- Account registration/sign-in/profile/password change/logout/deletion and admin
  user blocking. Recovery forms exist, but email remains unavailable until SMTP
  configuration and real delivery verification are complete. The separate mail
  service is prepared and TLS-tested; the user deferred publishing its DNS records.
- Account-owned xAI key save/replace/delete. AES-256-GCM encrypted server storage;
  plaintext keys are never returned or saved in browser persistence.
- Day groups with their own name and benefit/description. Home shows each group's
  title, benefit on another line, then a supplement table with the check control
  first, then clickable name and a short muted benefit below the name. Taken rows turn green.
- Product name/manufacturer or an explicitly selected photo can be sent to xAI.
  Separate camera/library controls are available. A photo may contain several
  readable products: each is independently researched and saved with progress,
  partial successes and unreadable/failed explanations. All groups and existing
  supplements (including earlier batch additions) are included for compatibility review.
  JSON Schema is checked again on the server; incompatible/duplicate products are
  left unassigned for review. Analysis has sending/completed/error states.
- Supplement detail, manual group reassignment and deletion. Daily completion is
  derived using device timezone on the server; new local dates start unmarked while
  old completion records remain. No background midnight job is necessary.
- Public PWA shell can install/cache offline. Account data and changes require
  internet. API data, photos and keys never enter the public worker cache.

AI now performs real web research via xAI Responses. Exact manufacturer directions,
serving size, ingredients, cautious benefits, timing and whole-routine compatibility
are validated against a strict 1.4 schema; source URLs must occur in provider tool
metadata. Details include manufacturer dose, per-serving/daily quantities and
server-calculated EU adult food-label NRV percentages for 27 vitamins/minerals.
Ambiguous variants or unsupported units stay unknown instead of inventing a dose.
NRVs are label references, not personal medical prescriptions or upper limits.

Analysis is progressive. ONE fast structured response identifies and provisionally
groups every readable product from a name/photo, with all groups and the existing
routine included. English instructions request the selected app response language
(en by default, persisted lt when chosen). Schema 1.4 enforces the language marker
for detailed results. Real test: the supplied seven-product photo was recognized
and provisionally grouped in 5.8 seconds using grok-4.3 with reasoning none; this is
one measurement, not a latency guarantee. Exact brand names remain untranslated.

All recognized records are saved immediately with visible queued/researching/failed
states. One serialized background research queue then enriches missing/stale details
using the selected research model (grok-4.7, low reasoning). Source/dose/NRV rules
remain strict. Each target sees every other draft/saved product; uncertain contexts
cannot receive blanket safe assessments. UI polling resumes after iOS suspension,
allows new queued inputs during recognition or enrichment and never puts photos/keys in browser storage.

Within an account, exact product/variant identities reuse confirmed information in
the SAME language for up to 30 days. In-flight identical products are not rebilled.
Historical saved text retains its language until explicit refresh. The detail page's
refresh action uses the current app language and makes one research request without
recognition or a duplicate product row. Manual group edits win; compatibility is
marked stale if the collection changes during research. Interrupted queues are not
automatically retried; their records remain visible with retry controls.

Limits: 30 groups, 40 supplements; 4 submissions/minute and 30/day per owner;
one simultaneous recognition and at most four running jobs/account, eight globally.
Four bounded provider slots with recognition priority; one background research at a
time leaves capacity for interactive work. A fast submission plus per-product web
research may incur several xAI charges. Raw photos are released before background
work begins. Single API instance; no distributed queue/payload durability is implied.
The add dialog displays each upload's queued, recognizing/grouping, researching and
finished/failed stages, including every recognized product and skipped label.
Closing/reopening keeps the process view and the unsent draft/photo in memory.
Reload restores active jobs and the latest 20 history entries from the authenticated
API (seven-day retention); an unsent photo is intentionally not persisted. The form
unlocks after the server accepts an upload, so another name/photo can join the queue
while earlier recognition runs. Up to four uploads can be active per account.
Read server/ANALYSIS.md for provenance, lifecycle and calculation limits.

## Development and checks

```bash
npm ci
npm test
npx playwright install chromium
npm run test:browser
npm run build
npm start -- --port 4175
```

```bash
docker build -t supplement-tracker-api server
server/scripts/test-isolated.sh
```

The DB workflow starts an ephemeral, separate MariaDB instance, generates temporary
credentials and removes it afterwards. It never reads deployment DB configuration.
CI runs both browser and isolated server workflows. Provider regression checks use
mocks. A manual paid provider smoke check reads only a mounted private key and never
uses account records or emits raw provider responses.

## Reused and contributed modules

config, storage, settings, theme, i18n, viewport, gestures, router, forms, ui, network,
auth, auth-screen, pwa/worker, daily-log (calendar key) and generic server AuthApi,
security/migrations. New image-input, server/credential-vault and
server/structured-chat and server/structured-research examples are contributed to canonical pwa-toolkit, with
contracts/tests in modules/docs/AI.md. App schema and supplement policy stay here.

## Publication

See server/DEPLOYMENT.md. Target URL: https://perimove.com/supplement-tracker/.
Public HTTPS, manifest, worker and real browser administrator login were verified
on 2026-10-14. No browser JavaScript errors were observed.
The server uses separate DB, credentials and loopback API/static ports. This deploy
never synchronizes the original iphoneTest API or DB. Private bootstrap/key files
live outside Git; .runtime/ contains deployment secrets and must never be published.
GitHub Pages is optional; this deployment uses the existing perimove.com HTTPS host.

Keep .npmrc (install-links=true) and package-lock.json aligned for npm ci.

Optional explicit paid end-to-end verification against a disposable DB:

```bash
LIVE_RESEARCH=1 PROVIDER_TEST_KEY_FILE=/private/path/to/key server/scripts/test-isolated.sh
```

Browser checks build to .runtime/browser-public so they never disturb mounted
production docs. Mail DNS records and delivery activation steps: server/mail/README.md.

## Remembered sign-in

Sign-in survives app/browser restart and has no server time expiry. Only the
revocable opaque token and nullable expiry are persisted on the device, never a
password/profile/API key. Logout, password change/reset, admin blocking or account
deletion revoke access. Clearing site data or OS eviction still removes sign-in.
Migration 004 upgrades only still-valid sessions; a previously lost session requires
one new sign-in. Reusable toolkit defaults remain session-scoped and twelve hours.

## Compact Home, timing groups and reference dosing (0.7.0)

AI schema 1.4 separates benefitSummary (2–5 words, maximum 6 / 80 characters) from
full benefits. Home uses a two-column check/name table, with the short summary under
the name. Full evidence-qualified prose remains in details. Older records fall back
to compactText without changing full saved text. The reusable plain-text limiter is
contributed to app-modules 1.8.0 with Unicode/length tests and TEXT.md usage guide.

Grouping uses the most specific existing timing group (including with-fat meals).
Dose/variant uncertainty and low overall confidence require review but do not erase
an otherwise explicit timing match. Potential conflicts/duplicates still block
automatic assignment, and manual edits during research remain authoritative.

When exact manufacturer daily directions are unavailable, research must attempt a
separate doseFallback from authoritative clinical/regulatory primary sources: an
established adult intake reference or an explicitly supported usual adult supplement
range. Detail labels it separately with source, population/limits and explanation.
It is not a personal prescription, capsule count or replacement manufacturer claim.
Absent suitable evidence, the amount remains unavailable with a reason. Clinical
trial regimens, upper limits and EU label NRVs must never become default doses.
Fallback amounts do not fill label servings, ingredient amounts or NRV daily math.
Old analyses remain readable; explicit detail refresh obtains the new dose lookup.

## Compact supplement detail (0.7.1)

The initial detail view contains dose (with qualified fallback when available),
benefits, full compatibility and timing. A native, keyboard-accessible More/Less
information disclosure contains manufacturer/variant, longer review explanations,
how-to text, cautions, nutrients/NRV, source links, research metadata and refresh,
group and delete actions. No saved information is discarded. Expansion survives
redraws for the same product but resets for another product or sign-out; it is not
persisted. A stale compatibility notice remains with compatibility so its meaning
is clear. Draft doses stay pending until detailed research is ready.
