'use strict';
const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path'),ejs=require('ejs');
const {closePlaybackModal,playbackCloseSelector}=require('./playback-close');
const cameraRoot=path.resolve(__dirname,'../../../src/camera/src');
const read=relative=>fs.readFileSync(path.join(cameraRoot,relative),'utf8');
test('preserved donor playback Close survives show, dismiss and reopen',async({page})=>{
 const html=ejs.render(read('web/pages/blocks/videoview.ejs'),{lang:JSON.parse(read('languages/en_CA.json')),config:{}});
 await page.setContent(html);
 await page.addStyleTag({content:read('web/libs/css/bootstrap.min.css')});
 await page.addStyleTag({content:read('web/libs/css/main.dash2.css')});
 await page.addScriptTag({content:read('web/libs/js/jquery.min.js')});
 await page.addScriptTag({content:read('web/libs/js/bootstrap.min.js')});
 const player=page.locator('#video_viewer');
 await expect(player).not.toBeVisible();
 // Count actual Delete clicks so this test cannot pass by dismissing destructively.
 await page.evaluate(()=>{window.__deleteClicks=0;document.querySelector('#video_viewer [video="delete"]').addEventListener('click',()=>window.__deleteClicks++);});
 for(let cycle=0;cycle<2;cycle++){
  await page.evaluate(()=>new Promise(resolve=>window.jQuery('#video_viewer').one('shown.bs.modal',()=>resolve()).modal('show')));
  await expect(player).toBeVisible();
  await expect(player).toHaveAttribute('aria-hidden','true');
  await expect(player.locator('.modal-footer').getByRole('button',{name:'Close',exact:true})).toHaveCount(0);
  await expect(page.locator(playbackCloseSelector)).toBeVisible();
  await page.evaluate(()=>{window.__playbackHidden=new Promise(resolve=>window.jQuery('#video_viewer').one('hidden.bs.modal',()=>resolve()));});
  await closePlaybackModal(page);
  await page.evaluate(()=>window.__playbackHidden);
  expect(await page.evaluate(()=>window.__deleteClicks)).toBe(0);
 }
});
