'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const EventEmitter = require('events');
const { execFileSync } = require('child_process');

const JestReporter = require('../src/jest');
const MochaReporter = require('../src/mocha');
const VitestReporter = require('../src/vitest');
const PlaywrightReporter = require('../src/playwright');

const REPO = path.resolve(__dirname, '..');
const ESC = String.fromCharCode(27);

function tmpOut() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'thjs-')), 'report.xml');
}

function validate(out) {
  // Throws (failing the test) if the conformance validator exits non-zero.
  execFileSync('python', [path.join(REPO, 'conformance', 'validate_report.py'), out], { stdio: 'inherit' });
}

function commonAssertions(xml) {
  expect(xml).toContain('name="testhide_schema_version" value="1"');
  expect(xml).toMatch(/tests="3"/);
  expect(xml).toMatch(/failures="1"/);
  expect(xml).toMatch(/skipped="1"/);
  expect(xml).toMatch(/test_resolution="Passed"/);
  expect(xml).toMatch(/fail_id="[0-9a-f]{32}"/);
  expect(xml).toContain('<failure message=');
  expect(xml).toMatch(/<skipped /);
  expect(xml).not.toContain(ESC); // ANSI stripped
}

describe('Jest reporter', () => {
  test('emits a conforming report', () => {
    const out = tmpOut();
    const results = {
      testResults: [{
        testFilePath: path.join(REPO, '__tests__', 'calc.test.js'),
        console: [{ type: 'log', message: 'hi' }],
        failureMessage: null,
        testResults: [
          { title: 'adds', ancestorTitles: ['Calc'], status: 'passed', duration: 10, failureMessages: [], location: { line: 5 } },
          { title: 'fails', ancestorTitles: ['Calc'], status: 'failed', duration: 20, failureMessages: [ESC + '[2mError' + ESC + '[22m: boom\n    at calc.test.js:10:2'], location: { line: 9 } },
          { title: 'skips', ancestorTitles: ['Calc'], status: 'pending', duration: 0, failureMessages: [] },
        ],
      }],
    };
    new JestReporter({ rootDir: REPO }, { outputPath: out, meta: { build: '1' } }).onRunComplete([], results);
    const xml = fs.readFileSync(out, 'utf8');
    commonAssertions(xml);
    validate(out);
  });
});

describe('Mocha reporter', () => {
  test('emits a conforming report', () => {
    const out = tmpOut();
    const runner = new EventEmitter();
    new MochaReporter(runner, { reporterOptions: { outputPath: out, rootDir: REPO } });
    const mk = (title, dur) => ({ title, file: path.join(REPO, 'test', 'calc.spec.js'), duration: dur, titlePath: () => ['Calc', title] });
    runner.emit('pass', mk('adds', 10));
    const err = new Error('boom'); err.stack = ESC + '[31mError[0m: boom\n    at x.js:1:1';
    runner.emit('fail', mk('fails', 20), err);
    runner.emit('pending', mk('skips', 0));
    runner.emit('end');
    const xml = fs.readFileSync(out, 'utf8');
    commonAssertions(xml);
    validate(out);
  });
});

describe('Vitest reporter', () => {
  test('emits a conforming report', () => {
    const out = tmpOut();
    const r = new VitestReporter({ outputPath: out });
    r.onInit({ config: { root: REPO } });
    const files = [{
      filepath: path.join(REPO, 'calc.test.ts'),
      tasks: [{
        type: 'suite', name: 'Calc',
        tasks: [
          { type: 'test', name: 'adds', suite: { name: 'Calc' }, result: { state: 'pass', duration: 10 } },
          { type: 'test', name: 'fails', suite: { name: 'Calc' }, result: { state: 'fail', duration: 20, errors: [{ message: 'boom', stack: 'Error: boom\n  at y', name: 'Error' }] } },
          { type: 'test', name: 'skips', suite: { name: 'Calc' }, mode: 'skip', result: { state: 'skip', duration: 0 } },
        ],
      }],
    }];
    r.onFinished(files);
    const xml = fs.readFileSync(out, 'utf8');
    commonAssertions(xml);
    validate(out);
  });
});

describe('Playwright reporter', () => {
  test('emits a conforming report', () => {
    const out = tmpOut();
    const r = new PlaywrightReporter({ outputPath: out });
    r.onBegin({ rootDir: REPO });
    const mk = (title, line) => ({ title, location: { file: path.join(REPO, 'e2e', 'login.spec.ts'), line }, titlePath: () => ['', 'chromium', 'e2e/login.spec.ts', 'Login', title] });
    r.onTestEnd(mk('adds', 10), { status: 'passed', duration: 12 });
    r.onTestEnd(mk('fails', 20), { status: 'failed', duration: 30, error: { message: 'boom', stack: 'Error: boom\n  at z' } });
    r.onTestEnd(mk('skips', 30), { status: 'skipped', duration: 0 });
    r.onEnd();
    const xml = fs.readFileSync(out, 'utf8');
    commonAssertions(xml);
    validate(out);
  });
});
