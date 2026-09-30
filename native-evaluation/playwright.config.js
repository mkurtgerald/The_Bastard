'use strict';
const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({outputDir:require('node:path').resolve(process.cwd(),'test-results'),testDir:'./test/browser',timeout:120000,workers:1,retries:0,reporter:[['list']],use:{browserName:'chromium',headless:true,viewport:{width:1440,height:1000},trace:'off',screenshot:'off',video:'off'}});
