'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const assert=require('node:assert/strict');
const {spawn,execFileSync}=require('node:child_process');
const {launch,binaries,openDb,all,closeDb}=require('./launcher');
const nativeFetch=global.fetch;
const fetch=(url,options={})=>nativeFetch(url,{...options,signal:AbortSignal.timeout(10000)});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,label,timeout=35000){const end=Date.now()+timeout;let last;while(Date.now()<end){try{const value=await fn();if(value)return value;}catch(err){last=err;}await delay(500)}throw new Error(`Timed out: ${label}${last?' ('+last.message+')':''}`)}
async function main(){
 const data=fs.mkdtempSync(path.join(os.tmpdir(),'bastard evaluation é smoke-'));
 const credentials={mail:'evaluation@localhost',password:crypto.randomBytes(24).toString('base64url')};
 const bin=binaries();
 const sentinel=spawn(bin.ffmpeg,['-hide_banner','-loglevel','error','-re','-f','lavfi','-i','color=size=16x16:rate=1','-f','null','-'],{stdio:['pipe','ignore','ignore']});
 let instance,socket;
 try{
   const options={data,credentials,demo:true,port:18787};
   instance=await launch(options);
   assert.equal(sentinel.exitCode,null);
   const login=await fetch(instance.url);assert.equal(login.status,200);assert.match(await login.text(),/Shinobi|SharpAI|DeepCamera/i);console.log('PASS: original login page served');
   for(const blocked of ['/super','/ADMIN/','/none/configureMonitor/none/fixture3','/none/CONFIGUREMONITOR/none/fixture3/','/none/probe/none','/none/PROBE/none/','/none/videos/none/fixture1/test.mp4/%64elete','/none/videos/none/fixture1/test.mp4/%66ix','/none/videos/none/fixture1/test.mp4/%73tatus'])assert.equal((await fetch(instance.url+blocked)).status,403);
   const browserClient=await (await fetch(instance.url+'/libs/js/socket.io.js')).text();assert.match(browserClient,/Socket.IO v2.5.0/);
   const signIn=async()=>{
    const response=await fetch(instance.url+'/?json=true',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({mail:credentials.mail,pass:credentials.password,function:'dashboard'})});
    const body=await response.json();assert.equal(body.ok,true);const user=body.$user;assert.ok(user.auth_token);return user;
   };
   let user=await signIn();const endpoint=p=>instance.url+'/'+user.auth_token+p;
   const dashboard=await fetch(instance.url,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({mail:credentials.mail,pass:credentials.password,function:'dashboard'})});
   const html=await dashboard.text();assert.match(html,/monitor="edit"/);assert.match(html,/monitor="powerview"/);assert.ok(html.length>50000);user=await signIn();console.log('PASS: original dashboard rendered with monitor and playback controls');
   assert.equal((await fetch(instance.url,{headers:{Origin:'https://untrusted.example'}})).status,403);
   const badHost=await new Promise((resolve,reject)=>{require('node:http').get(instance.url,{headers:{host:'untrusted.example'}},r=>{r.resume();resolve(r.statusCode)}).on('error',reject)});assert.equal(badHost,403);
   const io=require('socket.io-client');
   socket=io(instance.url,{reconnection:false});
   await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Dashboard Socket.IO initialization timed out')),10000);socket.on('connect',()=>socket.emit('f',{f:'init',auth:user.auth_token,ke:user.ke,uid:user.uid}));socket.on('f',message=>{if(message.f==='init_success'){clearTimeout(timer);resolve()}});socket.on('connect_error',()=>{clearTimeout(timer);reject(new Error('Dashboard Socket.IO connection rejected'))})});
   let foreignWatch=false;
   const foreignListener=message=>{if(message.f==='monitor_watch_on')foreignWatch=true};socket.on('f',foreignListener);
   socket.emit('f',{f:'monitor',ff:'watch_on',ke:'foreign-group',id:'fixture1'});await delay(300);assert.equal(foreignWatch,false);socket.removeListener('f',foreignListener);
   await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('Authorized watch command timed out')),5000);socket.on('f',message=>{if(message.f==='monitor_watch_on'&&message.id==='fixture1'){clearTimeout(timeout);resolve()}});socket.emit('f',{f:'monitor',ff:'watch_on',ke:user.ke,id:'fixture1'})});
   console.log('PASS: authenticated watch stays in its own account group');
   await until(()=>socket.io.engine.transport.name==='websocket','default polling to WebSocket upgrade');
   console.log('PASS: authenticated original dashboard default polling and WebSocket upgrade');
   socket.disconnect();socket=null;
   const monitors=await (await fetch(endpoint('/monitor/'+user.ke))).json();assert.equal(monitors.length,2);console.log('PASS: two generated monitors loaded');
   for(const mid of ['fixture1','fixture2']){
    const playlist=await until(async()=>{const response=await fetch(endpoint(`/hls/${user.ke}/${mid}/s.m3u8`));const body=await response.text();return response.ok&&body.includes('#EXTINF')?body:null},mid+' live HLS');
    const segment=playlist.split('\n').find(line=>line.endsWith('.ts'));const segmentResponse=await fetch(endpoint(`/hls/${user.ke}/${mid}/${segment}`));assert.equal(segmentResponse.status,200);assert.ok((await segmentResponse.arrayBuffer()).byteLength>100);console.log(`PASS: ${mid} live playlist and media segment`);
   }
   const videos=await until(async()=>{const result=await (await fetch(endpoint('/videos/'+user.ke))).json();return ['fixture1','fixture2'].every(mid=>result.videos.some(v=>v.mid===mid&&v.status===1&&v.size>0))?result.videos:null},'both recorded clips',45000);
   const decodedHashes=[];const originalClips=videos.filter(v=>v.status===1).map(v=>v.mid+':'+v.time);
   for(const mid of ['fixture1','fixture2']){
    const video=videos.find(v=>v.mid===mid&&v.status===1&&v.size>0);const response=await fetch(instance.url+video.href,{headers:{range:'bytes=0-1023'}});assert.equal(response.status,206);assert.ok((await response.arrayBuffer()).byteLength>0);assert.match(response.headers.get('content-type'),/mp4/);console.log(`PASS: ${mid} recorded clip plays through authenticated HTTP range endpoint`);
    const file=path.join(data,'videos',user.ke,mid,path.basename(video.href));const probe=JSON.parse(execFileSync(bin.ffprobe,['-v','error','-show_streams','-show_format','-of','json',file],{encoding:'utf8'}));assert.equal(probe.streams[0].codec_name,'h264');assert.ok(Number(probe.format.duration)>0);
    const served=await fetch(instance.url+video.href);assert.equal(served.status,200);const exported=path.join(data,mid+'-served.mp4');fs.writeFileSync(exported,Buffer.from(await served.arrayBuffer()));
    const hash=execFileSync(bin.ffmpeg,['-hide_banner','-loglevel','error','-i',exported,'-frames:v','1','-f','hash','-hash','sha256','pipe:1'],{encoding:'utf8'}).trim();assert.match(hash,/SHA256=/);decodedHashes.push(hash);console.log(`PASS: ${mid} served recording frame decoded`);
   }
   assert.notEqual(decodedHashes[0],decodedHashes[1]);console.log('PASS: two recorded feeds have distinct decoded image content');
   const playlist2=async()=>await (await fetch(endpoint(`/hls/${user.ke}/fixture2/s.m3u8`))).text();
   const before=await playlist2();
   const stopped=await (await fetch(endpoint(`/monitor/${user.ke}/fixture1/stop`))).json();assert.equal(stopped.ok,true);
   await until(()=>instance.ownedPids.size===1,'fixture1 owned process stopped');
   await until(async()=>{const after=await playlist2();return after.includes('#EXTINF')&&after!==before},'fixture2 continues while fixture1 is stopped');
   assert.equal((await (await fetch(endpoint(`/monitor/${user.ke}/fixture1/record`))).json()).ok,true);
   await until(()=>instance.ownedPids.size===2,'fixture1 resumes');
   console.log('PASS: stopping and restarting fixture1 leaves fixture2 live');
   const owned=[...instance.ownedPids];assert.ok(owned.length>=2);await instance.stop();instance=null;await until(()=>owned.every(pid=>{try{process.kill(pid,0);return false}catch{return true}}),'owned FFmpeg exit',5000);assert.equal(sentinel.exitCode,null);console.log('PASS: owned FFmpeg processes exited and unrelated FFmpeg survived');
   instance=await launch(options);user=await signIn();const persisted=await (await fetch(endpoint('/monitor/'+user.ke))).json();assert.equal(persisted.length,2);
   const restored=await (await fetch(endpoint('/videos/'+user.ke))).json();assert.ok(restored.videos.length>=2);assert.ok(originalClips.every(key=>restored.videos.some(v=>v.mid+':'+v.time===key)));
   await until(async()=>{const r=await fetch(endpoint(`/hls/${user.ke}/fixture1/s.m3u8`));return r.ok&&(await r.text()).includes('#EXTINF')},'live stream after restart');console.log('PASS: restart retained monitors and recordings and resumed live stream');
   await instance.stop();instance=null;assert.equal(sentinel.exitCode,null);
   const db=await openDb(path.join(data,'shinobi.sqlite'));const rows=await all(db,'SELECT count(*) AS count FROM Videos WHERE status=1');await closeDb(db);console.log(`PASS: ${rows[0].count} completed recording rows persisted`);
   console.log('PASS: original interface local evaluation smoke');
 }catch(err){if(instance)console.error(instance.getOutput());throw err;}
 finally{if(socket)socket.disconnect();if(instance)await instance.stop();sentinel.stdin.write('q\n');await delay(500);if(sentinel.exitCode===null)sentinel.kill();fs.rmSync(data,{recursive:true,force:true});}
}
main().catch(err=>{console.error(err.message);process.exitCode=1});
