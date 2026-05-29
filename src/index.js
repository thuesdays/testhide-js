'use strict';
// Default entry re-exports the Jest reporter for back-compat
// (`require('@testhide/reporters')`). Framework-specific reporters live at
// '@testhide/reporters/jest' | '/mocha' | '/vitest' | '/playwright'.
module.exports = require('./jest');
module.exports.default = module.exports;
