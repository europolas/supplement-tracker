/** Supplement-owned explicit draft. Closing/discarding never writes. Polling must
 * not replace an editing native picker. Owner reset invalidates late save results;
 * revision conflicts retain the draft and require an explicit reload/cancel.
 */
import {element} from './modules/ui.js';
import {normalizeIntakePlan} from './modules/intake-plan.js';
export function createIntakeEditor({i18n,icon,save,today}){
 let root=null,target=null,latest=null,changed=false,busy=false,epoch=0,opened=false;
 const t=(key,values)=>i18n.t(key,values),node=(tag,text,cls)=>element(tag,{text,className:cls});
 const input=(name,type,value)=>element('input',{attributes:{name,type,value:String(value??'')}});
 function mount(item,{force=false,message=''}={}){
  latest=item;
  if(!force&&root&&target?.id===item.id&&(changed||busy))return root;
  if(target?.id!==item.id){epoch++;opened=false;}
  target=item;changed=false;busy=false;
  const p=item.intake_plan||{version:1,mode:'daily',times:[],quantity:1,unit:'capsule'},form=element('form',{className:'intake-form',attributes:{'data-intake-form':''}});
  root=element('details',{className:'intake-settings'});root.open=opened;
  const summary=element('summary');summary.append(icon('clock'),node('span',t('appIntakeTitle')),icon('chevron'));root.append(summary,form);root.addEventListener('toggle',()=>opened=root.open);
  const label=(title,control,parent=form)=>{const l=element('label');l.append(node('span',t(title)),control);parent.append(l);return l;};
  const select=(name,choices,value)=>{const s=element('select',{attributes:{name}});for(const [v,text]of choices)s.append(element('option',{text,attributes:{value:String(v)}}));s.value=String(value);return s;};
  const numeric=(name,low,high,value)=>select(name,Array.from({length:high-low+1},(_,n)=>[n+low,String(n+low)]),value);
  form.append(node('h3',t('appIntakeSchedule')));
  const mode=select('mode',['daily','weekdays','interval'].map(v=>[v,t('appIntakeMode_'+v)]),p.mode);label('appIntakeFrequency',mode);
  const weekdays=element('div',{className:'intake-weekdays',attributes:{role:'group','aria-label':t('appIntakeDays')}}),selected=new Set(p.weekdays||[1,2,3,4,5]);
  for(let d=1;d<=7;d++){const b=element('button',{text:new Intl.DateTimeFormat(i18n.language,{weekday:'short',timeZone:'UTC'}).format(new Date(Date.UTC(2026,9,11+d))),attributes:{type:'button','data-weekday':d,'aria-pressed':String(selected.has(d))}});b.addEventListener('click',()=>{selected.has(d)?selected.delete(d):selected.add(d);b.setAttribute('aria-pressed',String(selected.has(d)));changed=true;});weekdays.append(b);}form.append(weekdays);
  const intervalBox=element('div',{className:'intake-pair intake-interval'}),interval=numeric('intervalDays',2,90,p.intervalDays||2),start=input('startDate','date',p.startDate||today());label('appIntakeEveryDays',interval,intervalBox);label('appIntakeStart',start,intervalBox);form.append(intervalBox);
  const count=select('count',Array.from({length:6},(_,i)=>[i+1,t('appIntakeTimesCount',{count:i+1})]),p.times.length||1);label('appIntakeDailyTimes',count);
  const exact=input('exact','checkbox','on');exact.checked=p.times.length>0;const exactLabel=label('appIntakeSetTimes',exact);exactLabel.className='intake-check';
  const times=element('div',{className:'intake-times'});form.append(times);
  const renderTimes=()=>{const previous=[...times.querySelectorAll('input')].map(n=>n.value),n=Number(count.value);times.replaceChildren();exactLabel.hidden=n>1;times.hidden=n===1&&!exact.checked;if(times.hidden)return;for(let i=0;i<n;i++){const c=input('time'+i,'time',previous[i]||p.times[i]||['08:00','12:00','16:00','19:00','21:00','22:00'][i]);c.required=true;label('appIntakeTime',c,times);}};
  const toggle=()=>{weekdays.hidden=mode.value!=='weekdays';intervalBox.hidden=mode.value!=='interval';start.required=mode.value==='interval';renderTimes();};mode.addEventListener('change',toggle);count.addEventListener('change',renderTimes);exact.addEventListener('change',renderTimes);toggle();
  const amount=element('div',{className:'intake-pair'}),quantity=numeric('quantity',1,100,p.quantity),unit=select('unit',['capsule','tablet','softgel','drop','scoop','ml','unit'].map(v=>[v,t('appIntakeUnit_'+v)]),p.unit);label('appIntakeQuantity',quantity,amount);label('appIntakeUnit',unit,amount);form.append(amount,node('p',t('appIntakeManualDose'),'form-help'));
  form.append(node('h3',t('appIntakeStock')));
  const tracking=input('tracking','checkbox','on');tracking.checked=item.stock_remaining!==null&&item.stock_remaining!==undefined;const trackLabel=label('appIntakeTrackStock',tracking);trackLabel.className='intake-check';
  const stockBox=element('div',{className:'intake-pair'}),remaining=input('remaining','number',item.stock_remaining??0),threshold=input('threshold','number',item.stock_threshold??7);
  for(const c of [remaining,threshold])for(const[k,v]of Object.entries({min:0,max:1000000,step:1,inputmode:'numeric'}))c.setAttribute(k,v);
  label('appIntakeRemaining',remaining,stockBox);label('appIntakeThreshold',threshold,stockBox);form.append(stockBox,node('p',t('appIntakeStockHelp'),'form-help'));
  const stockToggle=()=>{stockBox.hidden=!tracking.checked;remaining.required=tracking.checked;threshold.required=tracking.checked;};tracking.addEventListener('change',stockToggle);stockToggle();
  if(tracking.checked&&item.stock_remaining<=Number(item.stock_threshold||0))form.append(node('p',t('appIntakeLowStock',{count:item.stock_remaining}),'intake-warning'));
  const status=node('p',message,'form-help');status.setAttribute('role','status');form.append(status);
  const actions=element('div',{className:'intake-actions'}),cancel=element('button',{text:t('Cancel'),className:'secondary',attributes:{type:'button'}}),submit=element('button',{text:t('save'),className:'primary',attributes:{type:'submit'}});
  cancel.addEventListener('click',()=>{if(busy)return;const old=root,next=mount(latest,{force:true});old.replaceWith(next);});actions.append(cancel,submit);form.append(actions);
  form.addEventListener('input',()=>changed=true);form.addEventListener('change',()=>changed=true);
  form.addEventListener('submit',async event=>{
   event.preventDefault();if(busy)return;const generation=epoch;let plan;
   try{plan=normalizeIntakePlan({version:1,mode:mode.value,weekdays:[...selected],intervalDays:Number(interval.value),startDate:start.value,times:times.hidden?[]:[...times.querySelectorAll('input')].map(n=>n.value),quantity:Number(quantity.value),unit:unit.value});}catch{status.textContent=t('INVALID_INTAKE_PLAN');status.className='status-error';return;}
   busy=true;form.setAttribute('aria-busy','true');for(const c of form.elements)c.disabled=true;
   try{const result=await save(item.id,{revision:item.intake_revision||0,plan,stock:{remaining:tracking.checked?Number(remaining.value):null,lowThreshold:Number(threshold.value)},timezone:Intl.DateTimeFormat().resolvedOptions().timeZone});if(generation!==epoch)return;
    const old=root,next=mount(result.item,{force:true,message:t(result.response.scheduleChanged&&result.response.effectiveDay>today()?'appIntakeSavedTomorrow':'appIntakeSaved')});old.replaceWith(next);
   }catch(error){if(generation!==epoch)return;status.textContent=i18n.message(error?.data?.error||error.message||'REQUEST_FAILED');status.className='status-error';}
   finally{if(generation===epoch){busy=false;form.removeAttribute('aria-busy');for(const c of form.elements)c.disabled=false;}}
  });
  return root;
 }
 return {mount,refresh(item){latest=item;},get dirty(){return changed;},get busy(){return busy;},isEditing:id=>target?.id===id&&(changed||busy),reset(){epoch++;root=null;target=null;changed=false;busy=false;opened=false;}};
}
