/** Updates are automatic ONLY inside the bounded startup/loading-screen window.
 * finishStartup must run before revealing interactive UI. Later worker/other-tab
 * activations only announce a manual update; visibility/idle never reload the app.
 * canReload still guards every draft/job. Startup timeout also bounds blocked SW
 * registration. No first-install reload or implicit paid retries. See the guide.
 */
export async function setupPwa({url='./sw.js',navigator:nav=globalThis.navigator,window:win=globalThis.window,document:doc=globalThis.document,canReload=()=>true,autoUpdate=false,startupTimeout=4000,onUpdate=()=>{},onError=()=>{}}={}){
 if(!nav?.serviceWorker)return {supported:false,waitForStartup:async()=>{},finishStartup(){},destroy(){}};
 if(!Number.isFinite(startupTimeout)||startupTimeout<0||startupTimeout>30000)throw new TypeError('Invalid startup timeout');
 let registration,hadController=Boolean(nav.serviceWorker.controller),reloading=false,activated=false,activationRequested=false,destroyed=false,waitingWorker=null,manualRequested=false,startupOpen=autoUpdate&&startupTimeout>0,checking=false;
 const bindings=[],observed=new WeakSet();
 const listen=(target,name,fn)=>{target.addEventListener(name,fn);bindings.push(()=>target.removeEventListener(name,fn));};
 let registered,settled;const registrationReady=new Promise(resolve=>registered=resolve),startupReady=new Promise(resolve=>settled=resolve);
 let startupTimer,registrationTimer;
 function finishStartup(){startupOpen=false;clearTimeout(startupTimer);settled();}
 const eligible=()=>!destroyed&&!reloading&&startupOpen&&doc.visibilityState==='visible'&&nav.onLine!==false&&canReload();
 function requestActivation(manual){if(destroyed)return;if(!canReload())throw new Error('Save your changes first.');if(manual)manualRequested=true;if(registration?.waiting){if(!activationRequested){activationRequested=true;registration.waiting.postMessage({type:'ACTIVATE_UPDATE'});}}else if(nav.serviceWorker.controller&&!reloading){reloading=true;win.location.reload();settled();}}
 const apply=()=>requestActivation(true);
 const tryAutomatic=()=>{if(eligible()&&(activated||registration?.waiting))requestActivation(false);};
 const maybeSettle=()=>{if(!checking&&!activationRequested&&(!registration?.installing||['installed','activated','redundant'].includes(registration.installing.state)))settled();};
 function announce(){if(destroyed)return;if(registration?.waiting&&nav.serviceWorker.controller){if(waitingWorker!==registration.waiting){waitingWorker=registration.waiting;activationRequested=false;}onUpdate({apply,activated:false});tryAutomatic();}maybeSettle();}
 function observe(worker){if(!worker||observed.has(worker))return;observed.add(worker);listen(worker,'statechange',announce);}
 listen(nav.serviceWorker,'controllerchange',()=>{if(destroyed)return;if(hadController&&!reloading){activated=true;activationRequested=false;const permitted=manualRequested||eligible();manualRequested=false;if(canReload()&&permitted){reloading=true;win.location.reload();settled();}else onUpdate({apply,activated:true});}hadController=true;maybeSettle();});
 // Both timers start before registration. A blocked/offline registration cannot
 // trap the splash; a late result may announce but never reopen the launch gate.
 registrationTimer=setTimeout(()=>{finishStartup();registered();},startupTimeout);
 if(autoUpdate)startupTimer=setTimeout(()=>{finishStartup();registered();},startupTimeout);else settled();
 async function check(){if(destroyed||!registration||doc.visibilityState!=='visible'||nav.onLine===false){checking=false;maybeSettle();return;}checking=true;try{await registration.update();}catch(error){if(!destroyed)onError(error);}finally{checking=false;if(!destroyed){observe(registration.installing);announce();}}}
 void (async()=>{try{registration=await nav.serviceWorker.register(url,{type:'module',updateViaCache:'none'});clearTimeout(registrationTimer);if(destroyed)return;checking=true;listen(registration,'updatefound',()=>{observe(registration.installing);announce();});observe(registration.installing);announce();registered();if(startupOpen||!autoUpdate)void check();else{checking=false;maybeSettle();}}catch(error){clearTimeout(registrationTimer);if(!destroyed)onError(error);finishStartup();registered();}})();
 await registrationReady;
 return {supported:true,get registration(){return registration;},check,apply,waitForStartup:()=>startupReady,finishStartup,get updatePending(){return Boolean(activated||registration?.waiting);},destroy(){destroyed=true;clearTimeout(registrationTimer);finishStartup();bindings.forEach(remove=>remove());}};
}
