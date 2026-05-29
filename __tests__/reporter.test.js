'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const TesthideReporter = require('../src/index');

const REPO = path.resolve(__dirname, '..');
const ESC = String.fromCharCode(27); // ANSI escape introducer; kept out of source as a literal byte.

// A fake Jest AggregatedResult covering pass / fail / pending, with ANSI escapes in the
// failure message and file-level console output — exactly the shape onRunComplete receives.
function fakeResults(rootDir) {
  const ansiFailure =
    ESC + '[2mError' + ESC + '[22m: expect(received).toBe(expected)\n' +
    '    at Object.<anonymous> (calc.test.js:10:20)';
  return {
    testResults: [
      {
        testFilePath: path.join(rootDir, '__tests__', 'calc.test.js'),
        console: [{ type: 'log', message: 'hello from test' }],
        failureMessage: null,
        testResults: [
          { title: 'adds numbers', ancestorTitles: ['Calc'], status: 'passed', duration: 10, failureMessages: [], location: { line: 5 } },
          { title: 'fails', ancestorTitles: ['Calc'], status: 'failed', duration: 20, failureMessages: [ansiFailure], location: { line: 9 } },
          { title: 'pending one', ancestorTitles: ['Calc'], status: 'pending', duration: 0, failureMessages: [] },
        ],
      },
    ],
  };
}

function runReporter() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'thjs-'));
  const out = path.join(dir, 'report.xml');
  const reporter = new TesthideReporter(
    { rootDir: REPO },
    { outputPath: out, suiteName: 'jest', meta: { build: '1042', branch: 'main' } },
  );
  reporter.onRunComplete([], fakeResults(REPO));
  return out;
}

describe('TesthideReporter', () => {
  test('emits the expected fields and counts', () => {
    const out = runReporter();
    expect(fs.existsSync(out)).toBe(true);
    const xml = fs.readFileSync(out, 'utf8');

    expect(xml).toContain('name="testhide_schema_version" value="1"');
    expect(xml).toMatch(/tests="3"/);
    expect(xml).toMatch(/failures="1"/);
    expect(xml).toMatch(/skipped="1"/);
    expect(xml).toMatch(/name="adds numbers"[^>]*fail_id=""[^>]*test_resolution="Passed"/);
    expect(xml).toMatch(/name="fails"[^>]*fail_id="[0-9a-f]{32}"[^>]*test_resolution="Unresolved"/);
    expect(xml).toContain('<failure message=');
    expect(xml).toMatch(/<skipped /);
    expect(xml).toContain('name="build" value="1042"');
    // ANSI escape sequences must be stripped (ESC char absent from output).
    expect(xml).not.toContain(ESC);
  });

  test('output conforms to the Testhide v1 conformance kit', () => {
    const out = runReporter();
    // Throws (failing the test) if the validator exits non-zero.
    execFileSync('python', [path.join(REPO, 'conformance', 'validate_report.py'), out], { stdio: 'inherit' });
  });
});
