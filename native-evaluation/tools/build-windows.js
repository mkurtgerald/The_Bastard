'use strict';
// Build on a Windows x64 host only. Runtime prerequisites are bundled, not installed globally.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
if(process.platform!=='win32' || process.arch!=='x64')throw new Error('This package must be built and tested on Windows x64.');
const project=path.resolve(__dirname,'../..'),source=path.join(project,'native-evaluation');
const out=path.join(project,'dist','TheBastard-OriginalUI-Evaluation');
if(fs.existsSync(out))throw new Error('Build output already exists. Use a clean build workspace.');
const native=path.join(out,'native-evaluation'),vendor=path.join(native,'vendor');
fs.mkdirSync(vendor,{recursive:true});fs.mkdirSync(path.join(out,'src','camera'),{recursive:true});
fs.cpSync(path.join(project,'src','camera','src'),path.join(out,'src','camera','src'),{recursive:true,filter:file=>!['node_modules','conf.json','super.json','shinobi.sqlite','videos','streams','fileBin'].includes(path.basename(file))});
for(const file of ['launcher.js','smoke.js','package.json','package-lock.json','EVALUATION.md','playwright.config.js'])fs.copyFileSync(path.join(source,file),path.join(native,file));
fs.cpSync(path.join(source,'test'),path.join(native,'test'),{recursive:true});
fs.copyFileSync(process.execPath,path.join(vendor,'node.exe'));
fs.copyFileSync(require('ffmpeg-static'),path.join(vendor,'ffmpeg.exe'));
fs.copyFileSync(require('ffprobe-static').path,path.join(vendor,'ffprobe.exe'));
const licenses=path.join(out,'licenses');fs.mkdirSync(licenses,{recursive:true});
for(const moduleName of ['ffmpeg-static','ffprobe-static']){
 const dir=path.dirname(require.resolve(moduleName));const dest=path.join(licenses,moduleName);fs.mkdirSync(dest,{recursive:true});
 for(const name of fs.readdirSync(dir)){if(/LICENSE|README/i.test(name))fs.copyFileSync(path.join(dir,name),path.join(dest,name));}
}
// Capture the licenses claimed by the actual executables, not just npm wrappers.
const binaryRecords=[];
const gplText=fs.readFileSync(path.join(path.dirname(require.resolve('ffmpeg-static')),'LICENSE'),'utf8');
if(!gplText.includes('GNU GENERAL PUBLIC LICENSE') || !gplText.includes('Version 3'))throw new Error('Complete GPLv3 text is required for the media binaries');
for(const name of ['ffmpeg','ffprobe']){
 const executable=path.join(vendor,name+'.exe');
 const versionText=execFileSync(executable,['-hide_banner','-version'],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
 const licenseText=execFileSync(executable,['-hide_banner','-L'],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
 if(!licenseText.includes('GNU General Public License') || !/version 3/i.test(licenseText))throw new Error('Unexpected media binary license; review before packaging');
 const version=versionText.match(/version (?:n)?(\d+\.\d+(?:\.\d+)?)/);
 if(!version)throw new Error('Cannot identify media binary source version');
 const directory=path.join(licenses,name+'-binary');fs.mkdirSync(directory,{recursive:true});
 fs.writeFileSync(path.join(directory,'BINARY-LICENSE.txt'),licenseText);
 fs.writeFileSync(path.join(directory,'VERSION-AND-CONFIGURATION.txt'),versionText);
 fs.writeFileSync(path.join(directory,'COPYING.GPLv3.txt'),gplText);
 binaryRecords.push({name,version:version[1],sha256:crypto.createHash('sha256').update(fs.readFileSync(executable)).digest('hex'),binaryLicense:'GPL-3.0-or-later as reported by executable',upstreamSource:'https://ffmpeg.org/releases/ffmpeg-'+version[1]+'.tar.xz',binaryPackage:name==='ffmpeg'?'ffmpeg-static@5.2.0':'ffprobe-static@3.1.0',buildReference:name==='ffmpeg'?'https://github.com/eugeneware/ffmpeg-static/releases/tag/b6.0':'https://github.com/derhuerst/ffprobe-static',configurationFile:'licenses/'+name+'-binary/VERSION-AND-CONFIGURATION.txt'});
}
fs.copyFileSync(path.join(source,'BINARY-SOURCES.md'),path.join(licenses,'BINARY-SOURCES.md'));
const nodeLicense=path.join(path.dirname(process.execPath),'LICENSE');if(!fs.existsSync(nodeLicense))throw new Error('Node distribution license is required');fs.copyFileSync(nodeLicense,path.join(licenses,'NODE-LICENSE.txt'));
fs.copyFileSync(path.join(project,'LICENSE'),path.join(licenses,'REPOSITORY-LICENSE.txt'));
execFileSync('cmd.exe',['/d','/s','/c','npm ci --omit=dev --no-audit --no-fund'],{cwd:native,stdio:'inherit'});
binaryRecords.push({name:'node',version:process.version,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(vendor,'node.exe'))).digest('hex'),upstreamSource:'https://nodejs.org/dist/'+process.version+'/node-'+process.version+'.tar.xz',licenseFile:'licenses/NODE-LICENSE.txt'});
fs.writeFileSync(path.join(out,'BUNDLED-BINARY-SOURCES.json'),JSON.stringify({notice:'Version, hash, license, build and upstream-source references. This is not certification that all corresponding-source or commercial distribution obligations are satisfied.',binaries:binaryRecords,nativeDependencies:{sqlite3:{package:'sqlite3@5.1.7',source:'https://github.com/TryGhost/node-sqlite3/tree/v5.1.7',license:'native-evaluation/node_modules/sqlite3/LICENSE',sqliteSource:'Included under native-evaluation/node_modules/sqlite3/deps'}}},null,2));
const revision=execFileSync('git',['rev-parse','HEAD'],{cwd:project,encoding:'utf8'}).trim();
const digest=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
fs.writeFileSync(path.join(out,'EVALUATION-BUILD.json'),JSON.stringify({revision,node:process.version,platform:process.platform,architecture:process.arch,created:new Date().toISOString(),purpose:'Generated-fixture-only original-interface evaluation; not production or commercially cleared',sha256:{node:digest(path.join(vendor,'node.exe')),ffmpeg:digest(path.join(vendor,'ffmpeg.exe')),ffprobe:digest(path.join(vendor,'ffprobe.exe')),dependencyLock:digest(path.join(native,'package-lock.json'))}},null,2));
fs.writeFileSync(path.join(out,'START-EVALUATION.cmd'),'@echo off\r\nsetlocal\r\ncd /d "%~dp0"\r\n"%~dp0native-evaluation\\vendor\\node.exe" "%~dp0native-evaluation\\launcher.js" --demo\r\nif errorlevel 1 pause\r\n');
fs.copyFileSync(path.join(source,'EVALUATION.md'),path.join(out,'READ-ME-FIRST.md'));
console.log('Windows evaluation package assembled at dist/TheBastard-OriginalUI-Evaluation. Run tests before distributing.');
