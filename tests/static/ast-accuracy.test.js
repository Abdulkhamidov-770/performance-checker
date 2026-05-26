/**
 * AST yaqinligini regex'dan ustun ko'rsatadigan testlar.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { analyzeVueFile } from '../../src/static/lint/vue-rules.js';
import { analyzeCommonFile } from '../../src/static/lint/common-rules.js';

describe('AST aniqligi — Vue', () => {
  it('Multi-line v-for (key yo\'q) — topadi (regex 2-qator oynasi topa olmasdi)', () => {
    const src = readFileSync(resolve('tests/fixtures/vue-app/src/TrickyComponent.vue'), 'utf8');
    const findings = analyzeVueFile(src, 'src/TrickyComponent.vue');
    const f = findings.find(x => x.rule === 'vue/v-for-no-key');
    expect(f).toBeDefined();
  });

  it('Comment ichidagi this.x = 1 false positive bermaydi (computed emas — method ichida)', () => {
    const src = readFileSync(resolve('tests/fixtures/vue-app/src/TrickyComponent.vue'), 'utf8');
    const findings = analyzeVueFile(src, 'src/TrickyComponent.vue');
    expect(findings.find(x => x.rule === 'vue/no-side-effect-in-computed')).toBeUndefined();
  });
});

describe('AST aniqligi — Common JS', () => {
  it('Comment ichidagi console.log false positive bermaydi', () => {
    const src = `
      // console.log('this is just a comment, do not flag')
      const x = 1;
    `;
    const findings = analyzeCommonFile(src, 'src/foo.js', { framework: 'vue3' });
    expect(findings.find(x => x.rule === 'common/no-console-in-prod')).toBeUndefined();
  });

  it('String literal ichidagi setTimeout false positive bermaydi', () => {
    const src = `const msg = "use setTimeout for delays"; export default msg;`;
    const findings = analyzeCommonFile(src, 'src/foo.js', { framework: 'vue3' });
    expect(findings.find(x => x.rule === 'common/uncleared-timer')).toBeUndefined();
  });

  it('forEach async callback ichidagi await — loop emas (Promise.all kerak emas, undefined behaviour)', () => {
    const src = `
      async function run(items) {
        items.forEach(async (item) => {
          await fetch(item);
        });
      }
    `;
    const findings = analyzeCommonFile(src, 'src/foo.js', { framework: 'vue3' });
    // forEach awaitable emas — bu xatti-harakat noxush, lekin biz bu rule bilan tutmaymiz
    expect(findings.find(x => x.rule === 'common/await-in-loop')).toBeUndefined();
  });

  it('for-of ichida await — to\'g\'ri tutadi', () => {
    const src = `
      async function run(items) {
        for (const item of items) {
          await fetch(item);
        }
      }
    `;
    const findings = analyzeCommonFile(src, 'src/foo.js', { framework: 'vue3' });
    expect(findings.find(x => x.rule === 'common/await-in-loop')).toBeDefined();
  });

  it('Named import lodash — false positive bermaydi (faqat default/namespace muammoli)', () => {
    const src = `import { debounce } from 'lodash'; export default debounce;`;
    const findings = analyzeCommonFile(src, 'src/foo.js', { framework: 'vue3' });
    expect(findings.find(x => x.rule === 'common/no-full-library-import')).toBeUndefined();
  });

  it('Default import lodash — topiladi', () => {
    const src = `import _ from 'lodash'; export default _;`;
    const findings = analyzeCommonFile(src, 'src/foo.js', { framework: 'vue3' });
    expect(findings.find(x => x.rule === 'common/no-full-library-import')).toBeDefined();
  });
});

describe('AST line/col aniqligi', () => {
  it('Finding line raqami AST loc dan keladi (regex emas)', () => {
    const src = `
const x = 1;
console.log('hello');
const y = 2;
`;
    const findings = analyzeCommonFile(src, 'src/foo.js', { framework: 'vue3' });
    const f = findings.find(x => x.rule === 'common/no-console-in-prod');
    expect(f).toBeDefined();
    expect(f.line).toBe(3);
    expect(f.col).toBeGreaterThanOrEqual(1);
  });
});
