'use strict';
const { computeFailId } = require('./failId');
const { writeReport } = require('./reportWriter');
const { stripAnsi, firstLine, extractExcType, relModule } = require('./mapping');

/**
 * Jest reporter — Testhide Report Format v1.
 *
 * jest.config:  reporters: ['default', ['@testhide/reporters/jest', { outputPath: 'junittests.xml' }]]
 * Options: { outputPath, suiteName, meta } (outputPath also via TESTHIDE_REPORT_XML env)
 */
class TesthideJestReporter {
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
      const { relFile, moduleId } = relModule(this._rootDir, fileResult.testFilePath || '');
      const consoleOut = (fileResult.console || [])
        .map((c) => (c.type ? `[${c.type}] ` : '') + (c.message || ''))
        .join('\n');

      const assertions = fileResult.testResults || [];
      for (const a of assertions) {
        this._records.push(this._mapAssertion(a, relFile, moduleId, consoleOut));
      }
      if (assertions.length === 0 && fileResult.failureMessage) {
        this._records.push(this._mapSuiteFailure(fileResult, relFile, moduleId));
      }
    }
    try {
      writeReport(this._reportPath, this._suiteName, this._metadata, this._records);
    } catch (e) {
      console.error('[testhide] failed to write report:', e && e.message);
    }
  }

  _mapAssertion(a, relFile, moduleId, consoleOut) {
    const ancestors = a.ancestorTitles || [];
    const rec = {
      classname: ancestors.length ? ancestors.join('.') : moduleId,
      name: a.title || a.fullName || 'test',
      time: (a.duration != null ? a.duration : 0) / 1000.0,
      file: relFile,
      line: a.location && a.location.line != null ? String(a.location.line) : '',
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
        rec.failId = computeFailId(moduleId, ancestors.join('.'), rec.name, extractExcType(full), rec.message);
        if (consoleOut) rec.systemOut = consoleOut;
        break;
      }
      case 'pending': case 'skipped': case 'todo': case 'disabled':
        rec.outcome = 'skipped'; rec.testResolution = 'Skipped'; rec.skipReason = a.status; break;
      default:
        rec.outcome = 'passed'; rec.testResolution = 'Passed'; rec.failId = '';
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

  getLastError() { return undefined; }
}

module.exports = TesthideJestReporter;
module.exports.default = TesthideJestReporter;
