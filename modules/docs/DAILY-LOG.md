# Daily completion log

A reusable example contributed while starting supplement-tracker. It also works
for habits and daily checklists. It stores completion events, not health guidance.

```js
import { openDatabase, createDailyLog, localDay } from './modules/index.js';
const db = await openDatabase('my-app');
const log = createDailyLog(db, { namespace: 'routine-log' });
await log.set('item-123', true);
const completed = await log.list(localDay());
await log.set('item-123', false); // undo today's completion
// Close only when the app/screen stops using the database.
db.close();
```

The local device calendar determines the default day; UTC serialization is only
used for completedAt timestamps. An explicit YYYY-MM-DD day is validated, including
month lengths. A stable item/day key prevents duplicate rows; repeat marks update
the timestamp. Separate namespaces isolate routines within a store. Undo removes
only that item/day. Data is device-local and browser storage can be cleared.

No reminder scheduling, cloud sync, medical dosage rules or cross-device clock
reconciliation is provided. Refresh the caller's view on focus/midnight; concurrent
windows use last-write-wins semantics. Apps own deletion/archive policies for items.
