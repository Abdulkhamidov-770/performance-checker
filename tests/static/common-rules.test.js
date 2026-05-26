/**
 * Common JS/TS rules characterization tests.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { analyzeCommonFile } from '../../src/static/lint/common-rules.js';

const FIXTURE = resolve('tests/fixtures/vue-app/src/common-issues.js');

function analyze() {
  const src = readFileSync(FIXTURE, 'utf8');
  return analyzeCommonFile(src, 'src/common-issues.js', { framework: 'vue3' });
}

describe('Common rules — common-issues.js', () => {
  const findings = analyze();

  it('common/no-console-in-prod topiladi', () => {
    const f = findings.find(x => x.rule === 'common/no-console-in-prod');
    expect(f).toBeDefined();
    expect(f.severity).toBe('info');
  });

  it('common/no-full-library-import topiladi (lodash, moment)', () => {
    const all = findings.filter(x => x.rule === 'common/no-full-library-import');
    expect(all.length).toBeGreaterThanOrEqual(2);
    const messages = all.map(f => f.message).join(' ');
    expect(messages).toContain('lodash');
    expect(messages).toContain('moment');
  });

  it('common/await-in-loop topiladi (real await)', () => {
    const f = findings.find(x => x.rule === 'common/await-in-loop');
    expect(f).toBeDefined();
    expect(f.severity).toBe('warning');
  });

  it('common/uncleared-timer topiladi (setInterval clear yo\'q)', () => {
    const f = findings.find(x => x.rule === 'common/uncleared-timer');
    expect(f).toBeDefined();
    expect(f.severity).toBe('warning');
  });

  it('common/unremoved-event-listener topiladi', () => {
    const f = findings.find(x => x.rule === 'common/unremoved-event-listener');
    expect(f).toBeDefined();
    expect(f.severity).toBe('warning');
  });

  it('common/heavy-sync-computation topiladi (JSON.parse loop ichida)', () => {
    const f = findings.find(x => x.rule === 'common/heavy-sync-computation');
    expect(f).toBeDefined();
    expect(f.severity).toBe('warning');
  });
});
