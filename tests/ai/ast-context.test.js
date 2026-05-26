import { describe, it, expect } from 'vitest';
import { resolve } from 'path';
import { extractFileContext } from '../../src/ai/extractors/ast-context.js';

const PROJECT = resolve('tests/fixtures/vue-app');

describe('extractFileContext', () => {
  it('mavjud fayl uchun kontekst chiqaradi', async () => {
    const ctx = await extractFileContext(
      { file: 'src/BadComponent.vue', line: 5, layer: 'lint' },
      PROJECT
    );
    expect(ctx.exists).toBe(true);
    expect(ctx.extractedLines).toBeTruthy();
    expect(ctx.extractedLines).toContain('>>>');
    expect(ctx.totalLines).toBeGreaterThan(0);
    expect(ctx.language).toBe('vue');
  });

  it('mavjud emas fayl uchun exists:false', async () => {
    const ctx = await extractFileContext(
      { file: 'src/nonexistent.vue', line: 1, layer: 'lint' },
      PROJECT
    );
    expect(ctx.exists).toBe(false);
  });

  it('runtime finding uchun isRuntime:true', async () => {
    const ctx = await extractFileContext(
      { rule: 'runtime/lcp-critical', file: null, layer: 'runtime' },
      PROJECT
    );
    expect(ctx.isRuntime).toBe(true);
    expect(ctx.exists).toBe(false);
  });

  it('Vue SFC bloki to\'g\'ri topiladi (script ichidagi line)', async () => {
    const ctx = await extractFileContext(
      { file: 'src/BadComponent.vue', line: 25, layer: 'lint' },
      PROJECT
    );
    expect(ctx.exists).toBe(true);
    expect(ctx.extractedLines).toBeTruthy();
  });

  it('language tildi to\'g\'ri aniqlanadi', async () => {
    const vueCtx = await extractFileContext({ file: 'src/BadComponent.vue', line: 1, layer: 'lint' }, PROJECT);
    expect(vueCtx.language).toBe('vue');

    const jsCtx = await extractFileContext({ file: 'src/common-issues.js', line: 1, layer: 'lint' }, PROJECT);
    expect(jsCtx.language).toBe('javascript');
  });
});
