'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {EventEmitter}=require('node:events');
const {attachMediaDiagnostics,installBrowserCapture,mediaRoute,mime,bounded,REPORT_TIMEOUT_MS}=require('./browser/media-diagnostics');
const origin='http://127.0.0.1:19887',secret='PRIVATE_TOKEN_MUST_NEVER_APPEAR';
function browser(){
 const listeners={};
 class Hls{
  static Events={ERROR:'hlsError'};
  static isSupported(){return true;}
  constructor(config){this.config=config;this.listeners={};}
  on(event,callback){this.listeners[event]=callback;}
 }
 const window={Hls,MediaSource:{isTypeSupported:()=>true}};
 vm.runInNewContext('('+installBrowserCapture.toString()+')()',{window,document:{addEventListener:(event,callback)=>{listeners[event]=callback}}});
 return {window,listeners,Hls,state:window.__vmsMediaDiagnostics};
}
test('media URL parsing exports only known route and fixture, never credentials or paths',()=>{
 for(const [tail,expected] of [['hls/group/fixture1/s.m3u8',{monitor:'fixture1',kind:'playlist'}],['hls/group/fixture2/'+secret+'.ts',{monitor:'fixture2',kind:'segment'}],['videos/group/fixture1/'+secret+'.mp4',{monitor:'fixture1',kind:'recording'}]]){
  const result=mediaRoute(`${origin}/${secret}/${tail}?secret=${secret}`,origin);
  assert.deepEqual(result,expected);assert.ok(!JSON.stringify(result).includes(secret));
 }
 for(const url of [`https://foreign.invalid/${secret}/hls/group/fixture1/s.m3u8`,`${origin}/${secret}/hls/group/${secret}/s.m3u8`,secret,`${origin}/${secret}/login`])assert.equal(mediaRoute(url,origin),null);
});
test('MIME and numeric fields are allowlisted and bounded',()=>{
 assert.equal(mime('Video/MP4; secret='+secret),'video/mp4');assert.equal(mime(secret),'other');
 assert.equal(bounded(Infinity,4),null);assert.equal(bounded(secret,4),null);assert.equal(bounded(-1,4),null);assert.equal(bounded(999,4),4);
});
test('browser CSP and media events omit URLs, messages and unexpected fields',()=>{
 const {state,listeners}=browser();
 listeners.securitypolicyviolation({effectiveDirective:'worker-src',blockedURI:'blob:'+secret,originalPolicy:secret,sourceFile:secret});
 listeners.securitypolicyviolation({effectiveDirective:secret,blockedURI:secret});
 listeners.error({target:{tagName:'VIDEO',closest:()=>({getAttribute:()=>secret}),error:{code:3,message:secret}}});
 const snapshot=JSON.parse(JSON.stringify(state.snapshot()));
 assert.deepEqual(snapshot.events,[{kind:'csp',directive:'worker-src',blocked:'blob'},{kind:'csp',directive:'other',blocked:'other'},{kind:'media',monitor:'other',code:3}]);
 assert.ok(!JSON.stringify(snapshot).includes(secret));
});
test('HLS observer preserves constructor, arguments, prototype and static behavior',()=>{
 const {window,Hls,state}=browser(),config={enableWorker:true};state.armHls();const wrapped=window.Hls;state.armHls();assert.equal(window.Hls,wrapped);
 const player=new window.Hls(config);assert.ok(player instanceof Hls);assert.ok(player instanceof window.Hls);assert.equal(player.config,config);assert.equal(window.Hls.Events,Hls.Events);assert.equal(window.Hls.isSupported(),true);
 player.media={closest:()=>({getAttribute:()=> 'fixture2'})};
 player.listeners.hlsError('ignored',{type:'otherError',details:'internalException',fatal:true,event:'demuxerWorker',err:{message:secret},url:secret});
 player.listeners.hlsError('ignored',{type:secret,details:secret,event:secret});
 const snapshot=JSON.parse(JSON.stringify(state.snapshot()));
 assert.deepEqual(snapshot.events[0],{kind:'hls',monitor:'fixture2',type:'otherError',detail:'internalException',fatal:true,event:'demuxerWorker'});
 assert.equal(snapshot.events[1].type,'other');assert.ok(!JSON.stringify(snapshot).includes(secret));
});
test('browser capture ring is bounded and reports dropped records',()=>{
 const {state,listeners}=browser();for(let i=0;i<100;i++)listeners.securitypolicyviolation({effectiveDirective:'worker-src',blockedURI:secret});
 assert.equal(state.snapshot().events.length,32);assert.equal(state.snapshot().dropped,68);
});
test('HLS observer failures do not change construction or donor exception behavior',()=>{
 const {window,state}=browser();class NoObserver{static Events={ERROR:'error'};on(){throw new Error(secret);}}
 window.Hls=NoObserver;state.armHls();assert.ok(new window.Hls() instanceof NoObserver);
 const second=browser(),failure=new Error('donor constructor failure');second.window.Hls=class{constructor(){throw failure;}};second.state.armHls();assert.throws(()=>new second.window.Hls(),error=>error===failure);
});
class Page extends EventEmitter{
 async addInitScript(fn){this.init=fn;}
 async evaluate(){return {events:[],dropped:0,hlsObserverArmed:true,hlsSupported:true,h264Supported:true};}
}
function request(index=0){return {
 url:()=>`${origin}/${secret}/hls/group/fixture1/${index}.ts`,
 response:async()=>({status:()=>200,headerValue:async()=> 'video/mp2t; token='+secret,body:()=>{throw new Error('Media body must never be read');}}),
 sizes:async()=>({responseBodySize:999999999,requestHeadersSize:secret})
};}
test('network logs contain only safe metadata and never read media bodies',async()=>{
 const page=new Page(),lines=[],diagnostics=await attachMediaDiagnostics(page,origin,line=>lines.push(line));
 page.emit('requestfinished',request());page.emit('pageerror',new Error(secret));page.emit('requestfailed',request(1));
 await diagnostics.report('fixture1','live',{evaluate:async fn=>fn({readyState:0,networkState:2,videoWidth:0,videoHeight:0,currentTime:0,duration:Infinity,paused:true,ended:false,error:{code:4,message:secret},currentSrc:'blob:'+secret})});
 assert.equal(lines.length,1);assert.ok(!lines[0].includes(secret));
 const report=JSON.parse(lines[0].split('VMS_MEDIA_DIAGNOSTIC ')[1]);
 assert.equal(report.video.error,4);assert.equal(report.video.source,'blob');assert.equal(report.video.duration,null);assert.equal(report.network.find(x=>x.status===200).bytes,16*1024*1024);assert.deepEqual(report.pageErrors,['javascript-error']);
 diagnostics.dispose();assert.equal(page.listenerCount('pageerror'),0);assert.equal(page.listenerCount('requestfinished'),0);assert.equal(page.listenerCount('requestfailed'),0);
});
test('network buffer remains bounded and keeps the latest monitor evidence',async()=>{
 const page=new Page(),lines=[],diagnostics=await attachMediaDiagnostics(page,origin,line=>lines.push(line));
 for(let i=0;i<100;i++)page.emit('requestfailed',request(i));
 await diagnostics.report(secret,secret,{evaluate:async()=>({})});
 const report=JSON.parse(lines[0].split('VMS_MEDIA_DIAGNOSTIC ')[1]);assert.equal(report.network.length,32);assert.equal(report.networkDropped,68);assert.equal(report.monitor,'unknown');assert.equal(report.phase,'unknown');assert.ok(!lines[0].includes(secret));diagnostics.dispose();
});
test('capture or logging failure cannot replace the original readiness error',async()=>{
 const page=new Page();page.evaluate=async()=>{throw new Error(secret)};
 const diagnostics=await attachMediaDiagnostics(page,origin,()=>{throw new Error(secret)});
 const original=new Error('original readiness failure');
 await assert.rejects(async()=>{try{throw original;}finally{await diagnostics.report('fixture2','live',{});}},error=>error===original);
 diagnostics.dispose();
});
for(const stage of ['page','video'])test(`never-settling ${stage} evaluation cannot mask the readiness failure`,{timeout:REPORT_TIMEOUT_MS+2000},async()=>{
 const page=new Page(),lines=[],never=()=>new Promise(()=>{});
 if(stage==='page')page.evaluate=never;
 const diagnostics=await attachMediaDiagnostics(page,origin,line=>lines.push(line));
 const original=new Error('original readiness failure'),start=performance.now();
 try{
  await assert.rejects(async()=>{try{throw original;}finally{await diagnostics.report('fixture2','live',{evaluate:never});}},error=>error===original);
  assert.ok(performance.now()-start<REPORT_TIMEOUT_MS+1000);
  assert.equal(lines.length,1);
  assert.deepEqual(JSON.parse(lines[0].split('VMS_MEDIA_DIAGNOSTIC ')[1]),{monitor:'fixture2',phase:'live',result:'capture-timeout'});
 }finally{diagnostics.dispose();}
});
for(const outcome of ['completion','rejection'])test(`late renderer ${outcome} cannot replace the original failure or emit after timeout`,{timeout:REPORT_TIMEOUT_MS+2000},async()=>{
 const page=new Page(),lines=[];let resolvePage,rejectPage,videoReads=0;
 page.evaluate=()=>new Promise((resolve,reject)=>{resolvePage=resolve;rejectPage=reject;});
 const diagnostics=await attachMediaDiagnostics(page,origin,line=>lines.push(line));
 const original=new Error('original readiness failure');
 await assert.rejects(async()=>{try{throw original;}finally{await diagnostics.report('fixture1','live',{evaluate:async()=>{videoReads++;return {};}});}},error=>error===original);
 if(outcome==='completion')resolvePage({events:[]});else rejectPage(new Error(secret));
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(videoReads,0);assert.equal(lines.length,1);diagnostics.dispose();
});
test('original readiness checks and diagnostic no-content contract remain intact',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const spec=fs.readFileSync(path.join(__dirname,'browser/original-ui.spec.js'),'utf8');
 assert.equal((spec.match(/video=>video\.readyState>=2&&video\.videoWidth>0/g)||[]).length,2);
 assert.equal((spec.match(/timeout:30000\}\)\.toBe\(true\)/g)||[]).length,2);
 const helper=fs.readFileSync(path.join(__dirname,'browser/media-diagnostics.js'),'utf8');
 assert.doesNotMatch(helper,/\.screenshot\(|\.body\(\)|testInfo\.attach\(/);
});
