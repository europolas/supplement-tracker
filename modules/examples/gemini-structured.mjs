/** Bounded server-only Gemini generateContent transport. One HTTP request; no
 * retries, redirects, stored prompts or images. Search is opt-in per adapter and must be evidenced by grounding metadata.
 * The caller owns automatic/manual research policy.
 */
import {ProviderError} from '../server/structured-chat.mjs';
import {citationUrl} from '../server/structured-research.mjs';
export function createGeminiStructured({fetch:send=globalThis.fetch,timeout=90000,requireSearch=false,searchInstruction=null}={}){
 return async({key,model='gemini-3.8-flash',messages,schema,validate,maxTokens=6000,textOnly=false})=>{
  if(!/^[a-z0-9.-]+$/.test(model))throw new ProviderError('AI_INVALID_RESPONSE');
  const parts=content=>typeof content==='string'?[{text:content}]:content.map(p=>{
   if(p.type==='text')return {text:p.text};
   const match=/^data:image\/(jpeg|png);base64,([A-Za-z0-9+/]+=*)$/.exec(p.image_url?.url||'');
   if(!match)throw new ProviderError('AI_INVALID_RESPONSE');return {inlineData:{mimeType:'image/'+match[1],data:match[2]}};
  });
  const body={systemInstruction:{parts:messages.filter(m=>m.role==='system').flatMap(m=>parts(m.content))},contents:messages.filter(m=>m.role!=='system').map(m=>({role:m.role==='assistant'?'model':'user',parts:parts(m.content)})),generationConfig:{maxOutputTokens:maxTokens,thinkingConfig:{thinkingLevel:'LOW'},mediaResolution:'MEDIA_RESOLUTION_HIGH',responseMimeType:'application/json',responseJsonSchema:schema},...(requireSearch?{tools:[{google_search:{}}]}:{})};
  // Provider schema subset differs from server validation; enforce size limits locally.
  const cleanSchema=value=>Array.isArray(value)?value.map(cleanSchema):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([k])=>!['maxLength','minLength','maxItems','minItems'].includes(k)).map(([k,v])=>[k,cleanSchema(v)])):value;
  body.generationConfig.responseJsonSchema=cleanSchema(schema);
  if(textOnly){delete body.generationConfig.responseJsonSchema;delete body.generationConfig.responseMimeType;}
  if(requireSearch&&!textOnly){body.systemInstruction.parts.push({text:'Return only a JSON object matching this schema, without Markdown: '+JSON.stringify(body.generationConfig.responseJsonSchema)});delete body.generationConfig.responseJsonSchema;delete body.generationConfig.responseMimeType;}
  if(requireSearch)body.systemInstruction.parts.unshift({text:searchInstruction||'You MUST use the Google Search tool to look up the exact product before answering. Return grounded official product sources; do not answer from memory alone. References to web_search mean the available Google Search tool.'});
  const signal=AbortSignal.timeout(timeout);let response;
  try{response=await send('https://generativelanguage.googleapis.com/v1beta/models/'+model+':generateContent',{method:'POST',redirect:'error',signal,headers:{'x-goog-api-key':key,'Content-Type':'application/json'},body:JSON.stringify(body)});}catch{throw new ProviderError('AI_CONNECTION_FAILED');}
  if(!response.ok){await response.body?.cancel();throw new ProviderError([401,403].includes(response.status)?'AI_KEY_REJECTED':response.status===429?'AI_RATE_LIMITED':'AI_PROVIDER_FAILED');}
  let data,result;const reader=response.body.getReader(),chunks=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>512*1024){await reader.cancel();throw new ProviderError('AI_INVALID_RESPONSE');}chunks.push(value);}}catch(e){throw e instanceof ProviderError?e:new ProviderError('AI_CONNECTION_FAILED');}
  try{data=JSON.parse(Buffer.concat(chunks).toString());const c=data.candidates?.[0];if(c?.finishReason!=='STOP')throw Error();const text=c.content.parts.filter(p=>p.text&&!p.thought).map(p=>p.text).join('');result=textOnly?{text}:JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g,''));if(validate(result)!==true)throw Error();}catch{throw new ProviderError('AI_INVALID_RESPONSE');}
  const grounding=data.candidates[0].groundingMetadata,urls=new Set(),citationTitles={},citationAliases={};
  for(const chunk of grounding?.groundingChunks||[]){const url=citationUrl(chunk.web?.uri);if(!url)continue;urls.add(url);citationTitles[url]=String(chunk.web?.title||'').slice(0,250);
   // Google may return opaque grounding redirects. Resolve only Google's own
   // proxy, with no follow to an arbitrary destination; retain encountered URLs.
   if(new URL(url).hostname==='vertexaisearch.cloud.google.com')try{const r=await send(url,{redirect:'manual',signal});const target=citationUrl(r.headers.get('location'));await r.body?.cancel();if(target){urls.add(target);citationTitles[target]=citationTitles[url];citationAliases[url]=target;}}catch{ /* No invented citation when resolution fails. */ }
  }
  const searches=grounding?.webSearchQueries?.length||0;if(requireSearch&&(!searches||!urls.size))throw new ProviderError('AI_RESEARCH_FAILED');
  return {result,model:data.modelVersion||model,citations:[...urls],citationTitles,citationAliases,searches,usage:{inputTokens:data.usageMetadata?.promptTokenCount,outputTokens:data.usageMetadata?.candidatesTokenCount,thinkingTokens:data.usageMetadata?.thoughtsTokenCount}};
 };
}
