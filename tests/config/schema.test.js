import { describe, it, expect } from 'vitest';
import { validatePerfConfig, validateProjectsConfig } from '../../src/config/schema.js';

describe('validatePerfConfig', () => {
  it('bo\'sh config — ok', () => {
    const r = validatePerfConfig({});
    expect(r.ok).toBe(true);
  });

  it('to\'g\'ri budget — ok', () => {
    const r = validatePerfConfig({
      budget: {
        bundleSize: { totalJS: 500000 },
        findings: { critical: 0, warning: 5 },
      },
    });
    expect(r.ok).toBe(true);
  });

  it('noto\'g\'ri tip — action-oriented xato', () => {
    const r = validatePerfConfig({
      budget: { bundleSize: { totalJS: 'big' } },
    });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('budget.bundleSize.totalJS');
  });

  it('manfiy son — rad etadi', () => {
    const r = validatePerfConfig({
      budget: { findings: { critical: -1 } },
    });
    expect(r.ok).toBe(false);
  });

  it('format enum — noto\'g\'ri qiymat rad', () => {
    const r = validatePerfConfig({ format: 'xml' });
    expect(r.ok).toBe(false);
  });
});

describe('validateProjectsConfig', () => {
  it('bo\'sh projects[] — rad', () => {
    const r = validateProjectsConfig({ projects: [] });
    expect(r.ok).toBe(false);
  });

  it('to\'g\'ri config — ok', () => {
    const r = validateProjectsConfig({
      concurrency: 4,
      projects: [
        { name: 'app1', path: './app1' },
        { name: 'app2', path: './app2', url: 'http://localhost:5173' },
      ],
    });
    expect(r.ok).toBe(true);
  });

  it('URL noto\'g\'ri formatda — rad', () => {
    const r = validateProjectsConfig({
      projects: [{ name: 'a', path: '.', url: 'not-a-url' }],
    });
    expect(r.ok).toBe(false);
  });

  it('framework noto\'g\'ri — rad', () => {
    const r = validateProjectsConfig({
      projects: [{ name: 'a', path: '.', framework: 'svelte' }],
    });
    expect(r.ok).toBe(false);
  });
});
