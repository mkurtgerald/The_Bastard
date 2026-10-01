'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {verifyRestartedRecordings}=require('./restarted-recordings');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function fixture(){
 const payload={fixture1:Buffer.from('first completed generated recording'),fixture2:Buffer.from('second completed generated recording')};
 const decoded={fixture1:'SHA256='+sha(Buffer.from('first decoded content')),fixture2:'SHA256='+sha(Buffer.from('second decoded content'))};
 const before=['fixture1','fixture2'].map(mid=>({mid,time:'2026-10-01T00:00:00',ext:'mp4',sha256:sha(payload[mid]),decodedHash:decoded[mid],href:'/stale-auth/'+mid}));
 const after=before.map(({mid,time,ext})=>({mid,time,ext,status:1,size:payload[mid].length,href:'/fresh-auth/'+mid}));
 const reads=[],decodes=[];
 const io={readClip:async clip=>{reads.push(clip);return payload[clip.mid];},decodeClip:async(bytes,clip)=>{decodes.push(clip);assert.equal(bytes,payload[clip.mid]);return decoded[clip.mid];}};
 return {payload,decoded,before,after,reads,decodes,io};
}
test('restart verification retrieves and decodes both original clips using their fresh listing identities',async()=>{
 const f=fixture();f.after.reverse();f.after.push({...f.after[0],time:'2026-10-01T00:01:00',href:'/newer-clip'});
 await verifyRestartedRecordings(f.before,f.after,f.io);
 assert.deepEqual(f.reads.map(clip=>clip.href),['/fresh-auth/fixture1','/fresh-auth/fixture2']);
 assert.deepEqual(f.decodes,f.reads);
});
test('a newer clip from the same camera cannot replace its pre-restart clip',async()=>{
 const f=fixture();f.after[0].time='2026-10-01T00:01:00';
 await assert.rejects(verifyRestartedRecordings(f.before,f.after,f.io),/missing or duplicated/);assert.equal(f.reads.length,0);
});
test('missing, duplicate and cross-camera clip identities fail before reading any payload',async()=>{
 for(const mutate of [f=>f.after.pop(),f=>f.after.push({...f.after[0]}),f=>{f.after[1].mid='fixture1';}]){
  const f=fixture();mutate(f);await assert.rejects(verifyRestartedRecordings(f.before,f.after,f.io),/missing or duplicated/);assert.equal(f.reads.length,0);
 }
});
test('incomplete, empty or non-MP4 restored clips are rejected',async()=>{
 for(const change of [{status:0},{size:0},{size:NaN},{ext:'ts'}]){
  const f=fixture();Object.assign(f.after[0],change);await assert.rejects(verifyRestartedRecordings(f.before,f.after,f.io));assert.equal(f.reads.length,0);
 }
});
test('metadata cannot prove survival if the original bytes changed',async()=>{
 const f=fixture();f.io.readClip=async()=>Buffer.from('different recording');
 await assert.rejects(verifyRestartedRecordings(f.before,f.after,f.io),/bytes changed/);assert.equal(f.decodes.length,0);
});
test('retrieval failure or empty payload cannot pass the restart check',async()=>{
 for(const readClip of [async()=>{throw new Error('read failed');},async()=>Buffer.alloc(0)]){
  const f=fixture();f.io.readClip=readClip;await assert.rejects(verifyRestartedRecordings(f.before,f.after,f.io));assert.equal(f.decodes.length,0);
 }
});
test('decoder failure and changed decoded content remain failures despite identical file bytes',async()=>{
 for(const decodeClip of [async()=>{throw new Error('decode failed');},async()=>'SHA256='+'0'.repeat(64)]){
  const f=fixture();f.io.decodeClip=decodeClip;await assert.rejects(verifyRestartedRecordings(f.before,f.after,f.io));assert.equal(f.reads.length,1);
 }
});
test('restart verification requires distinct snapshots for both generated fixtures',async()=>{
 for(const change of [f=>f.before.pop(),f=>{f.before[1]=f.before[0];},f=>{f.before[1].mid='external-camera';},f=>{f.before[0].sha256='';},f=>{f.before[0].decodedHash='';}]){
  const f=fixture();change(f);await assert.rejects(verifyRestartedRecordings(f.before,f.after,f.io));assert.equal(f.reads.length,0);
 }
});
