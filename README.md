# @testhide/reporters

Test reporters for **Jest, Mocha, Vitest and Playwright** that emit **Testhide-format**
(JUnit-extended) reports — so the Testhide build agent parses your results correctly and the
dashboard/AI features get full data, with zero manual XML.

Output matches the
[`testhide-pytest-plugin`](https://github.com/thuesdays/testhide-pytest-plugin) contract
(`fail_id`, `test_resolution`, `<system-out>`, suite metadata, `testhide_schema_version=1`).
Canonical spec:
[Testhide Report Format v1](https://github.com/thuesdays/testhide/blob/main/docs/specs/REPORT-FORMAT-V1.md).

## Install

```bash
npm install --save-dev @testhide/reporters
```

One package, a sub-path per framework. Options for all: `{ outputPath, suiteName, meta }`
(`outputPath` also via the `TESTHIDE_REPORT_XML` env var).

### Jest — `jest.config.js`
```js
module.exports = {
  reporters: ['default', ['@testhide/reporters/jest', { outputPath: 'junittests.xml' }]],
};
```

### Mocha — `.mocharc.json` (or CLI)
```jsonc
{ "reporter": "@testhide/reporters/mocha",
  "reporter-option": ["outputPath=junittests.xml"] }
```
```bash
mocha --reporter @testhide/reporters/mocha --reporter-options outputPath=junittests.xml
```

### Vitest — `vitest.config.ts`
```ts
export default { test: { reporters: [['@testhide/reporters/vitest', { outputPath: 'junittests.xml' }]] } };
```

### Playwright — `playwright.config.ts`
```ts
export default { reporter: [['@testhide/reporters/playwright', { outputPath: 'junittests.xml' }]] };
```

## What it captures

- Outcomes: passed / failed / skipped (and suite import errors → error, for Jest).
- `fail_id` = `md5("module.class.test.ExceptionType(message)")` — stable failure key (dedup + Jira),
  where `module` = the repo-relative test file and `class` = the describe/suite path.
- Failure message + full stack (ANSI-stripped, in CDATA), duration, source `file`/`line`
  (where the framework provides it), suite counts + your `meta` properties.

> Per-test enrichment (docstr/attachment) isn't part of these frameworks' result models and is
> omitted in v1; the core contract above is what the agent and AI features consume. With Playwright
> sharding, give each shard a distinct `outputPath` (each shard writes its own report).

## Verify (conformance)

`conformance/` vendors the canonical validator + golden fixture. `npm test` drives each reporter
with a fixed result set and validates the output via the validator (needs Python on PATH):

```bash
python conformance/validate_report.py junittests.xml
```

## Publishing (maintainers)

**Local (Windows):**
```bat
copy .env.local.example .env.local   :: then edit .env.local and add NPM_TOKEN
publish.bat
```
`publish.bat` loads `.env.local` (gitignored), runs `npm test`, then `npm publish --access public`
via a temporary `.npmrc`.

`.env.local`:
```
NPM_TOKEN=npm_...     # automation token with publish rights to the @testhide scope
```

**CI (GitHub Actions):** run the *Publish to npm* workflow (manual `workflow_dispatch`). Required
repository secret: `NPM_TOKEN`.

## License

MIT.
