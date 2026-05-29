'use strict';
const { computeFailId } = require('./failId');
const { writeReport } = require('./reportWriter');
const { stripAnsi, firstLine, extractExcType, relModule } = require('./mapping');

/**
 * Vitest reporter — Testhide Report Format v1.
 *
 * vitest.config:  reporters: [['@testhide/reporters/vitest', { outputPath: 'junittests.xml' }]]
 * Options: { outputPath, suiteName, meta }
 */
class TesthideVitestReporter {
  constructor(options) {
    this._opts = options || {};
    this._root = process.cwd();
  }

  onInit(ctx) {
    try { this._root = (ctx && ctx.config && ctx.config.root) || this._root; } catch (e) { /* ignore */ }
  }

  onFinished(files) {
    const records = [];
    const walk = (tasks, filepath) => {
      for (const t of tasks || []) {
        if (t.type === 'suite' && t.tasks) {
          walk(t.tasks, filepath);
        } else if (t.type === 'test' || t.result) {
          records.push(this._mapTask(t, filepath));
        }
      }
    };
    for (const f of files || []) walk(f.tasks, f.filepath || f.name);

    const reportPath = this._opts.outputPath || process.env.TESTHIDE_REPORT_XML || 'junittests.xml';
    try {
      writeReport(reportPath, this._opts.suiteName || 'vitest', this._opts.meta || {}, records);
    } catch (e) {
      console.error('[testhide] failed to write report:', e && e.message);
    }
  }

  _suitePath(t) {
    const names = [];
    let s = t.suite;
    while (s && s.name) { names.unshift(s.name); s = s.suite; }
    return names;
  }

  _mapTask(t, filepath) {
    const { relFile, moduleId } = relModule(this._root, filepath || '');
    const ancestors = this._suitePath(t);
    const result = t.result || {};
    const name = t.name || 'test';
    const rec = {
      classname: ancestors.length ? ancestors.join('.') : moduleId,
      name,
      time: (result.duration != null ? result.duration : 0) / 1000.0,
      file: relFile, line: '',
      outcome: 'passed', failId: '', testResolution: 'Passed',
      message: '', traceback: '', skipReason: '', attachments: [], systemOut: null,
    };
    const state = result.state || (t.mode === 'skip' || t.mode === 'todo' ? 'skip' : 'pass');
    if (state === 'fail') {
      const err = (result.errors && result.errors[0]) || {};
      const stack = stripAnsi(err.stack || '');
      const msg = stripAnsi(err.message || '') || firstLine(stack) || 'Test failed';
      rec.outcome = 'failed';
      rec.testResolution = 'Unresolved';
      rec.message = msg;
      rec.traceback = stack;
      rec.failId = computeFailId(moduleId, ancestors.join('.'), name, err.name || extractExcType(stack), msg);
    } else if (state === 'skip' || state === 'todo') {
      rec.outcome = 'skipped';
      rec.testResolution = 'Skipped';
      rec.skipReason = state;
    }
    return rec;
  }
}

module.exports = TesthideVitestReporter;
module.exports.default = TesthideVitestReporter;
