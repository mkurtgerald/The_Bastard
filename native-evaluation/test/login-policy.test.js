'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {launch}=require('../launcher');

test('native login preserves its same-origin POST without accepting opaque or foreign origins',async t=>{
 const data=fs.mkdtempSync(path.join(os.tmpdir(),'bastard login policy é '));
 const credentials={mail:'login-policy@localhost',password:crypto.randomBytes(24).toString('base64url')};
 let instance;
 t.after(async()=>{if(instance)await instance.stop();fs.rmSync(data,{recursive:true,force:true});});
 instance=await launch({data,credentials,port:18890});
 const get=await fetch(instance.url);
 assert.equal(get.status,200);
 // In navigation mode, no-referrer rewrites a form POST's Origin to null.
 // Keep the real same-origin Origin while suppressing cross-origin referrers.
 assert.equal(get.headers.get('referrer-policy'),'same-origin');
 assert.match(await get.text(),/id="login-form" method="post"/);
 const post=(headers,password=credentials.password)=>fetch(instance.url,{
  method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','sec-fetch-site':'same-origin',...headers},
  body:new URLSearchParams({mail:credentials.mail,pass:password,function:'dash'}),
  signal:AbortSignal.timeout(10000)
 });
 for(const origin of ['null','https://untrusted.example','http://127.0.0.1:18891']){
  const rejected=await post({origin});
  assert.equal(rejected.status,403,`Reject origin ${origin}`);
  assert.equal(await rejected.text(),'Local same-origin request required');
 }
 const crossSite=await post({origin:instance.url,'sec-fetch-site':'cross-site'});
 assert.equal(crossSite.status,403);
 await crossSite.text();
 const wrongPassword=await post({origin:instance.url},'incorrect-disposable-password');
 assert.equal(wrongPassword.status,200);
 assert.equal(wrongPassword.headers.get('referrer-policy'),'same-origin');
 assert.doesNotMatch(await wrongPassword.text(),/id="main_header"/);
 const signedIn=await post({origin:instance.url});
 assert.equal(signedIn.status,200);
 assert.match(await signedIn.text(),/id="main_header"/);
});
