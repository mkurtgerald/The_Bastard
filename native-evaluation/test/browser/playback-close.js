'use strict';
const {expect}=require('@playwright/test');
const playbackCloseSelector='#video_viewer .modal-footer button[type="button"][data-dismiss="modal"]';
async function closePlaybackModal(page){
 // The preserved Bootstrap 3 modal stays aria-hidden="true" while visibly open.
 // Select its actual Close button without hiding strictness or actionability failures.
 const close=page.locator(playbackCloseSelector);
 await expect(close).toHaveCount(1);
 await expect(close).toHaveText('Close');
 await expect(close).toBeVisible();
 await close.click();
 await expect(page.locator('#video_viewer')).not.toBeVisible();
}
module.exports={closePlaybackModal,playbackCloseSelector};
