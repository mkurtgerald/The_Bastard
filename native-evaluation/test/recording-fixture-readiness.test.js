'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {waitForCompletedFixtureRecordings,hasOwnedFixtureRecording}=require('./browser/recording-fixture-readiness');
const clip=mid=>({mid,status:1,size:100,ownedFile:true});
test('readiness requires completed nonempty recordings from both generated monitors',async()=>{
 const snapshots=[[],[{...clip('fixture1'),status:0}], [clip('fixture1')],[clip('fixture1'),{...clip('fixture2'),size:0}],[clip('fixture1'),{...clip('fixture2'),status:0}],[clip('fixture1'),clip('fixture2')]];let reads=0;
 await waitForCompletedFixtureRecordings(async()=>snapshots[reads++],{timeoutMs:1000,pollMs:1});
 assert.equal(reads,snapshots.length);
});
test('duplicate or unrelated clips cannot stand in for the second monitor',async()=>{
 await assert.rejects(waitForCompletedFixtureRecordings(async()=>[clip('fixture1'),clip('fixture1'),clip('unrelated')],{timeoutMs:30,pollMs:1}),/readiness deadline/);
});
test('unavailable metadata and invalid sizes cannot establish fixture readiness',async()=>{
 let reads=0;const snapshots=[null,[clip('fixture1'),{...clip('fixture2'),size:Infinity}],[clip('fixture1'),{...clip('fixture2'),size:'100'}],[clip('fixture1'),clip('fixture2')]];
 await waitForCompletedFixtureRecordings(async()=>snapshots[reads++],{timeoutMs:1000,pollMs:1});assert.equal(reads,snapshots.length);
});
test('completed metadata with missing or foreign output cannot establish readiness',async()=>{
 await assert.rejects(waitForCompletedFixtureRecordings(async()=>[clip('fixture1'),{...clip('fixture2'),ownedFile:false}],{timeoutMs:30,pollMs:1}),/fixture1=ready, fixture2=missing/);
});
test('physical clip must belong to the exact current profile and account',t=>{
 const data=fs.mkdtempSync(path.join(os.tmpdir(),'recording-readiness-')),foreign=fs.mkdtempSync(path.join(os.tmpdir(),'foreign-generation-'));t.after(()=>{fs.rmSync(data,{recursive:true,force:true});fs.rmSync(foreign,{recursive:true,force:true});});
 const ke='0123456789',row={ke,mid:'fixture1',time:'2026-10-01 12:00:00',ext:'mp4',status:1,size:3};
 const filename=directory=>path.join(directory,'videos',ke,'fixture1','2026-10-01T12-00-00.mp4');
 fs.mkdirSync(path.dirname(filename(foreign)),{recursive:true});fs.writeFileSync(filename(foreign),'abc');
 assert.equal(hasOwnedFixtureRecording(row,data,ke),false);
 fs.mkdirSync(path.dirname(filename(data)),{recursive:true});fs.writeFileSync(filename(data),'abc');
 assert.equal(hasOwnedFixtureRecording(row,data,ke),true);
 assert.equal(hasOwnedFixtureRecording({...row,ke:'fedcba9876'},data,ke),false);
 for(const altered of [{status:0},{size:4},{size:0},{ext:'../mp4'},{mid:'../fixture1'},{time:'../../private'}])assert.equal(hasOwnedFixtureRecording({...row,...altered},data,ke),false);
 fs.unlinkSync(filename(data));assert.equal(hasOwnedFixtureRecording(row,data,ke),false);
});
test('a stalled reader cannot outlive the fixture readiness deadline',{timeout:1000},async()=>{
 const start=performance.now();await assert.rejects(waitForCompletedFixtureRecordings(()=>new Promise(()=>{}),{timeoutMs:30}),/readiness deadline/);assert.ok(performance.now()-start<500);
});
test('late reader completion cannot restart polling after timeout',{timeout:1000},async()=>{
 let reads=0,complete;const pending=waitForCompletedFixtureRecordings(()=>{reads++;return new Promise(resolve=>{complete=resolve;});},{timeoutMs:30,pollMs:1});
 await assert.rejects(pending,/readiness deadline/);complete([]);await new Promise(resolve=>setTimeout(resolve,20));assert.equal(reads,1);
});
test('reader errors never expose profile paths or credentials',async()=>{
 const secret='PRIVATE_PROFILE_TOKEN';await assert.rejects(waitForCompletedFixtureRecordings(async()=>{throw new Error(secret);}),error=>error.message==='Generated fixture recording readiness query failed'&&!error.message.includes(secret));
});
