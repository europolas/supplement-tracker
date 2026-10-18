# Durable jobs, proposals, reports and historical activity

Server-only opt-in components extracted from Supplement Tracker, without its
supplement/grouping rules. No public HTTP endpoints are installed automatically.
Import `server/workflow-store.mjs` / `server/activity-history.mjs`; new server
projects include matching source snapshots and optional workflows.sql. Generated
apps receive these files, but no production DB or deployed API is changed.

## Persistence and security

Apply `server/workflows.sql` once through your app's migration runner. Inject a
mysql2-compatible pool into createSqlWorkflowStore(pool). The app_workflows table
has a compound owner/kind/id key, JSON document, revision and updated timestamp.
Owners are authenticated server session IDs, NEVER a body/client-provided user ID.
Documents are capped at 256 Ki characters (host should also cap payload bytes).
Use low-privilege DB users. There are no auth-table foreign keys: call
store.removeOwner(authenticatedOwner,{db}) using the app's account-deletion connection or
adapt the schema with explicit FKs. Never persist credentials, raw images, personal
prompts or arbitrary exception/provider bodies. Persist only deliberately selected
metadata/results. Return allowlisted fields to the browser. Idempotency does not
replace quotas/rate limits, authorization or collection revision guards.

Store contracts: read(owner,kind,id), list(owner,kind), create(owner,kind,id,doc),
mutate(owner,kind,id,callback), removeOwner(owner). create is idempotent for the
scoped ID. mutate locks a row in a transaction, passes (document,dbConnection),
and writes a revision only if callback returns a document. Missing rows fail,
including after clearing/deletion; late work cannot recreate them. Callback writes
to related app tables MUST use the supplied db connection to be atomic. External
API/paid calls do not belong inside this lock and cannot be rolled back by SQL.

```js
const store=createSqlWorkflowStore(pool),jobs=createJobService(store);
const job=await jobs.submit(owner,{requestId,type:'import',total:items.length,
 metadata:{label:'Import'}});
// Only queued -> running succeeds, preventing duplicate execution.
await jobs.start(owner,job.id);
try {
 // Recheck session/key/consent after queue wait, before every external call.
 const result=await runExplicitlyAuthorizedWork();
 await jobs.progress(owner,job.id,{processed:items.length,items:result.items});
 await jobs.finish(owner,job.id,result);
} catch { await jobs.fail(owner,job.id,'REQUEST_FAILED'); }
```

Use existing createTaskQueue to bound actual execution, per-owner fairness and
interactive/background priority. Services persist state, not closures/execution.
On server restart explicitly call jobs.interrupt(owner) for affected owners:
queued/running jobs become INTERRUPTED; they are never silently replayed or billed.
Progress is monotonic and partial items remain available after failure. Keep safe
error codes rather than raw errors. `removeOwner` deliberately clears all kinds.
A consumer requiring fine-grained deletion can extend the store with the same
ownership/transaction rules. No production cleanup scheduler is installed.

## Independent decisions

```js
const proposals=createProposalService(store);
await proposals.create(owner,reviewId,[{id:'one',name:'Item',from:'A',to:'B',
 inputFingerprint:workflowFingerprint(selectedInput)}]);
await proposals.resolve(owner,reviewId,itemId,'accept',{
 validate:async(item,db)=>item.inputFingerprint===await currentHash(owner,db),
 apply:async(item,db)=>updateOwnedDomainRow(owner,item,db)
});
// 'remove' needs no domain write. Repeating the same action is idempotent.
```

Each pending item persists until accept/remove. Opposite repeated decisions and
stale input fail. Concurrent accept uses one row lock; the domain change occurs
once. The host supplies current permissions, semantic fingerprints, target validity
and revision checks; the generic service cannot infer business validity.

## Reports, consent and public search

createReportService(store) provides read(owner,id,input), begin(owner,id,input),
complete(owner,id,token,report), fail(owner,id,token,safeCode). begin obtains a unique
execution token and retains the last successful report. complete ignores no stale
tokens: it rejects them; fail never overwrites a report. read computes stale against
the caller-selected semantic input via workflowFingerprint. Exclude transient Taken
state, locale caches and irrelevant display fields before hashing. Include semantic
preferences, allowed profile and meaningful records. Do not hash secrets/prompts.

allowedProfile(profile,{consent,fields}) defaults to no fields/no consent, strips
null/empty values and returns only an explicit field allowlist. Convert date of
birth into an age on the server when needed; do not send exact birth dates to AI.
Search must receive an independently built PUBLIC projection (public names or
keywords only), without private profile, goals, owner IDs or full context. Private
synthesis may combine grounded retrieved evidence with the allowed projection.
Recheck consent and existence after search, before synthesis, and before saving.
The generic service deliberately does not contact AI or choose a medical policy.

## Historical categories and pause periods

`buildActivityHistory({from,to,timeZone,now,items,assignments,completions,pauses})`
returns the browser calendar's range and day records, capped at 42 inclusive days.
Items: `{id,name,subtitle,createdAt}`. Assignment events:
`{itemId,effectiveAt,sequence?,category:{id,name,icon?,position?}}`. Completions:
`{itemId,day,completedAt,categorySnapshot?}`. Pause periods:
`{itemId,startedAt,resumeOn,timeZone,resumedAt}`.

Persist assignment/category snapshots in the SAME transaction as a move/rename/
delete. Keep historical labels independent of current-category foreign keys. Never
backdate a fabricated current assignment into unknown history. A completion's
captured category wins over an assignment event, even at the same millisecond;
otherwise use the last assignment at completion/day end. Future days are empty,
before-creation days are absent, completion wins over pause. Unknown history stays
unknown. The read model does not mutate the DB and does not infer forgotten events.

createPause({resumeOn:null|YYYY-MM-DD,timeZone,now}) returns a period. Null means
manual resume; otherwise return is inclusive from local midnight in the CAPTURED
zone. pauseActive(period,now) needs no cron/write and travel does not shift return.
Persist periods separately from completions; resuming writes resumedAt without
removing old completion/history rows. localMidnight handles normal DST transitions.
Calendars in regions with skipped civil dates require host-specific date policy.

## Resilient translation example

examples/localization-provider.mjs exports createLocalizationProvider(provider,
{model}), protectNumbers and restoreNumbers. It deduplicates text slots, masks exact
numeric literals, repairs only failed slots once, and reports successful products
plus failedIds. Network/key failures never retry automatically. The provider is
injected and billed by the app; importing this example calls nothing. Pair with
analysis-localization's source fingerprints, validLocalizationBatch and owner/late
write guards; cache only translations, never rewrite source numbers/identities.

`examples/research-report.mjs` provides createResearchReportRunner with injected
lookup/synthesize transports. Public lookup receives names/date ONLY. Synthesis
receives the explicitly allowed profile and context. A required checkCurrent
callback revalidates auth/consent/revision before lookup, after lookup and before
saving. Missing grounding fails the run; the previous report remains. Never place
personal fields inside context or publicNames to bypass the consent projection.
