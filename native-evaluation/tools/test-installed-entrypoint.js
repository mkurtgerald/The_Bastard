'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {spawn,execFileSync}=require('node:child_process');
const installed=path.resolve(process.argv[2] || '');
if(process.platform!=='win32' || !fs.existsSync(path.join(installed,'START-EVALUATION.cmd')))throw new Error('Pass the fresh Windows installation directory');
const {initialize}=require(path.join(installed,'native-evaluation','launcher.js'));
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function main(){
 const data=fs.mkdtempSync(path.join(os.tmpdir(),'Bastard installed entry é '));
 const credentials={mail:'installed-test@localhost',password:crypto.randomBytes(24).toString('base64url')};
 let child;
 try{
  await initialize(data,credentials);
  child=spawn('cmd.exe',['/d','/s','/c','START-EVALUATION.cmd'],{cwd:installed,env:{...process.env,BASTARD_EVAL_DATA:data,BASTARD_EVAL_PORT:'19888',BASTARD_EVAL_NO_BROWSER:'1'},stdio:'ignore'});
  let ready=false;for(let i=0;i<60;i++){try{const r=await fetch('http://127.0.0.1:19888',{signal:AbortSignal.timeout(1000)});if(r.ok){ready=true;break}}catch{}await delay(500)}
  assert.ok(ready,'Installed START-EVALUATION.cmd did not serve the interface');
  const login=await fetch('http://127.0.0.1:19888/?json=true',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({mail:credentials.mail,pass:credentials.password,function:'dash'}),signal:AbortSignal.timeout(10000)});
  assert.equal((await login.json()).ok,true);console.log('PASS: installed START-EVALUATION.cmd entry point starts and authenticates');
 }finally{
  // Only the fresh command tree launched by this test; never kill by image name.
  if(child && child.exitCode===null){execFileSync('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore'});await delay(1000)}
  fs.rmSync(data,{recursive:true,force:true,maxRetries:5,retryDelay:200});
 }
}
main().catch(err=>{console.error(err.message);process.exitCode=1});
