/**
 * React rules characterization tests.
 * Fixtures: tests/fixtures/react-app/src/
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { analyzeReactFile } from '../../src/static/lint/react-rules.js';

const FIXTURE_BAD = resolve('tests/fixtures/react-app/src/BadComponent.jsx');
const FIXTURE_GOOD = resolve('tests/fixtures/react-app/src/GoodComponent.jsx');
const FIXTURE_ROUTER = resolve('tests/fixtures/react-app/src/router.jsx');

function analyze(path, rel) {
  const src = readFileSync(path, 'utf8');
  return analyzeReactFile(src, rel);
}

describe('React rules — BadComponent.jsx', () => {
  const findings = analyze(FIXTURE_BAD, 'src/BadComponent.jsx');

  it('react/no-inline-function-in-jsx topiladi', () => {
    const f = findings.find(x => x.rule === 'react/no-inline-function-in-jsx');
    expect(f).toBeDefined();
    expect(f.severity).toBe('warning');
  });

  it('react/no-inline-object-in-jsx topiladi (style={{...}})', () => {
    const f = findings.find(x => x.rule === 'react/no-inline-object-in-jsx');
    expect(f).toBeDefined();
    expect(f.severity).toBe('warning');
  });

  it('react/use-effect-no-deps topiladi (deps array yo\'q)', () => {
    const f = findings.find(x => x.rule === 'react/use-effect-no-deps');
    expect(f).toBeDefined();
    expect(f.severity).toBe('critical');
  });

  it('react/no-array-index-key topiladi (key={idx})', () => {
    const f = findings.find(x => x.rule === 'react/no-array-index-key');
    expect(f).toBeDefined();
    expect(f.severity).toBe('warning');
  });

  it('react/use-state-object-without-spread topiladi', () => {
    const f = findings.find(x => x.rule === 'react/use-state-object-without-spread');
    expect(f).toBeDefined();
    expect(f.severity).toBe('warning');
  });

  it('har bir finding kontrakt formatiga mos', () => {
    for (const f of findings) {
      expect(f).toHaveProperty('file');
      expect(f).toHaveProperty('rule');
      expect(f).toHaveProperty('severity');
      expect(['critical', 'warning', 'info']).toContain(f.severity);
    }
  });
});

describe('React rules — GoodComponent.jsx (toza)', () => {
  const findings = analyze(FIXTURE_GOOD, 'src/GoodComponent.jsx');

  it('no-inline-function-in-jsx topilmasligi kerak (useCallback)', () => {
    expect(findings.find(x => x.rule === 'react/no-inline-function-in-jsx')).toBeUndefined();
  });

  it('use-effect-no-deps topilmasligi kerak (deps array bor)', () => {
    expect(findings.find(x => x.rule === 'react/use-effect-no-deps')).toBeUndefined();
  });

  it('no-array-index-key topilmasligi kerak (key={item.id})', () => {
    expect(findings.find(x => x.rule === 'react/no-array-index-key')).toBeUndefined();
  });
});

describe('React rules — router.jsx', () => {
  it('react/no-sync-route-import topiladi', () => {
    const findings = analyze(FIXTURE_ROUTER, 'src/router.jsx');
    const f = findings.find(x => x.rule === 'react/no-sync-route-import');
    expect(f).toBeDefined();
    expect(f.severity).toBe('critical');
  });
});
