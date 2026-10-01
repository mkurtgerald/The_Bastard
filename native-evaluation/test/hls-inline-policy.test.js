'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const {launch}=require('../launcher');
const cameraRoot=path.resolve(__dirname,'../../src/camera/src');
const original=fs.readFileSync(path.join(cameraRoot,'web/libs/js/hls.min.js'),'utf8');
const footer='\n;window.Hls.DefaultConfig.enableWorker = false;\n';
const get=(url,options={})=>fetch(url,{...options,signal:AbortSignal.timeout(10000)});
function loadConfig(source){
 const sandbox={window:{},self:{},console:{log(){},warn(){},error(){}}};
 vm.runInNewContext(source,sandbox,{timeout:1000});
 return sandbox.window.Hls;
}
test('served evaluation Hls uses its inline demuxer with original asset and CSP intact',async t=>{
 const data=fs.mkdtempSync(path.join(os.tmpdir(),'bastard inline policy é '));let instance;
 t.after(async()=>{if(instance)await instance.stop();fs.rmSync(data,{recursive:true,force:true});});
 instance=await launch({data,credentials:{mail:'inline-policy@localhost',password:crypto.randomBytes(24).toString('base64url')},port:18893});
 const response=await get(instance.url+'/libs/js/hls.min.js');
 assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/^application\/javascript/);
 assert.equal(response.headers.get('content-security-policy'),"default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws://127.0.0.1:*; frame-ancestors 'none'");
 assert.equal(response.headers.get('referrer-policy'),'same-origin');
 const served=await response.text();assert.equal(served,original+footer);
 const donor=loadConfig(original),evaluation=loadConfig(served);
 assert.equal(donor.version,'0.6.18');assert.equal(donor.DefaultConfig.enableWorker,true);
 assert.equal(evaluation.version,donor.version);assert.equal(evaluation.DefaultConfig.enableWorker,false);
 assert.deepEqual(Object.keys(evaluation.DefaultConfig),Object.keys(donor.DefaultConfig));
 // Exercise the actual bundled constructor, without a browser, media or network.
 const first=new evaluation(),second=new evaluation();
 assert.equal(first.config.enableWorker,false);assert.equal(second.config.enableWorker,false);first.destroy();second.destroy();
 const reopened=new evaluation();assert.equal(reopened.config.enableWorker,false);reopened.destroy();
 const before={...donor.DefaultConfig};vm.runInNewContext(footer,{window:{Hls:donor}},{timeout:1000});
 for(const [key,value] of Object.entries(before))if(key!=='enableWorker')assert.equal(donor.DefaultConfig[key],value);
 for(const headers of [{origin:'null'},{origin:'https://foreign.invalid'},{'sec-fetch-site':'cross-site'},{host:'foreign.invalid:18893'}]){
  // Raw HTTP preserves deliberately invalid Host/Origin headers on every Node platform.
  const status=await new Promise((resolve,reject)=>{
   const request=require('node:http').get(instance.url+'/libs/js/hls.min.js',{headers},response=>{response.resume();response.on('end',()=>resolve(response.statusCode));});
   request.on('error',reject);request.setTimeout(10000,()=>request.destroy(new Error('Guard request timed out')));
  });
  assert.equal(status,403,Object.keys(headers)[0]);
 }
 assert.equal(fs.readFileSync(path.join(cameraRoot,'web/libs/js/hls.min.js'),'utf8'),original);
});
for(const [label,newline] of [['LF','\n'],['CRLF','\r\n']])test(`inline override is evaluation-only and before static serving with ${label}`,()=>{
 const source=fs.readFileSync(path.join(cameraRoot,'camera.js'),'utf8').replace(/\r?\n/g,newline);
 const start=source.search(/if\(config.nativeEvaluation\)\{\r?\n    \/\/ Keep the imported Hls bundle intact\./);
 assert.ok(start>0);const end=source.indexOf("app.use('/libs',express.static",start);assert.ok(end>start);
 const block=source.slice(start,end),routes=[];let reads=0;
 const context={config:{nativeEvaluation:false},__dirname:cameraRoot,fs:{readFileSync(filename,encoding){reads++;assert.equal(filename,cameraRoot+'/web/libs/js/hls.min.js');assert.equal(encoding,'utf8');return original;}},app:{get(route,handler){routes.push({route,handler});}}};
 vm.runInNewContext(block,context,{timeout:1000});assert.equal(reads,0);assert.equal(routes.length,0);
 context.config.nativeEvaluation=true;vm.runInNewContext(block,context,{timeout:1000});assert.equal(reads,1);assert.equal(routes.length,1);assert.equal(routes[0].route,'/libs/js/hls.min.js');
 let mime,body;routes[0].handler({}, {type(value){mime=value;return this;},send(value){body=value;}});
 assert.equal(mime,'application/javascript');assert.equal(body,original+footer);
});
test('all original Hls construction paths load the synchronous adapted asset first',()=>{
 const home=fs.readFileSync(path.join(cameraRoot,'web/pages/home.ejs'),'utf8');
 const embed=fs.readFileSync(path.join(cameraRoot,'web/pages/embed.ejs'),'utf8');
 const dashboard=fs.readFileSync(path.join(cameraRoot,'web/libs/js/main.dash2.js'),'utf8');
 const homeAsset='<script src="/libs/js/hls.min.js"></script>',embedAsset='<script src="<%=data.url%>/libs/js/hls.min.js"></script>';
 assert.ok(home.indexOf(homeAsset)>=0&&home.indexOf(homeAsset)<home.indexOf('include ../libs/js/main.dash2.js'));
 assert.ok(embed.indexOf(embedAsset)>=0&&embed.indexOf(embedAsset)<embed.indexOf('new Hls()'));
 const paths=[];
 function visit(directory){for(const item of fs.readdirSync(directory,{withFileTypes:true})){
  const filename=path.join(directory,item.name);
  if(item.isDirectory())visit(filename);
  else if(/\.(js|ejs)$/.test(item.name)&&!item.name.endsWith('.min.js')){
   const constructors=fs.readFileSync(filename,'utf8').match(/new Hls\([^)]*\)/g)||[];
   for(const constructor of constructors){assert.equal(constructor,'new Hls()');paths.push(path.relative(cameraRoot,filename).replaceAll('\\','/'));}
  }
 }}
 visit(path.join(cameraRoot,'web'));
 assert.deepEqual(paths.sort(),['web/libs/js/main.dash2.js','web/pages/embed.ejs']);
 assert.match(dashboard,/hlsGarbageCollector[\s\S]*new Hls\(\)/);
});
