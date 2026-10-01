'use strict';
const fs=require('node:fs'),path=require('node:path');

function hasOwnedFixtureRecording(row,data,ke){
 if(!/^[a-f0-9]{10}$/.test(ke)||!row||row.ke!==ke||!['fixture1','fixture2'].includes(row.mid)||row.ext!=='mp4'||row.status!==1||!Number.isFinite(row.size)||row.size<=0||!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(row.time))return false;
 const parts=[data,path.join(data,'videos'),path.join(data,'videos',ke),path.join(data,'videos',ke,row.mid)];
 const filename=row.time.replace(' ','T').replaceAll(':','-')+'.mp4';
 try{
  for(const directory of parts){const stat=fs.lstatSync(directory);if(stat.isSymbolicLink()||!stat.isDirectory())return false;}
  const stat=fs.lstatSync(path.join(parts[3],filename));
  return !stat.isSymbolicLink()&&stat.isFile()&&stat.size===row.size;
 }catch{return false;}
}

// The original recording list is a snapshot. Establish complete test clips before
// opening it; a live HLS segment alone does not imply a closed playable recording.
function waitForCompletedFixtureRecordings(read,{timeoutMs=30000,pollMs=250}={}){
 return new Promise((resolve,reject)=>{
  let done=false,pollTimer,last={fixture1:false,fixture2:false};
  const deadline=setTimeout(()=>finish(new Error(`Generated fixture recordings did not complete before the readiness deadline (fixture1=${last.fixture1?'ready':'missing'}, fixture2=${last.fixture2?'ready':'missing'})`)),timeoutMs);
  function finish(error){
   if(done)return;done=true;clearTimeout(deadline);clearTimeout(pollTimer);
   if(error)reject(error);else resolve();
  }
  async function check(){
   try{
    const rows=await read();if(done)return;
    const complete=new Set((Array.isArray(rows)?rows:[]).filter(row=>row&&row.ownedFile===true&&row.status===1&&Number.isFinite(row.size)&&row.size>0).map(row=>row.mid));
    last={fixture1:complete.has('fixture1'),fixture2:complete.has('fixture2')};
    if(['fixture1','fixture2'].every(mid=>complete.has(mid)))finish();
    else pollTimer=setTimeout(check,pollMs);
   }catch{finish(new Error('Generated fixture recording readiness query failed'));}
  }
  check();
 });
}
module.exports={waitForCompletedFixtureRecordings,hasOwnedFixtureRecording};
