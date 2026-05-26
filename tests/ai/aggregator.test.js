import { describe, it, expect } from 'vitest';
import { aggregateFindings } from '../../src/ai/aggregator.js';

describe('aggregateFindings', () => {
  it('bo\'sh massiv → bo\'sh natija', () => {
    expect(aggregateFindings([])).toEqual([]);
  });

  it('Critical > Warning > Info prioritetlanadi', () => {
    const findings = [
      { rule: 'a', severity: 'info', file: 'a.js', layer: 'lint' },
      { rule: 'b', severity: 'critical', file: 'b.js', layer: 'lint' },
      { rule: 'c', severity: 'warning', file: 'c.js', layer: 'lint' },
    ];
    const result = aggregateFindings(findings, 10);
    expect(result[0].severity).toBe('critical');
    expect(result[1].severity).toBe('warning');
    expect(result[2].severity).toBe('info');
  });

  it('dublikatlarni olib tashlaydi (bir xil rule + fayl)', () => {
    const findings = [
      { rule: 'r1', severity: 'critical', file: 'a.js', line: 5, layer: 'lint' },
      { rule: 'r1', severity: 'critical', file: 'a.js', line: 12, layer: 'lint' },
      { rule: 'r2', severity: 'critical', file: 'a.js', layer: 'lint' },
    ];
    const result = aggregateFindings(findings, 10);
    expect(result).toHaveLength(2);
  });

  it('max chegarasidan oshmasligi', () => {
    const findings = Array.from({ length: 30 }, (_, i) => ({
      rule: `r${i}`,
      severity: 'warning',
      file: `f${i}.js`,
      layer: 'lint',
    }));
    expect(aggregateFindings(findings, 5)).toHaveLength(5);
  });

  it('runtime findings — fayl yo\'q bo\'lsa ham kiritiladi', () => {
    const findings = [
      { rule: 'runtime/lcp-critical', severity: 'critical', file: null, layer: 'runtime' },
    ];
    expect(aggregateFindings(findings, 10)).toHaveLength(1);
  });

  it('static findings file yo\'q yoki package.json bo\'lsa filterdan o\'tmaydi', () => {
    const findings = [
      { rule: 'bundle/heavy-package', severity: 'warning', file: 'package.json', layer: 'bundle' },
      { rule: 'common/await-in-loop', severity: 'warning', file: 'src/a.js', layer: 'lint' },
    ];
    const result = aggregateFindings(findings, 10);
    expect(result.find(f => f.file === 'package.json')).toBeUndefined();
    expect(result.find(f => f.file === 'src/a.js')).toBeDefined();
  });

  it('rule_weight prioritetga ta\'sir qiladi', () => {
    const findings = [
      { rule: 'common/uncleared-timer', severity: 'warning', file: 'a.js', layer: 'lint' },
      { rule: 'vue/no-side-effect-in-computed', severity: 'warning', file: 'b.js', layer: 'lint' },
    ];
    const result = aggregateFindings(findings, 10);
    expect(result[0].rule).toBe('vue/no-side-effect-in-computed');
  });
});
