'use strict';
const path = require('path');
const { computeFailId } = require('./failId');
const { writeReport } = require('./reportWriter');

// Strip ANSI color escapes that Jest embeds in failure messages.
// Built via fromCharCode so no raw ESC byte lives in the source.
const ANSI = new RegExp(String.fromCharCode(27) + '\\[[0-9;]*m', 'g');
function stripAnsi(s) { return String(s == null ? '' : s).replace(ANSI, ''); }

function firstLine(s) {
  if (!s) return '';
  const i = s.indexOf('\n');
  return (i >= 0 ? s.slice(0, i) : s).trim();
}

function extractExcType(s) {
  const m = /[A-Za-z_][A-Za-z0-9_.]*(?:Exception|Error)/.exec(s || '');
  return m ? m[0] : 'AssertionError';
}

/**
 * Jest reporter that emits the Testhide Report Format v1 (JUnit-extended dialect).
 *
 * jest.config:  reporters: ['default', ['@testhide/jest-reporter', { outputPath: 'junittests.xml' }]]
 * Options: { outputPath, suiteName, meta: { build, branch, ... } }
 *          (outputPath also via TESTHIDE_REPORT_XML env)
 */
class TesthideReporter {
  constructor(globalConfig, options) {
    this._globalConfig = globalConfig || {};
    this._options = options || {};
    this._records = [];
    this._reportPath = this._options.outputPath || process.env.TESTHIDE_REPORT_XML || 'junittests.xml';
    this._suiteName = this._options.suiteName || 'jest';
    this._metadata = this._options.meta || {};
    this._rootDir = this._globalConfig.rootDir || process.cwd();
  }

  onRunComplete(_contexts, results) {
    for (const fileResult of (results && results.testResults) || []) {
      const filePath = fileResult.testFilePath || '';
      let relFile = filePath;
      try { relFile = path.relative(this._rootDir, filePath).split(path.sep).join('/'); } catch (e) { /* keep abs */ }
      const moduleId = relFile.replace(/\.[^./]+$/, '');

      const consoleOut = (fileResult.console || [])
        .map((c) => (c.type ? `[${c.type}] ` : '') + (c.message || ''))
        .join('\n');

      const assertions = fileResult.testResults || [];
      for (const a of assertions) {
        this._records.push(this._mapAssertion(a, relFile, moduleId, consoleOut));
      }

      // Whole suite failed to even run (import/compile error) with no assertions.
      if (assertions.length === 0 && fileResult.failureMessage) {
        this._records.push(this._mapSuiteFailure(fileResult, relFile, moduleId));
      }
    }

    try {
      writeReport(this._reportPath, this._suiteName, this._metadata, this._records);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[testhide] failed to write report:', e && e.message);
    }
  }

  _mapAssertion(a, relFile, moduleId, consoleOut) {
    const ancestors = a.ancestorTitles || [];
    const classname = ancestors.length ? ancestors.join('.') : moduleId;
    const name = a.title || a.fullName || 'test';
    const time = (a.duration != null ? a.duration : 0) / 1000.0;
    const line = a.location && a.location.line != null ? String(a.location.line) : '';

    const rec = {
      classname, name, time, file: relFile, line,
      outcome: 'passed', failId: '', testResolution: 'Passed',
      message: '', traceback: '', skipReason: '', attachments: [], systemOut: null,
    };

    switch (a.status) {
      case 'failed': {
        const full = stripAnsi((a.failureMessages || []).join('\n\n'));
        rec.outcome = 'failed';
        rec.testResolution = 'Unresolved';
        rec.traceback = full;
        rec.message = firstLine(full) || 'Test failed';
        rec.failId = computeFailId(moduleId, ancestors.join('.'), name, extractExcType(full), rec.message);
        if (consoleOut) rec.systemOut = consoleOut;
        break;
      }
      case 'pending':
      case 'skipped':
      case 'todo':
      case 'disabled':
        rec.outcome = 'skipped';
        rec.testResolution = 'Skipped';
        rec.skipReason = a.status;
        break;
      default: // 'passed' | 'focused'
        rec.outcome = 'passed';
        rec.testResolution = 'Passed';
        rec.failId = '';
    }
    return rec;
  }

  _mapSuiteFailure(fileResult, relFile, moduleId) {
    const full = stripAnsi(fileResult.failureMessage || '');
    return {
      classname: moduleId, name: '(suite)', time: 0, file: relFile, line: '',
      outcome: 'error',
      failId: computeFailId(moduleId, moduleId, 'suite', extractExcType(full), firstLine(full)),
      testResolution: 'Collection Error',
      message: firstLine(full) || 'Suite failed to run',
      traceback: full, skipReason: '', attachments: [], systemOut: null,
    };
  }

  // Optional hook some Jest versions probe.
  getLastError() { return undefined; }
}

module.exports = TesthideReporter;
module.exports.default = TesthideReporter;
