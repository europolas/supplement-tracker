# Recurring intake and inventory primitives

`normalizeIntakePlan`, `intakeSlots` and `stockChange` are pure browser/server-safe
functions. They make no medical recommendations. The host supplies local days in
its explicit IANA timezone. Weekdays use ISO Monday=1 to Sunday=7; every-N-days
uses calendar-day differences, independent of DST. Null means one untimed daily
occurrence. A plan supports up to six distinct wall-clock times and a manually
chosen integer amount/unit per occurrence. Units describe stock, not active mg.

```js
const plan=normalizeIntakePlan({version:1,mode:'weekdays',weekdays:[1,3,5],
 times:['08:00','19:00'],quantity:2,unit:'capsule'});
const slots=intakeSlots(plan,'2026-10-19');
const debit=stockChange(30,slots[0].quantity); // remaining:28, debited:2
const undo=stockChange(28,2,{undo:true,debited:debit.debited});
```

The caller persists owner-scoped plan versions and immutable occurrence snapshots.
Never recompute past history from today's schedule. Lock owner/product and unique
(product, local day, slot) before writing. Repeated requests must not debit twice;
undo credits only the actual prior debit. Zero stock does not prevent recording a
real dose; debit is capped at available stock. Null stock disables tracking. When
tracking is turned off/on, use a new inventory epoch so old undos cannot invent
stock. Separate user-entered quantities from AI/manufacturer dosage facts.

No timers, network, notifications, database, rendering or cleanup are owned here.
For a standalone server container, copy this dependency-free source as a server
ES module and retain its tests; do not expose server imports to browser code.
