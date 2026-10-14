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
