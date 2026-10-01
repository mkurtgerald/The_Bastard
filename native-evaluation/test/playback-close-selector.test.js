'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),ejs=require('ejs');
const cameraRoot=path.resolve(__dirname,'../../src/camera/src');
test('recording playback closes by its unique footer Close button, not Delete',()=>{
 const source=fs.readFileSync(path.join(cameraRoot,'web/pages/blocks/videoview.ejs'),'utf8');
 const lang=JSON.parse(fs.readFileSync(path.join(cameraRoot,'languages/en_CA.json'),'utf8'));
 const html=ejs.render(source,{lang,config:{}});
 const playerStart=html.indexOf('id="video_viewer"');assert.ok(playerStart>0);
 const footerStart=html.indexOf('<div class="modal-footer">',playerStart);assert.ok(footerStart>playerStart);
 const footer=html.slice(footerStart);
 // The preserved donor has two dismiss controls here, including destructive Delete.
 const dismiss=[...footer.matchAll(/<(a|button)\b([^>]*\bdata-dismiss="modal"[^>]*)>([^<]*)<\/\1>/g)];
 assert.equal(dismiss.length,2);
 assert.equal(dismiss.filter(item=>item[1]==='a'&&/\bvideo="delete"/.test(item[2])).length,1);
 const close=dismiss.filter(item=>item[1]==='button'&&item[3].trim()==='Close');
 assert.equal(close.length,1);assert.match(close[0][2],/\btype="button"/);
 const browserTest=fs.readFileSync(path.join(__dirname,'browser/original-ui.spec.js'),'utf8');
 assert.ok(browserTest.includes("page.locator('#video_viewer .modal-footer').getByRole('button',{name:'Close',exact:true}).click()"));
 assert.ok(!browserTest.includes("page.locator('#video_viewer .modal-footer [data-dismiss=\"modal\"]')"));
 assert.ok(browserTest.includes("await expect(page.locator('#video_viewer')).not.toBeVisible()"));
});
