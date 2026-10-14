/** Bounded in-process promise queue. Higher priority runs first, FIFO within a
 * priority. It never retries or persists task payloads. close() rejects waiting
 * tasks; running tasks must implement their own timeout/AbortSignal. Always handle
 * the returned promise, and close the queue when its owning service is disposed.
 * Use a durable application job record when clients must reconnect after reload.
 */
export function createTaskQueue({concurrency=1,maxPending=100}={}){
 if(!Number.isInteger(concurrency)||concurrency<1||!Number.isInteger(maxPending)||maxPending<1)throw new TypeError('Invalid queue limits');
 let running=0,sequence=0,closed=false;const waiting=[];
 function drain(){while(!closed&&running<concurrency&&waiting.length){const item=waiting.shift();running++;Promise.resolve().then(item.task).then(item.resolve,item.reject).finally(()=>{running--;drain();});}}
 return {
  enqueue(task,{priority=0}={}){if(typeof task!=='function'||!Number.isFinite(priority))return Promise.reject(new TypeError('Invalid queued task'));if(closed)return Promise.reject(new Error('QUEUE_CLOSED'));if(waiting.length>=maxPending)return Promise.reject(new Error('QUEUE_FULL'));return new Promise((resolve,reject)=>{waiting.push({task,priority,sequence:sequence++,resolve,reject});waiting.sort((a,b)=>b.priority-a.priority||a.sequence-b.sequence);drain();});},
  get size(){return waiting.length;},get running(){return running;},
  close(){closed=true;for(const item of waiting.splice(0))item.reject(new Error('QUEUE_CLOSED'));}
 };
}
