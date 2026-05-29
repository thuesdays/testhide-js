'use strict';
const crypto = require('crypto');

/**
 * Stable failure key — identical formula to the Testhide pytest/unittest/.NET plugins:
 *   md5("module.class.function.ExceptionType(message)")
 * The backend dedups and links Jira on this value, so it must match across languages.
 */
function computeFailId(moduleId, cls, func, excType, message) {
  func = String(func || '').replace(/\(.*\)$/, '');
  const klass = cls || moduleId || '';
  const raw = `${moduleId || ''}.${klass}.${func}.${excType || ''}(${message || ''})`;
  return crypto.createHash('md5').update(raw, 'utf8').digest('hex');
}

module.exports = { computeFailId };
