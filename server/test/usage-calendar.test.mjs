import {test} from 'node:test';import assert from 'node:assert/strict';
import {usageCalendar,usageRange,localMidnight} from '../src/usage-calendar.mjs';
import {isTrackerRoute} from '../src/tracker-routing.mjs';
const product={id:'one',name:'Vitamin',analysis:{manufacturer:'Example'},group_id:'morning',created_at:'2026-10-12T08:00:00Z'};
const base={from:'2026-10-11',to:'2026-10-18',zone:'Europe/Vilnius',now:new Date('2026-10-16T09:00:00Z'),products:[product],groups:[],completions:[],pauses:[]};
test('history separates absent/future, missed past, pending today, and preserved taken records',()=>{
 let result=usageCalendar(base),by=day=>result.days.find(d=>d.day===day);
 assert.equal(by('2026-10-11').items.length,0);assert.equal(by('2026-10-12').counts.missed,1);assert.equal(by('2026-10-16').counts.pending,1);assert.equal(by('2026-10-16').counts.missed,0);assert.equal(by('2026-10-17').items.length,0);assert.equal(by('2026-10-17').future,true);
 result=usageCalendar({...base,completions:[{supplement_id:'one',local_day:'2026-10-15',completed_at:'2026-10-15T05:10:00Z'}],pauses:[{supplement_id:'one',started_at:'2026-10-14T12:00:00Z',resumed_at:null,resume_on:'2026-10-17',timezone:'Europe/Vilnius'}]});
 assert.equal(by('2026-10-14').counts.paused,1);assert.equal(by('2026-10-15').counts.taken,1);assert.equal(by('2026-10-15').total,1);assert.equal(by('2026-10-16').total,0);assert.equal(by('2026-10-16').items[0].resumeOn,'2026-10-17');assert.equal(by('2026-10-15').items[0].completedAt,'2026-10-15T05:10:00.000Z');
});
test('resumed and scheduled pause periods use their saved timezone and DST boundaries',()=>{
 assert.equal(localMidnight('2026-03-29','Europe/Vilnius').toISOString(),'2026-03-28T22:00:00.000Z');assert.equal(localMidnight('2026-03-30','Europe/Vilnius').toISOString(),'2026-03-29T21:00:00.000Z');
 assert.equal(+localMidnight('2026-10-26','Europe/Vilnius')-localMidnight('2026-10-25','Europe/Vilnius'),25*3600000);
 const pause={supplement_id:'one',started_at:'2026-10-12T09:00:00Z',resumed_at:'2026-10-16T08:00:00Z',resume_on:null,timezone:'Europe/Vilnius'};
 let days=usageCalendar({...base,pauses:[pause]}).days;assert.equal(days.find(d=>d.day==='2026-10-15').counts.paused,1);assert.equal(days.find(d=>d.day==='2026-10-16').counts.pending,1);
 days=usageCalendar({...base,pauses:[{...pause,resumed_at:null,resume_on:'2026-10-16'}]}).days;assert.equal(days.find(d=>d.day==='2026-10-16').counts.pending,1);
});
test('history range is bounded and tracker-owned',()=>{
 assert.equal(isTrackerRoute('/usage'),true);assert.equal(isTrackerRoute('/usage-other'),false);assert.deepEqual(usageRange(new URLSearchParams({from:'2026-10-01',to:'2026-11-11'})),{from:'2026-10-01',to:'2026-11-11'});
 for(const [from,to]of [['2026-02-30','2026-03-01'],['2026-10-20','2026-10-19'],['2026-01-01','2026-12-31'],['bad','bad']])assert.throws(()=>usageRange(new URLSearchParams({from,to})),e=>e.status===400);
});
test('historical group labels survive later moves, rename, deletion and same-day completion changes',()=>{
 const groupHistory=[{id:1,supplement_id:'one',group_id:'old',group_name:'Morning',group_icon:'sun',group_position:0,effective_at:'2026-10-12T08:00:00Z'},{id:2,supplement_id:'one',group_id:'next',group_name:'Evening',group_icon:'moon',group_position:3,effective_at:'2026-10-15T08:00:00Z'},{id:3,supplement_id:'one',group_id:'next',group_name:'Renamed',group_icon:'dose',group_position:1,effective_at:'2026-10-16T08:00:00Z'},{id:4,supplement_id:'one',group_id:null,group_name:null,group_icon:null,group_position:null,effective_at:'2026-10-16T08:30:00Z'}];
 const result=usageCalendar({...base,groups:[],groupHistory,completions:[{supplement_id:'one',local_day:'2026-10-16',completed_at:'2026-10-16T07:00:00Z',group_snapshot:{groupId:'next',name:'Evening',icon:'moon',position:3}}]});
 assert.equal(result.days.find(d=>d.day==='2026-10-14').groups[0].name,'Morning');assert.equal(result.days.find(d=>d.day==='2026-10-15').groups[0].name,'Evening');assert.equal(result.days.find(d=>d.day==='2026-10-16').groups[0].name,'Evening');
 const current=usageCalendar({...base,groupHistory}).days.find(d=>d.day==='2026-10-16');assert.equal(current.groups[0].id,null);assert.equal(current.groups[0].unknown,false);
 const unknown=usageCalendar({...base,groupHistory:groupHistory.slice(1)}).days.find(d=>d.day==='2026-10-14');assert.equal(unknown.groups[0].unknown,true);assert.equal(unknown.items[0].groupId,null);
});
