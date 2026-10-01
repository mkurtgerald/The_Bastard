'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
async function verifyRestartedRecordings(before,after,{readClip,decodeClip}){
 assert.equal(before.length,2,'Restart check requires both generated fixtures');
 assert.deepEqual(before.map(clip=>clip.mid).sort(),['fixture1','fixture2'],'Restart check requires both generated fixtures');
 const selected=before.map(previous=>{
  assert.ok(typeof previous.time==='string'&&previous.time.length>0,'Missing original recording identity');
  assert.equal(previous.ext,'mp4','Only generated MP4 recordings are supported');
  assert.match(previous.sha256,/^[a-f0-9]{64}$/,'Missing original file digest');
  assert.match(previous.decodedHash,/^SHA256=[a-f0-9]{64}$/,'Missing original decoded-content digest');
  const matches=after.filter(clip=>clip.mid===previous.mid&&clip.time===previous.time&&clip.ext===previous.ext);
  assert.equal(matches.length,1,'Original recording missing or duplicated after restart');
  const current=matches[0];
  assert.equal(current.status,1,'Original recording is no longer complete');
  assert.ok(Number.isFinite(Number(current.size))&&Number(current.size)>0,'Original recording is empty after restart');
  return {previous,current};
 });
 for(const {previous,current} of selected){
  // Use the fresh authenticated listing object; a new clip or stale URL is not proof.
  const bytes=await readClip(current);
  assert.ok(Buffer.isBuffer(bytes)&&bytes.length>0,'Restarted recording retrieval returned no bytes');
  assert.equal(digest(bytes),previous.sha256,'Original recording bytes changed after restart');
  const decodedHash=await decodeClip(bytes,current);
  assert.equal(decodedHash,previous.decodedHash,'Original decoded recording changed after restart');
 }
}
module.exports={verifyRestartedRecordings};
