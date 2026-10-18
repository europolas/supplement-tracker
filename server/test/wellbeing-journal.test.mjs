import {test} from 'node:test';import assert from 'node:assert/strict';
import {normalizeWellbeing,saveWellbeing} from '../src/wellbeing-journal.mjs';
import {isTrackerRoute}from'../src/tracker-routing.mjs';
const entry={mood:4,sleep:4,energy:3,digestion:4,observations:['better_sleep','more_energy'],notes:' A note '};
test('journal fields accept unset ratings, safe text and stable observations only',()=>{
 assert.deepEqual(normalizeWellbeing(entry),{...entry,observations:['more_energy','better_sleep'],notes:'A note'});
 assert.equal(normalizeWellbeing({...entry,mood:null}).mood,null);
 for(const bad of [{...entry,mood:0},{...entry,energy:6},{...entry,sleep:'4'},{...entry,digestion:2.5},{...entry,observations:['unknown']},{...entry,observations:['other','other']},{...entry,notes:'x'.repeat(1001)},{...entry,user_id:'another-owner'},{}])assert.throws(()=>normalizeWellbeing(bad),e=>e.status===400);
 assert.equal(normalizeWellbeing({...entry,notes:'<img src=x onerror=alert(1)>'}).notes,'<img src=x onerror=alert(1)>');assert.equal(isTrackerRoute('/wellbeing'),true);assert.equal(isTrackerRoute('/wellbeing/2026-10-18'),true);assert.equal(isTrackerRoute('/wellbeing-other'),false);
});
test('invalid journal dates reject before DB access',async()=>{
 for(const day of ['2026-02-30','2026-10-20','1999-12-31','broken'])await assert.rejects(saveWellbeing({},'owner',day,{revision:0,entry},'UTC','2026-10-19'),e=>e.status===400);
});
