/** Explicit owner-scoped maintenance for legacy automatically-unassigned records.
 * Run with --apply only after review/tests. A private mounted backup directory is
 * mandatory. No dose/source edits; optimistic snapshots preserve concurrent edits.
 * Does not run at startup or retry failed/billable requests automatically.
 */
import mysql from 'mysql2/promise';
import {readFileSync,writeFileSync} from 'node:fs';
import {createCredentialVault} from '../src/credential-vault.mjs';
import {createStructuredOutput} from '../src/structured-research.mjs';
import {regroupMessages,regroupSchema,validRegroup} from '../src/grouping.mjs';
if(!process.argv.includes('--apply')||!process.env.REPAIR_OWNER_FILE||!process.env.REPAIR_BACKUP_DIR)throw Error('Explicit --apply, owner file and private backup directory required');
const read=name=>readFileSync(process.env[name],'utf8').trim();
const db=await mysql.createConnection({host:process.env.DB_HOST,user:process.env.DB_USER,database:process.env.DB_NAME,password:read('DB_PASSWORD_FILE')});
try{
 const {email}=JSON.parse(readFileSync(process.env.REPAIR_OWNER_FILE,'utf8'));
 const [owners]=await db.execute('SELECT id FROM users WHERE email=? AND disabled=FALSE',[email]);if(owners.length!==1)throw Error('Owner unavailable');const owner=owners[0].id;
 const [groups]=await db.execute('SELECT id,name,description FROM day_groups WHERE user_id=? ORDER BY position',[owner]);
 const [rows]=await db.execute('SELECT id,name,group_id,analysis FROM supplements WHERE user_id=? ORDER BY id',[owner]);const products=rows.map(r=>({...r,analysis:typeof r.analysis==='string'?JSON.parse(r.analysis):r.analysis}));
 const candidates=products.filter(p=>!p.group_id&&p.analysis.grouping?.basis!=='manual'&&p.analysis.identity?.groupId);
 if(!candidates.length){console.log(JSON.stringify({updated:0,reason:'No legacy automatic omissions'}));}
 else{
  const [keys]=await db.execute('SELECT encrypted_key FROM provider_credentials WHERE user_id=?',[owner]);if(keys.length!==1)throw Error('Key unavailable');const sealed=keys[0].encrypted_key;
  const vault=createCredentialVault(Buffer.from(read('VAULT_KEY_FILE'),'hex')),started=Date.now();
  const response=await createStructuredOutput({timeout:90000,reasoningEffort:'low'})({key:vault.open(sealed,{owner,provider:'xai'}),model:'grok-4.7',messages:regroupMessages({groups,products,language:'lt'}),schema:regroupSchema(groups,products),validate:v=>validRegroup(v,groups,products),name:'routine_reconciliation',maxTokens:4000});
  const stamp=Date.now(),prefix=process.env.REPAIR_BACKUP_DIR+'/grouping-'+stamp;
  writeFileSync(prefix+'-before.json',JSON.stringify({owner,rows}),{mode:0o600});writeFileSync(prefix+'-proposal.json',JSON.stringify(response),{mode:0o600});
  await db.beginTransaction();let updated=0,skipped=0;
  try{
   const [active]=await db.execute('SELECT id FROM users WHERE id=? AND disabled=FALSE FOR UPDATE',[owner]);const [key]=await db.execute('SELECT encrypted_key FROM provider_credentials WHERE user_id=?',[owner]);if(!active.length||key[0]?.encrypted_key!==sealed)throw Error('Owner/key changed');
   const [liveGroups]=await db.execute('SELECT id,name,description FROM day_groups WHERE user_id=? ORDER BY position',[owner]);if(JSON.stringify(groups)!==JSON.stringify(liveGroups))throw Error('Groups changed');
   for(const candidate of candidates){
    const proposal=response.result.assignments.find(a=>a.supplementId===candidate.id);if(!proposal?.groupId){skipped++;continue;}
    const [current]=await db.execute('SELECT group_id,analysis FROM supplements WHERE id=? AND user_id=? FOR UPDATE',[candidate.id,owner]);const row=current[0],analysis=row&&(typeof row.analysis==='string'?JSON.parse(row.analysis):row.analysis);
    if(!row||row.group_id||JSON.stringify(analysis)!==JSON.stringify(candidate.analysis)){skipped++;continue;}
    analysis.grouping={groupId:proposal.groupId,basis:'provisional',explanation:proposal.reason,previousWhenToUse:analysis.whenToUse,reconciledAt:new Date().toISOString()};analysis.needsReview=true;
    await db.execute('UPDATE supplements SET group_id=?,analysis=? WHERE id=? AND user_id=?',[proposal.groupId,JSON.stringify(analysis),candidate.id,owner]);updated++;
   }
   await db.commit();console.log(JSON.stringify({updated,skipped,seconds:Math.round((Date.now()-started)/1000),model:response.model}));
  }catch(error){await db.rollback();throw error;}
 }
}catch(error){console.error(JSON.stringify({error:error.code||'RECONCILIATION_FAILED'}));process.exitCode=1;}finally{await db.end();}
