/** Durable report reader/generator. Refresh/open never generate. Failed refreshes
 * keep the last report. Host API persists jobs/decisions and performs consent checks.
 * Closing stops reads only; it cannot cancel a running server/paid operation.
 */
import {element} from './ui.js';
import {createProgress} from './mobile-ui.js';
import {createI18n} from './i18n.js';
export function createReportView({root,read,generate,i18n=createI18n(),sections={},interval=1200,onProposals=()=>{}}){
 let data=null,epoch=0,controller,timer,active=false,busy=false,error='';
 function render(){root.replaceChildren();if(busy||data?.active){const p=element('div',{},root.ownerDocument);createProgress(p).update({busy:true,label:i18n.t('kitGenerating')});root.append(p);}if(data?.report){if(data.report.stale)root.append(element('p',{text:i18n.t('kitReportStale'),className:'kit-warning',attributes:{role:'status'}},root.ownerDocument));for(const [key,text]of Object.entries(data.report.sections||{})){const card=element('section',{className:'kit-card'},root.ownerDocument);card.append(element('h3',{text:sections[key]||key},root.ownerDocument),element('p',{text},root.ownerDocument));root.append(card);}onProposals(data.report.proposals||[]);}else root.append(element('p',{text:i18n.t(data?.ready===false?'kitReportIncomplete':'kitReportIntro')},root.ownerDocument));if(error||data?.error)root.append(element('p',{text:error||i18n.message(data.error),attributes:{role:'alert'}},root.ownerDocument));const b=element('button',{text:i18n.t(data?.report?'kitRegenerate':'kitGenerate'),className:'primary',attributes:{type:'button'}},root.ownerDocument);b.disabled=busy||Boolean(data?.active)||data?.ready===false;b.addEventListener('click',()=>void start());root.append(b);}
 async function refresh(){if(!active)return;const version=++epoch;clearTimeout(timer);controller?.abort();controller=new AbortController();try{const result=await read({signal:controller.signal});if(version!==epoch)return;data=result;error='';render();if(data.active)timer=setTimeout(()=>void refresh(),interval);}catch(e){if(version===epoch&&e.name!=='AbortError'){error=i18n.message(e.message);render();}}}
 async function start(){if(busy||data?.active)return;const version=epoch;busy=true;error='';render();try{await generate();if(version!==epoch)return;busy=false;await refresh();}catch(e){if(version===epoch)error=i18n.message(e.message);}finally{if(version===epoch){busy=false;if(active)render();}}}
 return {open(){active=true;return refresh();},refresh,get busy(){return busy||Boolean(data?.active);},close(){active=false;epoch++;controller?.abort();clearTimeout(timer);},reset(){this.close();busy=false;data=null;error='';root.replaceChildren();onProposals([]);},destroy(){this.reset();}};
}
