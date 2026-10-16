import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pausedOn,validReturnDate} from '../src/supplement-pause.mjs';
test('pause return date uses its original zone, including DST and calendar validation',()=>{
 const row={paused_at:new Date(),resume_on:'2026-10-26',pause_timezone:'Europe/Vilnius'};
 assert.equal(pausedOn(row,new Date('2026-10-25T21:59:59Z')),true);
 assert.equal(pausedOn(row,new Date('2026-10-25T22:00:00Z')),false);
 assert.equal(pausedOn({...row,resume_on:null},new Date('2030-01-01Z')),true);
 assert.equal(pausedOn({paused_at:null}),false);
 assert.throws(()=>validReturnDate('2027-02-29','2026-01-01'));
 assert.equal(validReturnDate('2028-02-29','2026-01-01'),'2028-02-29');
});
