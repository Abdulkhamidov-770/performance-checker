import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, rmSync, readdirSync } from 'fs';
import { resolve, join } from 'path';
import { runOrchestrator } from '../../src/orchestrator/index.js';

const CFG = resolve('tests/fixtures/projects.config.js');
const HISTORY = resolve('tests/fixtures/.perf-history-test');

describe('Orchestrator', () => {
  beforeAll(() => {
    if (existsSync(HISTORY)) rmSync(HISTORY, { recursive: true, force: true });
  });

  afterAll(() => {
    if (existsSync(HISTORY)) rmSync(HISTORY, { recursive: true, force: true });
  });

  it('barcha loyihalarni skanlaydi va tarix saqlaydi', async () => {
    const results = await runOrchestrator({
      configPath: CFG,
      historyDir: HISTORY,
    });

    expect(results).toHaveLength(2);
    expect(results.every(r => r.ok)).toBe(true);
    // History saqlandi
    expect(existsSync(join(HISTORY, 'vue-fixture'))).toBe(true);
    expect(existsSync(join(HISTORY, 'react-fixture'))).toBe(true);
    // Har bir loyihada 1 ta snapshot
    expect(readdirSync(join(HISTORY, 'vue-fixture')).filter(f => f.endsWith('.json'))).toHaveLength(1);
  }, 30000);

  it('snapshot ichida kerakli maydonlar bor', async () => {
    // Yana bir run — regression chiqishi mumkin (yo'q, chunki o'zgartirmadik)
    const results = await runOrchestrator({
      configPath: CFG,
      historyDir: HISTORY,
    });
    const r = results.find(x => x.name === 'vue-fixture');
    expect(r.snapshot).toBeDefined();
    expect(r.snapshot.totals).toBeDefined();
    expect(r.snapshot.totals.findings).toBeGreaterThan(0);
    expect(r.snapshot.metrics).toBeDefined();
  }, 30000);
});
