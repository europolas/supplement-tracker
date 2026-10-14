import test from 'node:test';
import assert from 'node:assert/strict';
import { indexedDB } from 'fake-indexeddb';
import { openDatabase } from '../src/database.js';
import { localDay, createDailyLog } from '../src/daily-log.js';

test('daily records persist, undo removes only the selected day and namespaces stay separate', async () => {
  const id='daily-test'; let db=await openDatabase(id,{indexedDB});
  const log=createDailyLog(db);
  await log.set('item:one',true,{day:'2026-10-14'});
  await log.set('item:one',true,{day:'2026-10-14'});
  await log.set('item:one',true,{day:'2026-10-15'});
  await createDailyLog(db,{namespace:'another-log'}).set('item:one',true,{day:'2026-10-14'});
  await db.set('records',{id:'plain-record'});
  db.close(); db=await openDatabase(id,{indexedDB});
  const restored=createDailyLog(db);
  assert.equal((await restored.list('2026-10-14')).length,1);
  await restored.set('item:one',false,{day:'2026-10-14'});
  assert.equal((await restored.list('2026-10-14')).length,0);
  assert.ok(await restored.get('item:one','2026-10-15'));
  assert.equal((await createDailyLog(db,{namespace:'another-log'}).list('2026-10-14')).length,1);
  db.close();
});
test('local calendar keys use the device calendar and reject invalid dates or record identifiers', async () => {
  assert.equal(localDay(new Date(2026,9,14,23,59)), '2026-10-14');
  assert.throws(()=>localDay('invalid'), /Invalid date/);
  const db={get(){},remove(){},set(){},list:async()=>[]}; const log=createDailyLog(db);
  await assert.rejects(log.set('one',true,{day:'2026-02-30'}),/Invalid calendar/);
  await assert.rejects(log.set('',true),/Invalid item/);
  await assert.rejects(log.set('one','yes'),/boolean/);
  assert.throws(()=>createDailyLog(db,{namespace:'../bad'}),/namespace/);
});
