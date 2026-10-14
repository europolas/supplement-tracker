/** Explicit paid provider smoke check. Read only a mounted private key; no DB or
 * account records. Print validation metadata, never request text, key or raw output.
 * Run manually after authorizing a provider request; CI uses mocks instead. */
import {readFileSync} from 'node:fs';
import {createStructuredChat} from '../src/structured-chat.mjs';
import {analysisMessages,analysisSchema,validAnalysis} from '../src/analysis.mjs';
const key=readFileSync('/run/secrets/provider_test_key','utf8').trim();
const groups=[{id:'11111111-1111-4111-8111-111111111111',name:'With a meal',description:''}];
try{
 const {result,model}=await createStructuredChat()({key,model:'grok-4.7',messages:analysisMessages({name:'NOW Foods C-1000 vitamin C',groups,language:'en'}),schema:analysisSchema(groups),validate:value=>validAnalysis(value,groups),maxTokens:2400});
 console.log(JSON.stringify({providerCheck:'passed',identified:result.identified,model,schemaVersion:result.schemaVersion}));
}catch(error){console.error('Provider check failed:',error.code||'internal');process.exitCode=1;}
