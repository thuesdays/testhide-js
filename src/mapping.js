'use strict';
const path = require('path');

// Strip ANSI color escapes (built via fromCharCode so no raw ESC byte lives in source).
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

/** Repo-relative file path (forward slashes) + dotted module id (extension stripped). */
function relModule(rootDir, filePath) {
  let relFile = filePath || '';
  try { relFile = path.relative(rootDir || process.cwd(), filePath).split(path.sep).join('/'); } catch (e) { /* keep abs */ }
  const moduleId = relFile.replace(/\.[^./]+$/, '');
  return { relFile, moduleId };
}

module.exports = { stripAnsi, firstLine, extractExcType, relModule };
