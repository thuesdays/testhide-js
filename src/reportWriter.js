'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

const SCHEMA_VERSION = '1';

function escAttr(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/\r/g, '&#xD;').replace(/\n/g, '&#xA;').replace(/\t/g, '&#x9;');
}

function escText(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Strip XML-1.0-illegal control chars (keeps tab/newline/CR + valid Unicode). */
function clean(s) {
  if (!s) return '';
  let out = '';
  for (const ch of String(s)) {
    const c = ch.codePointAt(0);
    if (c === 0x09 || c === 0x0A || c === 0x0D ||
        (c >= 0x20 && c <= 0xD7FF) || (c >= 0xE000 && c <= 0xFFFD) ||
        (c >= 0x10000 && c <= 0x10FFFF)) {
      out += ch;
    }
  }
  return out;
}

function cdata(s) {
  return '<![CDATA[' + clean(s).replace(/]]>/g, ']]]]><![CDATA[>') + ']]>';
}

function hostname() {
  try { return os.hostname(); } catch (e) { return 'unknown'; }
}

function ipAddress() {
  try {
    const ifaces = os.networkInterfaces();
    for (const name of Object.keys(ifaces)) {
      for (const ni of ifaces[name] || []) {
        if (ni.family === 'IPv4' && !ni.internal) return ni.address;
      }
    }
  } catch (e) { /* ignore */ }
  return '0.0.0.0';
}

/**
 * record: { classname, name, time(sec), outcome('passed'|'failed'|'error'|'skipped'|'xfail'),
 *           file, line, failId, testResolution, message, traceback, skipReason,
 *           docstr?, info?, jira?, attachments[], systemOut? }
 */
function buildTestcase(rec) {
  const lines = [];
  lines.push(
    `\t\t<testcase classname="${escAttr(rec.classname)}" name="${escAttr(rec.name)}"` +
    ` file="${escAttr(rec.file || '')}" line="${escAttr(rec.line || '')}"` +
    ` time="${(Number(rec.time) || 0).toFixed(3)}" fail_id="${escAttr(rec.failId || '')}"` +
    ` test_resolution="${escAttr(rec.testResolution || 'Unresolved')}">`
  );

  if (rec.outcome === 'failed' || rec.outcome === 'xfail') {
    lines.push(`\t\t\t<failure message="${escAttr(rec.message)}">${rec.traceback ? cdata(rec.traceback) : ''}</failure>`);
  } else if (rec.outcome === 'error') {
    lines.push(`\t\t\t<error message="${escAttr(rec.message)}">${rec.traceback ? cdata(rec.traceback) : ''}</error>`);
  } else if (rec.outcome === 'skipped') {
    const reason = rec.skipReason || rec.message || '';
    lines.push(`\t\t\t<skipped type="skip" message="${escAttr(reason)}">${escText(reason)}</skipped>`);
  }

  const props = [];
  if (rec.docstr) props.push(['docstr', rec.docstr]);
  for (const a of rec.attachments || []) if (a) props.push(['attachment', a]);
  if (rec.info) props.push(['info', rec.info]);
  if (rec.jira) props.push(['jira', rec.jira]);
  if (props.length) {
    lines.push('\t\t\t<properties>');
    for (const [n, v] of props) {
      lines.push(`\t\t\t\t<property name="${escAttr(n)}" value="${escAttr(v)}" />`);
    }
    lines.push('\t\t\t</properties>');
  }

  if (rec.systemOut) {
    lines.push(`\t\t\t<system-out>${escText(clean(rec.systemOut))}</system-out>`);
  }

  lines.push('\t\t</testcase>');
  return lines.join('\n');
}

function writeReport(reportPath, suiteName, metadata, records) {
  const abs = path.resolve(reportPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });

  let failures = 0, errors = 0, skipped = 0, totalTime = 0;
  for (const r of records) {
    totalTime += Number(r.time) || 0;
    if (r.outcome === 'failed' || r.outcome === 'xfail') failures++;
    else if (r.outcome === 'error') errors++;
    else if (r.outcome === 'skipped') skipped++;
  }

  const ts = new Date().toISOString().replace(/Z$/, 'Z'); // ISO-8601 UTC with Z
  const out = [];
  out.push('<?xml version="1.0" encoding="utf-8"?>');
  out.push('<testsuites>');
  out.push(
    `\t<testsuite name="${escAttr(suiteName)}" timestamp="${escAttr(ts)}" hostname="${escAttr(hostname())}"` +
    ` tests="${records.length}" failures="${failures}" errors="${errors}" skipped="${skipped}"` +
    ` time="${totalTime.toFixed(3)}">`
  );
  out.push('\t\t<properties>');
  out.push(`\t\t\t<property name="testhide_schema_version" value="${SCHEMA_VERSION}" />`);
  out.push(`\t\t\t<property name="ip_address" value="${escAttr(ipAddress())}" />`);
  out.push(`\t\t\t<property name="hostname" value="${escAttr(hostname())}" />`);
  for (const k of Object.keys(metadata || {})) {
    out.push(`\t\t\t<property name="${escAttr(k)}" value="${escAttr(metadata[k])}" />`);
  }
  out.push('\t\t</properties>');

  for (const r of records) out.push(buildTestcase(r));

  out.push('\t</testsuite>');
  out.push('</testsuites>');
  out.push('');

  const tmp = abs + '.tmp';
  fs.writeFileSync(tmp, out.join('\n'), 'utf8');
  fs.renameSync(tmp, abs);
}

module.exports = { writeReport, SCHEMA_VERSION, clean };
