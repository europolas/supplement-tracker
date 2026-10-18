import {test} from 'node:test';import assert from 'node:assert/strict';
import {normalizeIntakePlan,intakeSlots,stockChange} from '../src/intake-plan.js';
test('recurrence is local-day based and validates strict finite choices',()=>{
 assert.equal(intakeSlots(null,'2026-10-19')[0].slot,'daily');
 const p={version:1,mode:'weekdays',weekdays:[1,5],times:['19:00','08:00'],quantity:2,unit:'capsule'};
 assert.equal(intakeSlots(p,'2026-10-18').length,0);assert.deepEqual(intakeSlots(p,'2026-10-19').map(s=>s.slot),['08:00','19:00']);
 const interval={...p,mode:'interval',startDate:'2026-03-28',intervalDays:2};assert.equal(intakeSlots(interval,'2026-03-30').length,2);assert.equal(intakeSlots(interval,'2026-03-29').length,0);assert.equal(intakeSlots(interval,'2026-03-26').length,0);
 for(const bad of [{...p,times:['08:00','08:00']},{...p,quantity:0},{...p,weekdays:[]},{...interval,startDate:'2026-02-30'}])assert.throws(()=>normalizeIntakePlan(bad));
});
test('stock debits never become negative and undo only restores real debit',()=>{
 assert.deepEqual(stockChange(1,2),{remaining:0,debited:1});assert.deepEqual(stockChange(0,2,{undo:true,debited:1}),{remaining:1,debited:0});assert.deepEqual(stockChange(null,2),{remaining:null,debited:0});
});
