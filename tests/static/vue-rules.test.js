/**
 * Vue rules characterization tests.
 * Fixture: tests/fixtures/vue-app/src/BadComponent.vue
 *
 * Refactor (regex -> AST) qilinganda ham bu testlar yashil qolishi shart.
 * Test'lar rule ID + qaysi fayl + severity ga e'tibor beradi, aniq line raqami emas.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { analyzeVueFile } from '../../src/static/lint/vue-rules.js';

const FIXTURE_BAD = resolve('tests/fixtures/vue-app/src/BadComponent.vue');
const FIXTURE_GOOD = resolve('tests/fixtures/vue-app/src/GoodComponent.vue');
const FIXTURE_ROUTER = resolve('tests/fixtures/vue-app/src/router.js');

function analyze(path, rel) {
  const src = readFileSync(path, 'utf8');
  return analyzeVueFile(src, rel);
}

describe('Vue rules — BadComponent.vue (har rule kamida bir marta topilishi kerak)', () => {
  const findings = analyze(FIXTURE_BAD, 'src/BadComponent.vue');

  it('vue/v-for-no-key topiladi', () => {
    const f = findings.find(x => x.rule === 'vue/v-for-no-key');
    expect(f).toBeDefined();
    expect(f.severity).toBe('critical');
    expect(f.file).toBe('src/BadComponent.vue');
    expect(typeof f.line).toBe('number');
    expect(f.line).toBeGreaterThan(0);
  });

  it('vue/no-v-if-v-for-same-element topiladi', () => {
    const f = findings.find(x => x.rule === 'vue/no-v-if-v-for-same-element');
    expect(f).toBeDefined();
    expect(f.severity).toBe('critical');
  });

  it('vue/no-inline-object-in-template topiladi', () => {
    const f = findings.find(x => x.rule === 'vue/no-inline-object-in-template');
    expect(f).toBeDefined();
    expect(f.severity).toBe('warning');
  });

  it('vue/prefer-v-show-for-toggle topiladi (isOpen pattern)', () => {
    const f = findings.find(x => x.rule === 'vue/prefer-v-show-for-toggle');
    expect(f).toBeDefined();
    expect(f.severity).toBe('info');
  });

  it('vue/no-side-effect-in-computed topiladi (this.lastCheck = ...)', () => {
    const f = findings.find(x => x.rule === 'vue/no-side-effect-in-computed');
    expect(f).toBeDefined();
    expect(f.severity).toBe('critical');
  });

  it('vue/watch-deep-immediate topiladi (deep + immediate)', () => {
    const f = findings.find(x => x.rule === 'vue/watch-deep-immediate');
    expect(f).toBeDefined();
    expect(f.severity).toBe('warning');
  });

  it('vue/no-emit-in-loop topiladi (for ichida $emit)', () => {
    const f = findings.find(x => x.rule === 'vue/no-emit-in-loop');
    expect(f).toBeDefined();
    expect(f.severity).toBe('warning');
  });

  it('vue/no-complex-expression-in-template topiladi (ternary + chained access)', () => {
    const f = findings.find(x => x.rule === 'vue/no-complex-expression-in-template');
    expect(f).toBeDefined();
    expect(f.severity).toBe('warning');
  });

  it('har bir finding kontrakt formatiga mos (file, line, rule, severity, message)', () => {
    for (const f of findings) {
      expect(f).toHaveProperty('file');
      expect(f).toHaveProperty('rule');
      expect(f).toHaveProperty('severity');
      expect(f).toHaveProperty('message');
      expect(['critical', 'warning', 'info']).toContain(f.severity);
    }
  });
});

describe('Vue rules — GoodComponent.vue (toza kod — false positive bo\'lmasin)', () => {
  const findings = analyze(FIXTURE_GOOD, 'src/GoodComponent.vue');

  it('v-for-no-key topilmasligi kerak (key bor)', () => {
    expect(findings.find(x => x.rule === 'vue/v-for-no-key')).toBeUndefined();
  });

  it('no-v-if-v-for-same-element topilmasligi kerak', () => {
    expect(findings.find(x => x.rule === 'vue/no-v-if-v-for-same-element')).toBeUndefined();
  });

  it('no-side-effect-in-computed topilmasligi kerak (pure computed)', () => {
    expect(findings.find(x => x.rule === 'vue/no-side-effect-in-computed')).toBeUndefined();
  });
});

describe('Vue rules — router.js (sync route import)', () => {
  it('vue/no-sync-route-import topiladi', () => {
    const findings = analyze(FIXTURE_ROUTER, 'src/router.js');
    const f = findings.find(x => x.rule === 'vue/no-sync-route-import');
    expect(f).toBeDefined();
    expect(f.severity).toBe('critical');
  });
});
