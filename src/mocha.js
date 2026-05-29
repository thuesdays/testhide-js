'use strict';
const { computeFailId } = require('./failId');
const { writeReport } = require('./reportWriter');
const { stripAnsi, firstLine, extractExcType, relModule } = require('./mapping');

/**
 * Mocha reporter — Testhide Report Format v1.
 *
 * .mocharc / CLI:  mocha --reporter @testhide/reporters/mocha \
 *                        --reporter-options outputPath=junittests.xml
 * Programmatic: new Mocha({ reporter: '@testhide/reporters/mocha',
 *                           reporterOptions: { outputPath, suiteName, meta } })
 *
 * Implemented purely via runner events so 'mocha' is only a peer dependency.
 */
function TesthideMochaReporter(runner, options) {
  const opts = (options && options.reporterOptions) || {};
  const reportPath = opts.outputPath || process.env.TESTHIDE_REPORT_XML || 'junittests.xml';
  const suiteName = opts.suiteName || 'mocha';
  const meta = opts.meta || {};
  const rootDir = opts.rootDir || process.cwd();
  const records = [];

  function titlePath(test) {
    try { if (typeof test.titlePath === 'function') return test.titlePath(); } catch (e) { /* ignore */ }
    return [test && test.title].filter(Boolean);
  }

  function map(test, outcome, err) {
    const tp = titlePath(test);
    const name = (test && test.title) || (tp.length ? tp[tp.length - 1] : 'test');
    const ancestors = tp.slice(0, -1);
    const { relFile, moduleId } = relModule(rootDir, (test && test.file) || '');
    const rec = {
      classname: ancestors.length ? ancestors.join('.') : moduleId,
      name,
      time: ((test && test.duration) || 0) / 1000.0,
      file: relFile, line: '',
      outcome: 'passed', failId: '', testResolution: 'Passed',
      message: '', traceback: '', skipReason: '', attachments: [], systemOut: null,
    };
    if (outcome === 'failed') {
      const stack = stripAnsi((err && (err.stack || err.message)) || '');
      const msg = stripAnsi((err && err.message) || '') || firstLine(stack) || 'Test failed';
      rec.outcome = 'failed';
      rec.testResolution = 'Unresolved';
      rec.message = msg;
      rec.traceback = stack;
      rec.failId = computeFailId(moduleId, ancestors.join('.'), name, (err && err.name) || extractExcType(stack), msg);
    } else if (outcome === 'skipped') {
      rec.outcome = 'skipped';
      rec.testResolution = 'Skipped';
      rec.skipReason = 'pending';
    }
    return rec;
  }

  runner.on('pass', (test) => records.push(map(test, 'passed')));
  runner.on('pending', (test) => records.push(map(test, 'skipped')));
  runner.on('fail', (test, err) => {
    // Hook failures may not look like tests; still record them.
    records.push(map(test || {}, 'failed', err));
  });
  runner.on('end', () => {
    try { writeReport(reportPath, suiteName, meta, records); }
    catch (e) { console.error('[testhide] failed to write report:', e && e.message); }
  });
}

module.exports = TesthideMochaReporter;
module.exports.default = TesthideMochaReporter;
