'use strict';
const {test,expect}=require('@playwright/test');
const {closePlaybackModal}=require('./playback-close');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {launch,openDb,all,closeDb}=require('../../launcher');
const {attachMediaDiagnostics}=require('./media-diagnostics');
const {waitForCompletedFixtureRecordings,hasOwnedFixtureRecording}=require('./recording-fixture-readiness');
let instance,data,credentials;
test.beforeAll(async()=>{
 data=fs.mkdtempSync(path.join(os.tmpdir(),'Bastard UI evaluation é '));credentials={mail:'browser-evaluation@localhost',password:crypto.randomBytes(24).toString('base64url')};instance=await launch({data,credentials,demo:true,port:19887});
 await waitForCompletedFixtureRecordings(async()=>{
  const db=await openDb(path.join(data,'shinobi.sqlite'));
  try{
   const rows=await all(db,'SELECT ke,mid,time,ext,status,size FROM Videos WHERE ke=?',[instance.user.ke]);
   return rows.map(row=>({mid:row.mid,status:row.status,size:row.size,ownedFile:hasOwnedFixtureRecording(row,data,instance.user.ke)}));
  }
  finally{await closeDb(db);}
 });
});
test.afterAll(async()=>{if(instance)await instance.stop();if(data)fs.rmSync(data,{recursive:true,force:true});});
test('original login, two live monitors, playback and interrupted navigation',async({page},testInfo)=>{
 const diagnostics=await attachMediaDiagnostics(page,instance.url);
 const faults=diagnostics.faults;
 try{
 const loginPage=await page.goto(instance.url);
 expect(loginPage.status()).toBe(200);
 expect(loginPage.headers()['referrer-policy']).toBe('same-origin');
 await expect(page.locator('#email')).toHaveValue('');await expect(page.locator('#pass')).toHaveValue('');
 await page.locator('#email').fill(credentials.mail);await page.locator('#pass').fill(credentials.password);
 const [signedIn]=await Promise.all([page.waitForNavigation(),page.locator('#login-submit').click()]);
 expect(await signedIn.request().headerValue('origin')).toBe(instance.url);
 expect(signedIn.status()).toBe(200);
 await expect(page.locator('#main_header')).toBeVisible();
 await diagnostics.armHls();
 for(const mid of ['fixture1','fixture2']){
  const tile=page.locator(`.monitor_block[mid="${mid}"]`);await expect(tile).toBeVisible({timeout:30000});
  await tile.locator('[monitor="watch"]').click();
  const live=page.locator(`.monitor_item[mid="${mid}"]`);await expect(live).toBeVisible();
  try{
   await expect.poll(()=>live.locator('video').evaluate(video=>video.readyState>=2&&video.videoWidth>0),{timeout:30000}).toBe(true);
  }finally{await diagnostics.report(mid,'live',live.locator('video'));}
 }
 // Repeat Close/reopen on the original live controls.
 await page.locator('.monitor_item[mid="fixture1"] [monitor="watch_off"]').click();
 await expect(page.locator('.monitor_item[mid="fixture1"]')).toHaveCount(0);
 await page.locator('.monitor_block[mid="fixture1"] [monitor="watch"]').click();
 await expect(page.locator('.monitor_item[mid="fixture1"]')).toBeVisible();
 await page.screenshot({path:testInfo.outputPath('original-two-camera-dashboard.png'),fullPage:true});
 await testInfo.attach('Original two-camera dashboard',{path:testInfo.outputPath('original-two-camera-dashboard.png'),contentType:'image/png'});
 // Original recording list and video-player modal, then Close and reopen.
 const listButton=page.locator('.monitor_item[mid="fixture1"] [monitor="videos_table"]');await listButton.click();
 await expect(page.locator('#videos_viewer')).toBeVisible();
 await expect(page.locator('#videos_viewer [video="launch"]').first()).toBeVisible({timeout:30000});
 await page.locator('#videos_viewer [video="launch"]').first().click();await expect(page.locator('#video_viewer')).toBeVisible();
 try{
  await expect.poll(()=>page.locator('#video_viewer video').evaluate(video=>video.readyState>=2&&video.videoWidth>0),{timeout:30000}).toBe(true);
 }finally{await diagnostics.report('fixture1','recording',page.locator('#video_viewer video'));}
 await page.screenshot({path:testInfo.outputPath('original-recording-playback.png'),fullPage:true});
 await testInfo.attach('Original recording playback',{path:testInfo.outputPath('original-recording-playback.png'),contentType:'image/png'});
 await closePlaybackModal(page);
 await page.locator('#videos_viewer .modal-header [data-dismiss="modal"]').click();await expect(page.locator('#videos_viewer')).not.toBeVisible();
 // Open the preserved monitor editor, cancel, then open it again.
 await page.locator('.monitor_block[mid="fixture1"] [monitor="edit"]').click();
 await expect(page.locator('#add_monitor')).toBeVisible();
 await page.locator('#add_monitor [data-dismiss="modal"]').first().click();await expect(page.locator('#add_monitor')).not.toBeVisible();
 expect(faults).toEqual([]);
 }finally{diagnostics.dispose();}
});
