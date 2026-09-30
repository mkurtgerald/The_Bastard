'use strict';
// Local evaluation of the preserved SharpAI/Shinobi UI. No system installation.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const net = require('node:net');
const { fork, execFileSync, execFile } = require('node:child_process');
const readline = require('node:readline');
const { Writable } = require('node:stream');
const sqlite3 = require('sqlite3');
const {isDeepStrictEqual}=require('node:util');
const userDetails=()=>({lang:'en_CA',size:'512',max_camera:'2',days:'1',permissions:'all'});
const fixtureDetails=()=>({stream_type:'hls',stream_vcodec:'copy',stream_acodec:'no',vcodec:'copy',acodec:'no',stream_loop:'1',cust_input:'-re',cutoff:'0.1',hls_time:'1',hls_list_size:'3',detector:'0',snap:'0',fatal_max:'3',loglevel:'warning'});
const cameraRoot = path.resolve(__dirname, '../src/camera/src');
const slash = p => p.replace(/\\/g, '/');
const md5 = s => crypto.createHash('md5').update(s).digest('hex'); // Upstream local auth format.
function dataDirectory() {
  return process.env.BASTARD_EVAL_DATA || path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), '.local', 'share'), 'TheBastardEvaluation');
}
function openDb(filename) { return new Promise((resolve,reject) => { const db = new sqlite3.Database(filename, err => err ? reject(err) : resolve(db)); }); }
function run(db, sql, values=[]) { return new Promise((resolve,reject) => db.run(sql, values, err => err ? reject(err) : resolve())); }
function all(db, sql, values=[]) { return new Promise((resolve,reject) => db.all(sql, values, (err, rows) => err ? reject(err) : resolve(rows))); }
function closeDb(db) { return new Promise((resolve,reject) => db.close(err => err ? reject(err) : resolve())); }
function binaries() {
  const ext = process.platform === 'win32' ? '.exe' : '';
  const bundled = name => path.join(__dirname, 'vendor', name + ext);
  return {
    ffmpeg: process.env.BASTARD_FFMPEG || (fs.existsSync(bundled('ffmpeg')) ? bundled('ffmpeg') : 'ffmpeg'),
    ffprobe: process.env.BASTARD_FFPROBE || (fs.existsSync(bundled('ffprobe')) ? bundled('ffprobe') : 'ffprobe')
  };
}
async function initialize(data, credentials) {
  assertNoLinkedPaths(data);
  fs.mkdirSync(data, { recursive:true, mode:0o700 });
  const filename = path.join(data, 'shinobi.sqlite');
  const marker=path.join(data,'evaluation-profile.json');
  const isNew=!fs.existsSync(filename);
  if(isNew && fs.readdirSync(data).length)throw new Error('Choose an empty evaluation data directory; existing files were not adopted or changed.');
  if(!isNew && (!fs.existsSync(marker) || JSON.parse(fs.readFileSync(marker,'utf8')).format!=='generated-fixture-evaluation-v1'))throw new Error('This is not an evaluation profile. Use a fresh evaluation data directory; existing data was not changed.');
  if(isNew){
    fs.copyFileSync(path.join(cameraRoot,'sql','shinobi.sample.sqlite'),filename,fs.constants.COPYFILE_EXCL);
    fs.writeFileSync(marker,JSON.stringify({format:'generated-fixture-evaluation-v1'}),{mode:0o600});
  }
  const db = await openDb(filename);
  try {
    if(isNew)await run(db,'DELETE FROM Logs'); // Discard historical sample log rows, never existing user data.
    if(isNew)await run(db, 'CREATE TABLE IF NOT EXISTS Files (ke TEXT, mid TEXT, name TEXT, size REAL DEFAULT 0, details TEXT, status INTEGER DEFAULT 0)');
    const users = await all(db,'SELECT ke,uid,mail,details FROM Users');
    if(users.length){
      if(users.length!==1 || !isDeepStrictEqual(JSON.parse(users[0].details || '{}'),userDetails()) || (await all(db,'SELECT code FROM API')).length)throw new Error('This profile has unsupported accounts or integrations. Use a fresh evaluation data directory.');
      const saved=JSON.parse(fs.readFileSync(marker,'utf8'));
      const {ke,uid,mail}=users[0];
      if(saved.ke!==ke || saved.uid!==uid || saved.mail!==mail)throw new Error('Evaluation profile identity differs. Use a fresh evaluation data directory.');
      return {ke,uid,mail};
    }
    if(!credentials || !credentials.mail || !credentials.password || credentials.password.length < 12) throw new Error('First launch requires a local account and a password of at least 12 characters. Run this launcher interactively.');
    const user = { ke:crypto.randomBytes(5).toString('hex'), uid:crypto.randomBytes(5).toString('hex'), mail:credentials.mail };
    await run(db, 'INSERT INTO Users (ke,uid,mail,pass,details) VALUES (?,?,?,?,?)', [user.ke,user.uid,user.mail,md5(credentials.password),JSON.stringify(userDetails())]);
    fs.writeFileSync(marker,JSON.stringify({format:'generated-fixture-evaluation-v1',...user}),{mode:0o600});
    fs.chmodSync(filename,0o600);
    return user;
  } finally { await closeDb(db); }
}
async function createDemo(data, user, ffmpeg) {
  const fixtureDir = path.join(data, 'fixtures'); fs.mkdirSync(fixtureDir,{recursive:true});
  const db = await openDb(path.join(data,'shinobi.sqlite'));
  try {
    for(const [i, source] of ['testsrc2=size=320x180:rate=10','smptebars=size=320x180:rate=10'].entries()) {
      const mid = `fixture${i+1}`, filename = path.join(fixtureDir, `${mid}.mp4`);
      if(!fs.existsSync(filename)) execFileSync(ffmpeg,['-hide_banner','-loglevel','error','-f','lavfi','-i',source,'-t','8','-c:v','libx264','-threads','1','-preset','ultrafast','-pix_fmt','yuv420p','-g','10','-movflags','+faststart','-y',filename],{stdio:'pipe'});
      const details=fixtureDetails();
      const existing = await all(db,'SELECT mid FROM Monitors WHERE ke=? AND mid=?',[user.ke,mid]);
      if(!existing.length) await run(db,'INSERT INTO Monitors (mid,ke,name,type,ext,protocol,host,path,port,fps,mode,width,height,details) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[mid,user.ke,`Generated test ${i+1}`,'local','mp4','file','',slash(filename),'0',10,'record',320,180,JSON.stringify(details)]);
    }
  } finally { await closeDb(db); }
}
function assertNoLinkedPaths(dir){
  let parent=path.resolve(dir);
  for(;;){
    if(fs.existsSync(parent) && fs.lstatSync(parent).isSymbolicLink())throw new Error('Linked runtime paths are not permitted in evaluation');
    const next=path.dirname(parent);if(next===parent)break;parent=next;
  }
  if(!fs.existsSync(dir))return;
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const item=path.join(dir,entry.name);
    if(entry.isSymbolicLink())throw new Error('Linked runtime paths are not permitted in evaluation');
    if(entry.isDirectory())assertNoLinkedPaths(item);
  }
}
function directoryBytes(dir) {
  let bytes=0;
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})) {
    if(entry.isSymbolicLink())throw new Error('Linked runtime paths are not permitted in evaluation');
    const item=path.join(dir,entry.name);
    bytes += entry.isDirectory() ? directoryBytes(item) : fs.statSync(item).size;
  }
  return bytes;
}
function checkPort(port) {return new Promise((resolve,reject)=>{const server=net.createServer();server.once('error',reject);server.listen(port,'127.0.0.1',()=>server.close(resolve));});}
async function launch(options={}) {
  const data=path.resolve(options.data || dataDirectory()), port=Number(options.port || process.env.BASTARD_EVAL_PORT || 8787);
  if(!Number.isInteger(port)||port<1024||port>65535) throw new Error('Evaluation port must be between 1024 and 65535');
  await checkPort(port);
  const bin=binaries();
  execFileSync(bin.ffmpeg,['-version'],{stdio:'pipe'});execFileSync(bin.ffprobe,['-version'],{stdio:'pipe'});
  assertNoLinkedPaths(data);
  const user=await initialize(data,options.credentials);
  const profile=await openDb(path.join(data,'shinobi.sqlite'));
  try{
    const monitors=await all(profile,'SELECT * FROM Monitors');
    for(const monitor of monitors){
      const expected=slash(path.join(data,'fixtures',monitor.mid+'.mp4'));
      if(!['fixture1','fixture2'].includes(monitor.mid) || monitor.ke!==user.ke || monitor.type!=='local' || monitor.path!==expected || monitor.ext!=='mp4' || monitor.host!=='' || monitor.protocol!=='file' || String(monitor.port)!=='0' || !['stop','start','record'].includes(monitor.mode) || monitor.width!==320 || monitor.height!==180 || monitor.fps!==10)throw new Error('Evaluation profiles may contain only the two generated fixtures. Use a fresh evaluation data directory.');
      const details=JSON.parse(monitor.details || '{}');
      if(!isDeepStrictEqual(details,fixtureDetails()))throw new Error('Modified fixture settings are outside this evaluation. Use a fresh evaluation data directory.');
    }
  }finally{await closeDb(profile);}
  if(options.demo) await createDemo(data,user,bin.ffmpeg);
  if(directoryBytes(data)>512*1024*1024)throw new Error('Evaluation storage limit reached. Recordings have been preserved; choose a new data directory.');
  for(const dir of ['videos','streams','fileBin']) fs.mkdirSync(path.join(data,dir),{recursive:true});
  const config={nativeEvaluation:true,ip:'127.0.0.1',bindip:'127.0.0.1',port,databaseType:'sqlite3',db:{filename:slash(path.join(data,'shinobi.sqlite'))},ffmpegDir:bin.ffmpeg,ffprobeDir:bin.ffprobe,videosDir:slash(path.join(data,'videos')),streamDir:slash(path.join(data,'streams')),binDir:slash(path.join(data,'fileBin')),autoDropCache:false,deleteCorruptFiles:false,doSnapshot:false,systemLog:false,databaseLogs:false,cron:{deleteOverMax:false,deleteOld:false,deleteNoVideo:false},pluginKeys:{},addStorage:[]};
  const configFile=path.join(data,'conf.json'), superFile=path.join(data,'super.json');
  fs.writeFileSync(configFile,JSON.stringify(config,null,2),{mode:0o600});fs.writeFileSync(superFile,'[]',{mode:0o600});
  const child=fork(path.join(cameraRoot,'camera.js'),[],{cwd:cameraRoot,stdio:['ignore','pipe','pipe','ipc'],env:{...process.env,SHINOBI_CONFIG_FILE:configFile,SHINOBI_SUPER_FILE:superFile,NODE_PATH:path.join(__dirname,'node_modules')}});
  const ownedPids=new Set();
  child.on('message',message=>{if(message && message.type==='owned-process-started')ownedPids.add(message.pid);if(message && message.type==='owned-process-exited')ownedPids.delete(message.pid)});
  let output='';
  child.stdout.on('data',chunk=>{output=(output+chunk).slice(-16384);if(options.verbose)process.stdout.write(chunk)});
  child.stderr.on('data',chunk=>{output=(output+chunk).slice(-16384);if(options.verbose)process.stderr.write(chunk)});
  const stop=()=>new Promise(resolve=>{
    if(child.exitCode!==null || child.signalCode!==null)return resolve();
    child.once('exit',resolve);
    if(child.connected)child.send('shutdown'); else child.kill();
    const kill=setTimeout(()=>{if(child.exitCode===null && child.signalCode===null)child.kill()},6000);kill.unref();
  });
  let quota=setInterval(()=>{
    try {if(directoryBytes(data)>512*1024*1024){console.error('Evaluation storage limit reached (512 MiB); stopping without deleting recordings.');stop();}}catch(err){console.error('Storage check failed; stopping.');stop();}
  },5000);
  child.once('exit',()=>{clearInterval(quota)});
  await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>{stop();reject(new Error('Original interface did not become ready within 30 seconds. '+output));},30000);
    child.on('message',message=>{if(message==='ready'){clearTimeout(timeout);resolve()}});
    child.once('exit',code=>{clearTimeout(timeout);reject(new Error(`Original interface exited during startup (${code}). ${output}`))});
  });
  return {child,stop,user,data,port,ownedPids,url:`http://127.0.0.1:${port}`,getOutput:()=>output};
}
function ask(prompt,secret=false) {
  return new Promise(resolve=>{
    let muted=false;
    const output=new Writable({write(chunk,enc,cb){if(!muted)process.stdout.write(chunk);cb();}});
    const rl=readline.createInterface({input:process.stdin,output,terminal:!!process.stdin.isTTY});
    rl.question(prompt,answer=>{muted=false;rl.close();if(secret)process.stdout.write('\n');resolve(answer)});muted=secret;
  });
}
async function main() {
  const data=dataDirectory();let credentials;
  assertNoLinkedPaths(data);
  let needsSetup=true;
  if(fs.existsSync(path.join(data,'shinobi.sqlite'))) {const db=await openDb(path.join(data,'shinobi.sqlite'));needsSetup=!(await all(db,'SELECT uid FROM Users LIMIT 1')).length;await closeDb(db);}
  if(needsSetup){
    if(!process.stdin.isTTY)throw new Error('Run first setup in an interactive terminal so you can choose your local credentials.');
    console.log('Local evaluation only. The original legacy interface is not hardened for production or network exposure. No cloud account is needed.');
    const mail=await ask('Local login name (email-style, stays on this computer): '),password=await ask('Choose a disposable evaluation password (12+ characters; do not reuse a real password): ',true),confirm=await ask('Confirm password: ',true);
    if(password!==confirm)throw new Error('Passwords did not match.');credentials={mail,password};
  }
  const instance=await launch({data,credentials,demo:process.argv.includes('--demo'),verbose:process.argv.includes('--verbose')});
  console.log(`Original SharpAI interface ready: ${instance.url}\nStorage ceiling: 512 MiB; recordings are preserved when full. Close this window or press Ctrl+C to stop.\nUser data: ${instance.data}`);
  if(process.platform==='win32' && process.env.BASTARD_EVAL_NO_BROWSER!=='1')execFile('cmd.exe',['/d','/s','/c','start \"\" \"'+instance.url+'\"'],()=>{});
  process.once('SIGINT',instance.stop);process.once('SIGTERM',instance.stop);
}
if(require.main===module)main().catch(err=>{console.error(err.message);process.exitCode=1});
module.exports={launch,initialize,createDemo,openDb,run,all,closeDb,directoryBytes,binaries};
