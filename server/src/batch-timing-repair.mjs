/** Narrow repair for the released callback-clock bug. Never changes products,
 * retries providers, rewrites per-item outcomes or changes original timestamps. */
export function completedBatchRepair(job,ownedProductIds,now=new Date()){
 const result=typeof job.result==='string'?JSON.parse(job.result):structuredClone(job.result),items=result?.items;
 if(job.status!=='failed'||job.error_code!=='REQUEST_FAILED'||result?.failedPhase!=='enriching'||result?.pipeline!=='gemini-single'||!result.timings||!Array.isArray(items)||!items.length||items.some(i=>i.status!=='added'||!['complete','reused','failed'].includes(i.research)||!ownedProductIds.includes(i.id)))throw Error('Not a completed batch affected by the timing bug');
 const stamp=value=>value instanceof Date?value.getTime():Date.parse(value);
 const totalMs=stamp(job.finished_at)-stamp(job.created_at),recognitionMs=result.recognitionMs;
 if(!Number.isFinite(totalMs)||!Number.isFinite(recognitionMs)||recognitionMs<0||totalMs<recognitionMs)throw Error('Invalid original timing');
 result.timings={...result.timings,totalMs,detailsMs:totalMs-recognitionMs};result.monitor={...(result.monitor||{}),autoResearch:true};result.recovery={at:now.toISOString(),reason:'BATCH_TIMING_SCOPE_ERROR',originalStatus:job.status,originalError:job.error_code,originalFailedPhase:result.failedPhase,timingBasis:'original job timestamps'};delete result.failedPhase;
 return result;
}
