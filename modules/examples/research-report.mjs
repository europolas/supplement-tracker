/** Optional two-stage AI report orchestration. Public lookup gets ONLY names/date;
 * private context/profile are passed to synthesis only. Callback transports/keys,
 * auth, consent revision and app policy stay server-side and app-owned. No retries.
 */
import {allowedProfile} from '../server/workflow-store.mjs';
import {citationUrl} from '../server/structured-research.mjs';
export function createResearchReportRunner({reports,lookup,synthesize,checkCurrent}){
 if(typeof checkCurrent!=='function')throw new TypeError('Authorization/revision guard required');
 return {async generate({owner,id,publicNames,context,profile={},consent=false,fields=[]}){
  if(!Array.isArray(publicNames)||!publicNames.length||publicNames.length>100||publicNames.some(n=>typeof n!=='string'||!n.trim()||n.length>250))throw new TypeError('Public names required');
  const personal=allowedProfile(profile,{consent,fields}),snapshot={context,personal,publicNames},asOf=new Date().toISOString().slice(0,10);
  await checkCurrent();const run=await reports.begin(owner,id,snapshot);
  try{await checkCurrent();const research=await lookup({names:[...publicNames],asOf});const sources=[...new Set((research.citations||[]).map(citationUrl).filter(Boolean))];if(!research.searches||!sources.length)throw Error('AI_RESEARCH_FAILED');await checkCurrent();const report=await synthesize({context:structuredClone(context),personal,research:{text:research.text,sources},asOf});await checkCurrent();return await reports.complete(owner,id,run.token,report);}catch(error){try{await reports.fail(owner,id,run.token,'REQUEST_FAILED');}catch{}throw error;}
 }};
}
