# @testhide/jest-reporter

A [Jest](https://jestjs.io/) reporter that emits **Testhide-format** (JUnit-extended) test
reports, so the Testhide build agent parses your results correctly and the dashboard/AI features
get full data — with zero manual XML.

Output matches the
[`testhide-pytest-plugin`](https://github.com/thuesdays/testhide-pytest-plugin) contract
(`fail_id`, `test_resolution`, `<system-out>`, suite metadata, `testhide_schema_version=1`).
Canonical spec:
[Testhide Report Format v1](https://github.com/thuesdays/testhide/blob/main/docs/specs/REPORT-FORMAT-V1.md).

## Install

```bash
npm install --save-dev @testhide/jest-reporter
```

## Configure

In `jest.config.js`:

```js
module.exports = {
  reporters: [
    'default',
    ['@testhide/jest-reporter', {
      outputPath: 'junittests.xml',   // also via TESTHIDE_REPORT_XML env
      suiteName: 'web-tests',         // optional (default: jest)
      meta: { build: '1042', branch: 'main' },  // optional suite <properties>
    }],
  ],
};
```

Or on the CLI:

```bash
jest --reporters=default --reporters=@testhide/jest-reporter
TESTHIDE_REPORT_XML=junittests.xml jest
```

## What it captures

- Outcomes: passed / failed / pending|skipped|todo (→ skipped) / suite import errors (→ error).
- `fail_id` = `md5("module.class.test.ExceptionType(message)")` — stable failure key (dedup + Jira),
  where `module` = the test file (repo-relative), `class` = the `describe` path.
- Failure message + full stack (ANSI-stripped, in CDATA), duration, source `file`/`line`
  (line requires Jest's `--testLocationInResults`), suite counts + your `meta` properties.
- File-level console output is attached to failing tests' `<system-out>`.

> Per-test enrichment (docstr/attachment) isn't part of Jest's result model and is intentionally
> omitted in v1; the core contract above is what the agent and AI features consume.

## Verify (conformance)

`conformance/` vendors the canonical validator + golden fixture. `npm test` runs the reporter
against a fixed result set and validates the output via the validator (requires Python on PATH):

```bash
python conformance/validate_report.py junittests.xml
```

## License

MIT.
