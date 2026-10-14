import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTaskQueue} from '../server/task-queue.mjs';
test('queue bounds concurrency, prioritizes waiting tasks and continues after rejection',async()=>{
 const queue=createTaskQueue({concurrency:1,maxPending:3}),order=[];let release;const gate=new Promise(r=>release=r);
 const a=queue.enqueue(async()=>{order.push('a');await gate;throw Error('expected');});const caught=assert.rejects(a,/expected/);
 const b=queue.enqueue(()=>order.push('b')),c=queue.enqueue(()=>order.push('c'),{priority:10}),d=queue.enqueue(()=>order.push('d'));
 await assert.rejects(queue.enqueue(()=>{}),/QUEUE_FULL/);assert.equal(queue.running,1);release();await Promise.all([caught,b,c,d]);assert.deepEqual(order,['a','c','b','d']);queue.close();await assert.rejects(queue.enqueue(()=>{}),/QUEUE_CLOSED/);
});
test('close rejects pending work without claiming to cancel a running provider call',async()=>{
 const queue=createTaskQueue();let release;const running=queue.enqueue(()=>new Promise(r=>release=r));await Promise.resolve();const waiting=queue.enqueue(()=>assert.fail('Closed task ran'));const rejected=assert.rejects(waiting,/QUEUE_CLOSED/);queue.close();release('done');assert.equal(await running,'done');await rejected;
});
