# Bounded server task queue

`createTaskQueue` is a Node-only helper. It runs functions with a fixed concurrency
and bounded pending count, ordering waiting tasks by descending priority and FIFO
within a priority. Running work is never preempted. A rejection releases the slot;
no retry is performed, especially for billable provider calls.

```js
import { createTaskQueue } from '@europolas/app-modules/server/task-queue';
const network = createTaskQueue({ concurrency: 4, maxPending: 16 });
const research = createTaskQueue({ concurrency: 1, maxPending: 320 });
const preview = await network.enqueue(() => recognize(request), { priority: 10 });
// Save preview records and return owner-scoped progress BEFORE awaiting details.
await research.enqueue(() => network.enqueue(() => collectDetails(target)));
// On service teardown (also give running network calls a timeout/AbortSignal):
research.close(); network.close();
```

Always handle the returned promise, including when launching a background task.
`QUEUE_FULL` and `QUEUE_CLOSED` are safe lifecycle errors; tasks have no built-in
persistence. close() rejects queued tasks and does not cancel a running request.
size/running expose counts only. Do not serialize arbitrary closures or secrets.
Persist application job IDs/status and explicitly fail interrupted work on restart;
never silently replay potentially paid work. Authorization, idempotency, fair per-user
limits and fresh collection checks remain the caller's responsibility.

For progressive AI apps, use one fast schema-validated recognition/grouping response
for the entire input (including a multi-product image), then separately enrich only
missing/stale records. Keep the raw image out of the research queue. A low concurrency
background queue leaves room for fast interactive requests; network priorities affect
waiting work only. A recognized record is provisional until sources are checked.

## Owner-scoped upload queues and persistent process views

Use a separate small recognition queue per authenticated owner when accepting a
second photo/name during recognition. For example, concurrency:1 and maxPending:3
allow four active uploads for an owner. Enforce an independent global cap, owner
quotas and idempotent acceptance before retaining any payload. A map of queues must
remove idle entries and close them at shutdown. Recheck authorization/key ownership
when a queued task actually starts, not only when its HTTP request is accepted.

Only recognition and the atomic preview commit belong inside that owner queue:

```js
await ownerRecognition.enqueue(async () => {
  await authenticateAgain();
  const preview = await network.enqueue(() => recognize(input), { priority: 10 });
  await savePreviewAndProgress(preview);
  input.image = null; // Discard in finally too, including failure paths.
});
// The owner's next photo may recognize while these details are collected.
await research.enqueue(() => enrichMissingDetails());
```

Persist safe job metadata (opaque ID, owner, queued/recognizing/enriching/done phase,
created/finished time, per-record results and failed phase), never raw photos, bearer
tokens or provider keys. An authenticated history endpoint can return recent jobs
and all active jobs; filter every query by owner. This restores progress after page
reload while bounded private image payloads remain transient server memory. Mark
abandoned jobs failed on restart instead of silently charging a replay.

Keep the upload composer separate from process history. Disable it only during the
submission transfer, clear only the accepted draft, then let the user enqueue more.
Modal close/reopen must keep history and the next unsent draft; polling must never
reset the form or a selected image. Merge history by job ID, show each stage and
per-record failure, preserve expanded cards, and clear all account state on logout.
An unsent photo need not survive page reload; do not introduce private photo browser
persistence as a side effect of implementing server job history. All display strings
follow the chosen language, with English as default and Lithuanian as explicit option.
