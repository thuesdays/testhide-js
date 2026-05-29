'use strict';
const { computeFailId } = require('./failId');
const { writeReport } = require('./reportWriter');
const { stripAnsi, firstLine, extractExcType, relModule } = require('./mapping');

/**
 * Playwright reporter — Testhide Report Format v1.
 *
 * playwright.config:  reporter: [['@testhide/reporters/playwright', { outputPath: 'junittests.xml' }]]
 * Options: { outputPath, suiteName, meta }
 *
 * Note: with sharding, each shard runs its own reporter — give shards distinct outputPaths
 * (or merge afterwards), since each writes its own report.
 */
class TesthidePlaywrightReporter {
  constructor(options) {
    this._opts = options || {};
    this._records = [];
    this._root = process.cwd();
  }

  onBegin(config) {
    try { this._root = (config && config.rootDir) || this._root; } catch (e) { /* ignore */ }
  }

  onTestEnd(test, result) {
    const file = (test.location && test.location.file) || '';
    const { relFile, moduleId } = relModule(this._root, file);
    const name = test.title || 'test';
    // titlePath() ~ ['', project, fileRel, ...describe, title] — derive a best-effort describe path.
    let ancestors = [];
    try {
      const tp = (typeof test.titlePath === 'function' ? test.titlePath() : []).filter(Boolean);
      // drop the trailing test title; the leading project/file segments are noisy, keep describe-ish middle.
      ancestors = tp.slice(0, -1).filter((s) => s !== name);
    } catch (e) { /* ignore */ }

    const rec = {
      classname: ancestors.length ? ancestors.join('.') : moduleId,
      name,
      time: ((result && result.duration) || 0) / 1000.0,
      file: relFile,
      line: test.location && test.location.line != null ? String(test.location.line) : '',
      outcome: 'passed', failId: '', testResolution: 'Passed',
      message: '', traceback: '', skipReason: '', attachments: [], systemOut: null,
    };

    const status = result && result.status;
    if (status === 'skipped') {
      rec.outcome = 'skipped';
      rec.testResolution = 'Skipped';
      rec.skipReason = 'skipped';
    } else if (status === 'passed') {
      rec.outcome = 'passed';
    } else {
      // failed | timedOut | interrupted
      const err = (result && (result.error || (result.errors && result.errors[0]))) || {};
      const stack = stripAnsi(err.stack || '');
      const msg = stripAnsi(err.message || '') || firstLine(stack) || ('Test ' + (status || 'failed'));
      rec.outcome = 'failed';
      rec.testResolution = 'Unresolved';
      rec.message = msg;
      rec.traceback = stack;
      rec.failId = computeFailId(moduleId, ancestors.join('.'), name, extractExcType(stack || msg), msg);
    }
    this._records.push(rec);
  }

  onEnd() {
    const reportPath = this._opts.outputPath || process.env.TESTHIDE_REPORT_XML || 'junittests.xml';
    try {
      writeReport(reportPath, this._opts.suiteName || 'playwright', this._opts.meta || {}, this._records);
    } catch (e) {
      console.error('[testhide] failed to write report:', e && e.message);
    }
  }
}

module.exports = TesthidePlaywrightReporter;
module.exports.default = TesthidePlaywrightReporter;
