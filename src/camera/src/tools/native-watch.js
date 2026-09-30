'use strict';
const fs = require('node:fs');
const path = require('node:path');

// libuv's Windows watcher compares event paths with its original directory.
// Expand 8.3 aliases and use native separators before passing that directory in.
// Only evaluation mode opts in; event types and listener behavior stay unchanged.
module.exports = function watchDirectory(directory, options, listener) {
    const nativeDirectory = fs.realpathSync.native(path.normalize(directory));
    return fs.watch(nativeDirectory, options, listener);
};
