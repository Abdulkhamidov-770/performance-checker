import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { resolve, join } from 'path';
import { generateDashboard } from '../../src/dashboard/index.js';

const HISTORY = resolve('tests/fixtures/.perf-history-dashboard');
const OUTPUT = resolve('tests/fixtures/.dashboard-out');

const SNAP_1 = {
  name: 'app-a',
  path: '/x/a',
  timestamp: '2025-01-01T10:00:00.000Z',
  framework: { framework: 'vue3', bundler: 'vite' },
  totals: { findings: 5, critical: 1, warning: 3, info: 1 },
  metrics: { lighthouseScore: 85, LCP: 1500, CLS: 0.05, INP: 100, FCP: 800, TTFB: 200, TBT: 50, bundleJSKB: 300 },
  findings: [
    { severity: 'critical', rule: 'vue/v-for-no-key', file: 'src/A.vue', line: 5, message: 'no key' },
  ],
};
const SNAP_2 = {
  ...SNAP_1,
  timestamp: '2025-01-02T10:00:00.000Z',
  totals: { findings: 7, critical: 3, warning: 3, info: 1 },
  metrics: { ...SNAP_1.metrics, lighthouseScore: 70, LCP: 2200 },
};
const SNAP_B = {
  name: 'app-b',
  path: '/x/b',
  timestamp: '2025-01-02T11:00:00.000Z',
  framework: { framework: 'react', bundler: 'vite' },
  totals: { findings: 2, critical: 0, warning: 2, info: 0 },
  metrics: { lighthouseScore: 95, LCP: 800, CLS: 0.02 },
  findings: [],
};

beforeAll(() => {
  if (existsSync(HISTORY)) rmSync(HISTORY, { recursive: true, force: true });
  if (existsSync(OUTPUT)) rmSync(OUTPUT, { recursive: true, force: true });
  mkdirSync(join(HISTORY, 'app-a'), { recursive: true });
  mkdirSync(join(HISTORY, 'app-b'), { recursive: true });
  writeFileSync(join(HISTORY, 'app-a', '2025-01-01.json'), JSON.stringify(SNAP_1));
  writeFileSync(join(HISTORY, 'app-a', '2025-01-02.json'), JSON.stringify(SNAP_2));
  writeFileSync(join(HISTORY, 'app-b', '2025-01-02.json'), JSON.stringify(SNAP_B));
});

afterAll(() => {
  if (existsSync(HISTORY)) rmSync(HISTORY, { recursive: true, force: true });
  if (existsSync(OUTPUT)) rmSync(OUTPUT, { recursive: true, force: true });
});

describe('generateDashboard', () => {
  it('dashboard.html yaratiladi', async () => {
    const out = await generateDashboard({ historyDir: HISTORY, outputDir: OUTPUT });
    expect(existsSync(out)).toBe(true);
    expect(out.endsWith('dashboard.html')).toBe(true);
  });

  it('HTML\'da loyiha nomlari, score va regression badge bor', async () => {
    await generateDashboard({ historyDir: HISTORY, outputDir: OUTPUT });
    const html = readFileSync(join(OUTPUT, 'dashboard.html'), 'utf8');
    expect(html).toContain('app-a');
    expect(html).toContain('app-b');
    expect(html).toContain('score-good'); // app-b: 95
    expect(html).toContain('REGRESSION'); // app-a: 85 → 70 (15 ball tushdi)
  });

  it('Tarix yo\'q bo\'lsa xato', async () => {
    await expect(generateDashboard({
      historyDir: resolve('tests/fixtures/.no-such-dir'),
      outputDir: OUTPUT,
    })).rejects.toThrow(/topilmadi/);
  });

  it('Loyihalar bo\'sh bo\'lsa xato', async () => {
    const empty = resolve('tests/fixtures/.empty-history');
    mkdirSync(empty, { recursive: true });
    await expect(generateDashboard({
      historyDir: empty,
      outputDir: OUTPUT,
    })).rejects.toThrow();
    rmSync(empty, { recursive: true, force: true });
  });
});
