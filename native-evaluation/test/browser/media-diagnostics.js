'use strict';

// Diagnostic output is a bounded schema, never a URL, header dump or error message.
const LIMIT=32,MAX_BYTES=16*1024*1024,REPORT_TIMEOUT_MS=2000;
const monitor=value=>['fixture1','fixture2'].includes(value)?value:'unknown';
const bounded=(value,max)=>Number.isFinite(value)&&value>=0?Math.min(value,max):null;
const mime=value=>{
 const type=String(value||'').split(';',1)[0].trim().toLowerCase();
 return ['application/vnd.apple.mpegurl','application/x-mpegurl','video/mp2t','video/mp4','application/octet-stream','text/plain','text/html'].includes(type)?type:'other';
};
function mediaRoute(value,origin){
 try{
  const url=new URL(value);
  if(url.origin!==origin)return null;
  const parts=url.pathname.split('/');
  if(parts.length!==6||!['fixture1','fixture2'].includes(parts[4]))return null;
  if(parts[2]==='hls'&&parts[5]==='s.m3u8')return {monitor:parts[4],kind:'playlist'};
  if(parts[2]==='hls'&&/\.ts$/.test(parts[5]))return {monitor:parts[4],kind:'segment'};
  if(parts[2]==='videos'&&/\.mp4$/.test(parts[5]))return {monitor:parts[4],kind:'recording'};
 }catch{}
 return null;
}

// Serialized by Playwright; keep this self-contained and return only allowlisted data.
function installBrowserCapture(){
 const events=[];
 let dropped=0,armed=false;
 const allowed=(value,choices)=>choices.includes(value)?value:'other';
 const mid=element=>{
  const value=element?.closest?.('.monitor_item')?.getAttribute('mid');
  return allowed(value,['fixture1','fixture2']);
 };
 const push=value=>{if(events.length===32){events.shift();dropped=Math.min(dropped+1,100000);}events.push(value);};
 document.addEventListener('securitypolicyviolation',event=>push({kind:'csp',directive:allowed(event.effectiveDirective,['worker-src','child-src','script-src','script-src-elem','connect-src','media-src','default-src']),blocked:typeof event.blockedURI==='string'&&(event.blockedURI==='blob'||event.blockedURI.startsWith('blob:'))?'blob':'other'}));
 document.addEventListener('error',event=>{
  if(event.target?.tagName==='VIDEO')push({kind:'media',monitor:mid(event.target),code:[1,2,3,4].includes(event.target.error?.code)?event.target.error.code:null});
 },true);
 window.__vmsMediaDiagnostics={
  armHls(){
   if(armed||typeof window.Hls!=='function')return;
   const Hls=window.Hls;
   // Observe before loadSource/attachMedia, without changing config or error handling.
   window.Hls=new Proxy(Hls,{construct(target,args,newTarget){
    const player=Reflect.construct(target,args,newTarget);
    try{player.on(Hls.Events.ERROR,(_event,data)=>{try{data=data||{};push({kind:'hls',monitor:mid(player.media),type:allowed(data.type,['networkError','mediaError','otherError']),detail:allowed(data.details,['manifestLoadError','manifestLoadTimeOut','manifestParsingError','manifestIncompatibleCodecsError','levelLoadError','levelLoadTimeOut','fragLoadError','fragLoadTimeOut','fragParsingError','bufferAddCodecError','bufferAppendError','bufferAppendingError','bufferStalledError','internalException']),fatal:data.fatal===true,event:allowed(data.event,['demuxerWorker'])});}catch{push({kind:'hls-observer-unavailable'});}});}catch{push({kind:'hls-observer-unavailable'});}
    return player;
   }});
   armed=true;
  },
  snapshot(){
   let hlsSupported=null,h264Supported=null;
   try{hlsSupported=typeof window.Hls?.isSupported==='function'?window.Hls.isSupported()===true:null;}catch{}
   try{h264Supported=typeof window.MediaSource?.isTypeSupported==='function'?window.MediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E"')===true:null;}catch{}
   return {events:events.slice(),dropped,hlsObserverArmed:armed,hlsSupported,h264Supported};
  }
 };
}

async function attachMediaDiagnostics(page,origin,write=line=>console.log(line)){
 const network=[],faults=[],pending=new Set();
 let dropped=0;
 const push=value=>{if(network.length===LIMIT){network.shift();dropped=Math.min(dropped+1,100000);}network.push(value);};
 const emit=value=>{try{write(value);}catch{}};
 const onFault=()=>{if(faults.length<LIMIT)faults.push('javascript-error');};
 const onFinished=request=>{
  const route=mediaRoute(request.url(),origin);if(!route)return;
  if(pending.size>=LIMIT){dropped=Math.min(dropped+1,100000);return;}
  // Count transport bytes without reading or retaining any media content.
  const task=(async()=>{
   const response=await request.response();if(!response)return;
   const sizes=await request.sizes();
   push({...route,status:bounded(response.status(),599),mime:mime(await response.headerValue('content-type')),bytes:bounded(sizes.responseBodySize,MAX_BYTES)});
  })().catch(()=>push({...route,kind:route.kind,result:'metadata-unavailable'}));
  pending.add(task);task.finally(()=>pending.delete(task));
 };
 const onFailed=request=>{
  const route=mediaRoute(request.url(),origin);if(route)push({...route,result:'request-failed'});
 };
 page.on('pageerror',onFault);page.on('requestfinished',onFinished);page.on('requestfailed',onFailed);
 await page.addInitScript(installBrowserCapture);
 return {
  faults,
  async armHls(){await page.evaluate(()=>window.__vmsMediaDiagnostics?.armHls());},
  async report(id,phase,locator){
   // Bound the WHOLE report: renderer evaluation can ignore locator timeouts.
   // Only this outer scope emits, so late completion cannot log after teardown.
   const context={monitor:monitor(id),phase:['live','recording'].includes(phase)?phase:'unknown'};
   let expired=false,deadlineTimer;
   const capture=async()=>{
    let metadataTimer;
    try{await Promise.race([Promise.allSettled([...pending]),new Promise(resolve=>{metadataTimer=setTimeout(resolve,500);})]);}
    finally{clearTimeout(metadataTimer);}
    if(expired)return;
    const browser=await page.evaluate(()=>window.__vmsMediaDiagnostics?.snapshot()||{result:'unavailable'});
    if(expired)return;
    let video={result:'unavailable'};
    try{video=await locator.evaluate(element=>{
     const n=(value,max)=>Number.isFinite(value)&&value>=0?Math.min(value,max):null;
     return {readyState:n(element.readyState,4),networkState:n(element.networkState,3),width:n(element.videoWidth,16384),height:n(element.videoHeight,16384),currentTime:n(element.currentTime,86400),duration:n(element.duration,86400),paused:element.paused===true,ended:element.ended===true,error:[1,2,3,4].includes(element.error?.code)?element.error.code:null,source:element.currentSrc?.startsWith('blob:')?'blob':element.currentSrc?'other':'none'};
    },undefined,{timeout:1000});}catch{}
    if(expired)return;
    return {...context,video,browser,network:network.slice(),networkDropped:dropped,pageErrors:faults.slice()};
   };
   try{
    const deadline=new Promise(resolve=>{deadlineTimer=setTimeout(()=>{expired=true;resolve({...context,result:'capture-timeout'});},REPORT_TIMEOUT_MS);});
    const result=await Promise.race([capture(),deadline]);
    emit('VMS_MEDIA_DIAGNOSTIC '+JSON.stringify(result));
   }catch{emit('VMS_MEDIA_DIAGNOSTIC '+JSON.stringify({...context,result:'capture-unavailable'}));}
   finally{expired=true;clearTimeout(deadlineTimer);}
  },
  dispose(){page.off('pageerror',onFault);page.off('requestfinished',onFinished);page.off('requestfailed',onFailed);}
 };
}
module.exports={attachMediaDiagnostics,installBrowserCapture,mediaRoute,mime,bounded,REPORT_TIMEOUT_MS};
