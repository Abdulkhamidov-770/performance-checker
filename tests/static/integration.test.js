/**
 * Qatlam 1 to'liq integratsiya testi — fixture loyiha → barcha findings
 */
import { describe, it, expect } from 'vitest';
import { resolve } from 'path';
import { loadProjectConfig } from '../../src/config/loader.js';
import { runStaticAnalysis } from '../../src/static/index.js';

describe('Qatlam 1 integration — fixture vue-app', () => {
  it('barcha rule\'lar topilmalar qaytaradi', async () => {
    const config = await loadProjectConfig({
      project: resolve('tests/fixtures/vue-app'),
      layer: 'all',
      format: 'json',
      output: resolve('tests/fixtures/vue-app/.perf-reports'),
    });
    const result = await runStaticAnalysis(config);

    expect(result.findings.length).toBeGreaterThan(5);
    expect(result.meta.framework.framework).toBe('vue3');
    expect(result.summary).toBeDefined();
    expect(result.summary.bySeverity.critical).toBeGreaterThanOrEqual(1);

    // Layer breakdown
    const layers = new Set(result.findings.map(f => f.layer));
    expect(layers.has('lint')).toBe(true);
  });

  it('barcha findings normalized format\'da (layer, file, rule, severity, message)', async () => {
    const config = await loadProjectConfig({
      project: resolve('tests/fixtures/vue-app'),
      layer: 'lint',
      format: 'json',
    });
    const result = await runStaticAnalysis(config);

    for (const f of result.findings) {
      expect(f.layer).toBeDefined();
      expect(f.rule).toBeDefined();
      expect(['critical', 'warning', 'info']).toContain(f.severity);
      expect(typeof f.message).toBe('string');
    }
  });
});

describe('Qatlam 1 integration — fixture react-app', () => {
  it('React findings topiladi', async () => {
    const config = await loadProjectConfig({
      project: resolve('tests/fixtures/react-app'),
      layer: 'lint',
      format: 'json',
    });
    const result = await runStaticAnalysis(config);

    const ruleIds = new Set(result.findings.map(f => f.rule));
    expect([...ruleIds].some(r => r.startsWith('react/'))).toBe(true);
  });
});
