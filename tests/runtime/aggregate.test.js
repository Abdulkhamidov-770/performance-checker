import { describe, it, expect } from 'vitest';
import { trimmedMean, aggregateRuns } from '../../src/runtime/index.js';

describe('trimmedMean', () => {
  it('bo\'sh array → null', () => {
    expect(trimmedMean([])).toBeNull();
  });

  it('1 ta qiymat → o\'sha qiymat', () => {
    expect(trimmedMean([100])).toBe(100);
  });

  it('null/undefined qiymatlarni filterlaydi', () => {
    expect(trimmedMean([100, null, undefined, 200])).toBe(150);
  });

  it('5+ ta qiymatda 10% trim qiladi (outlier tushiriladi)', () => {
    // 5 element: 1 ta trim har tomondan. Result = mean(20,30,40)
    expect(trimmedMean([10, 20, 30, 40, 1000])).toBe(30);
  });

  it('<5 ta qiymat — median', () => {
    expect(trimmedMean([1, 100, 1000])).toBe(100);
    expect(trimmedMean([1, 100, 1000, 10000])).toBe(550);
  });

  it('NaN/Infinity tushiriladi', () => {
    expect(trimmedMean([100, NaN, Infinity, 200])).toBe(150);
  });
});

describe('aggregateRuns', () => {
  it('bitta run → o\'zi qaytariladi', () => {
    const run = { vitals: { LCP: 1000 }, network: {}, renders: {}, traces: { longTaskCount: 2 } };
    expect(aggregateRuns([run])).toEqual(run);
  });

  it('3 ta run → median vital qiymatlari', () => {
    const runs = [
      { vitals: { LCP: 1000, CLS: 0.05 }, network: {}, renders: {}, traces: { longTaskCount: 1 } },
      { vitals: { LCP: 2000, CLS: 0.10 }, network: {}, renders: {}, traces: { longTaskCount: 3 } },
      { vitals: { LCP: 3000, CLS: 0.15 }, network: {}, renders: {}, traces: { longTaskCount: 5 } },
    ];
    const result = aggregateRuns(runs);
    expect(result.vitals.LCP).toBe(2000);
    expect(result.vitals.CLS).toBeCloseTo(0.10, 3);
    expect(result.traces.longTaskCount).toBe(3);
  });

  it('outlier 5+ runda tushiriladi', () => {
    const runs = Array.from({ length: 5 }, (_, i) => ({
      vitals: { LCP: i === 4 ? 100000 : 1000 + i * 100 },
      network: {}, renders: {}, traces: { longTaskCount: 0 },
    }));
    const r = aggregateRuns(runs);
    // 100000 outlier trim qilinadi, qolgani: 1000,1100,1200,1300 dan mean
    expect(r.vitals.LCP).toBeLessThan(2000);
  });
});
