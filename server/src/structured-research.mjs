/** Server-only xAI Responses research adapter. Web search is mandatory and checked
 * in returned tool metadata, not inferred from prose. Citations attest encountered
 * URLs, not truth/medical validity. Caller validates every domain claim and schema.
 * No automatic retries/storage/redirects; errors never expose provider bodies/keys.
 * maxTurns bounds agent turns (not individual billable tool invocations).
 */
import {ProviderError} from './structured-chat.mjs';
export function citationUrl(value){
 try{const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||url.port&&url.port!=='443'||url.hostname==='localhost'||/^(?:\d+\.){3}\d+$/.test(url.hostname)||url.hostname.includes(':')||!url.hostname.includes('.'))return null;url.hash='';return url.href.replace(/\/$/,'');}catch{return null;}
}
export function createStructuredResearch({baseUrl='https://api.x.ai/v1',fetch:send=globalThis.fetch,timeout=300000,maxTurns=4,reasoningEffort='low'}={}){
 const base=new URL(baseUrl);if(base.protocol!=='https:'||base.username||base.password||base.hash||base.search)throw TypeError('Invalid provider URL');
 return async({key,model,messages,schema,validate,name='research_response',maxTokens=6000})=>{
  const input=messages.map(message=>({role:message.role,content:typeof message.content==='string'?message.content:message.content.map(part=>part.type==='image_url'?{type:'input_image',image_url:part.image_url.url,detail:'high'}:{type:'input_text',text:part.text})}));
  let response;
  try{response=await send(base.href.replace(/\/$/,'')+'/responses',{method:'POST',redirect:'error',signal:AbortSignal.timeout(timeout),headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({model,input,store:false,reasoning:{effort:reasoningEffort},max_output_tokens:maxTokens,max_turns:maxTurns,parallel_tool_calls:false,tool_choice:'required',tools:[{type:'web_search'}],include:['no_inline_citations','web_search_call.action.sources'],text:{format:{type:'json_schema',name,strict:true,schema}}})});}
  catch{throw new ProviderError('AI_CONNECTION_FAILED');}
  if(!response.ok){await response.body?.cancel();throw new ProviderError(response.status===401||response.status===403?'AI_KEY_REJECTED':response.status===429?'AI_RATE_LIMITED':'AI_PROVIDER_FAILED');}
  const chunks=[];let size=0;const reader=response.body.getReader();
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>512*1024){await reader.cancel();throw new ProviderError('AI_INVALID_RESPONSE');}chunks.push(value);}}
  catch(error){if(error instanceof ProviderError)throw error;throw new ProviderError('AI_CONNECTION_FAILED');}
  let data,result;
  try{
   data=JSON.parse(Buffer.concat(chunks).toString('utf8'));
   if(data.status!=='completed'||data.error)throw Error();
   const messages=data.output.filter(item=>item.type==='message'&&item.role==='assistant');
   const parts=messages.flatMap(item=>item.content||[]);if(parts.some(p=>p.type==='refusal'))throw Error();
   const text=parts.filter(p=>p.type==='output_text').map(p=>p.text).join('');result=JSON.parse(text);if(validate(result)!==true)throw Error();
  }catch{throw new ProviderError('AI_INVALID_RESPONSE');}
  const searches=data.output.filter(item=>item.type==='web_search_call'&&item.status==='completed').length;
  if(!searches)throw new ProviderError('AI_RESEARCH_FAILED');
  const urls=new Set();const add=value=>{const url=citationUrl(value);if(url)urls.add(url);};
  for(const item of data.citations||[])add(typeof item==='string'?item:item.url);
  for(const item of data.output){for(const part of item.content||[])for(const annotation of part.annotations||[])if(annotation.type==='url_citation')add(annotation.url);for(const source of item.action?.sources||[])add(source.url);}
  if(!urls.size)throw new ProviderError('AI_RESEARCH_FAILED');
  return {result,model:data.model||model,citations:[...urls],searches};
 };
}
