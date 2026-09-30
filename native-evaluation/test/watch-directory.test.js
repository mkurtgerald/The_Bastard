'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {execFileSync} = require('node:child_process');

test('evaluation watcher canonicalizes a space/Unicode path and receives a file event', t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bastard evaluation é watcher-'));
    t.after(() => fs.rmSync(directory, {recursive:true, force:true}));
    const helper = path.resolve(__dirname, '../../src/camera/src/tools/native-watch.js');
    const watchPath = directory.replace(/\\/g, '/') + '/';
    // A libuv native assertion aborts its process, so exercise it in a child.
    // The same test is also run with the installed bundle's Node and helper.
    const script = `
      const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
      const [helper, directory] = process.argv.slice(1);
      const originalWatch = fs.watch;
      let observed;
      fs.watch = function(directory, ...args) { observed = directory; return originalWatch.call(fs, directory, ...args); };
      let timer;
      const watcher = require(helper)(directory, {encoding:'utf8'}, (eventType, filename) => {
        if (filename !== 'generated.txt') return;
        assert.ok(eventType === 'rename' || eventType === 'change');
        watcher.close(); clearTimeout(timer); process.stdout.write('received generated file event');
      });
      assert.equal(observed, fs.realpathSync.native(path.normalize(directory)));
      timer = setTimeout(() => { watcher.close(); process.exitCode = 1; }, 5000);
      setTimeout(() => fs.writeFileSync(path.join(directory, 'generated.txt'), 'synthetic fixture'), 50);
    `;
    const output = execFileSync(process.execPath, ['-e', script, helper, watchPath], {
        encoding:'utf8', timeout:7000, stdio:['ignore', 'pipe', 'pipe']
    });
    assert.match(output, /received generated file event/);
});
