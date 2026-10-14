/** Server-side, stateless xAI-compatible structured chat example. No automatic retries:
 * a retry can incur a second bill. Supply schema AND local validator; reject truncation,
 * refusals, malformed responses and untrusted endpoint redirects. Never log provider bodies/keys.
 */
export class ProviderError extends Error { constructor(code) { super(code);this.code=code; } }
export function createStructuredChat({ baseUrl='https://api.x.ai/v1', fetch:send=globalThis.fetch, timeout=85000 }={}) {
  const base=new URL(baseUrl);if(base.protocol!=='https:' || base.username || base.password || base.search || base.hash)throw new TypeError('Invalid provider URL');
  return async ({key,model,messages,schema,validate,name='structured_response',maxTokens=2400}) => {
    let response;
    try {
      response=await send(base.href.replace(/\/$/,'')+'/chat/completions',{
        method:'POST',redirect:'error',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},
        signal:AbortSignal.timeout(timeout),body:JSON.stringify({model,messages,store:false,max_tokens:maxTokens,
          response_format:{type:'json_schema',json_schema:{name,strict:true,schema}}})
      });
    }catch{throw new ProviderError('AI_CONNECTION_FAILED');}
    if(!response.ok){await response.body?.cancel();throw new ProviderError(response.status===401||response.status===403?'AI_KEY_REJECTED':response.status===429?'AI_RATE_LIMITED':'AI_PROVIDER_FAILED');}
    const reader=response.body.getReader();let size=0;const chunks=[];
    try {while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>256*1024){await reader.cancel();throw new ProviderError('AI_INVALID_RESPONSE');}chunks.push(value);}}
    catch(error){if(error instanceof ProviderError)throw error;throw new ProviderError('AI_CONNECTION_FAILED');}
    let data,result;
    try {
      data=JSON.parse(Buffer.concat(chunks).toString('utf8'));const choice=data.choices?.[0];
      if(choice?.finish_reason!=='stop'||choice.message?.refusal||typeof choice.message?.content!=='string')throw Error();
      result=JSON.parse(choice.message.content);if(validate(result)!==true)throw Error();
    }catch{throw new ProviderError('AI_INVALID_RESPONSE');}
    return {result,model:data.model||model};
  };
}
