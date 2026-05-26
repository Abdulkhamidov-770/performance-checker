import { describe, it, expect } from 'vitest';
import { resolve } from 'path';
import { detectFramework, isVue, isReact } from '../../src/utils/detect.js';

describe('detectFramework', () => {
  it('Vue 3 ni aniqlaydi', async () => {
    const fw = await detectFramework(resolve('tests/fixtures/vue-app'));
    expect(fw.framework).toBe('vue3');
    expect(fw.bundler).toBe('vite');
    expect(fw.name).toBe('fixture-vue-app');
  });

  it('React ni aniqlaydi', async () => {
    const fw = await detectFramework(resolve('tests/fixtures/react-app'));
    expect(fw.framework).toBe('react');
    expect(fw.bundler).toBe('vite');
  });

  it('package.json yo\'q bo\'lsa unknown qaytaradi', async () => {
    const fw = await detectFramework(resolve('tests/fixtures'));
    expect(fw.framework).toBe('unknown');
  });
});

describe('isVue / isReact', () => {
  it('isVue: vue2, vue3, nuxt', () => {
    expect(isVue('vue2')).toBe(true);
    expect(isVue('vue3')).toBe(true);
    expect(isVue('nuxt')).toBe(true);
    expect(isVue('react')).toBe(false);
  });

  it('isReact: react, next', () => {
    expect(isReact('react')).toBe(true);
    expect(isReact('next')).toBe(true);
    expect(isReact('vue3')).toBe(false);
  });
});
