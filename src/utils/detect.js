/**
 * detect.js — Loyiha framework va bundler'ini avtomatik aniqlaydi
 * Vue 2/3, React, Vite, Webpack, Rollup ni farqlaydi
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export async function detectFramework(projectPath) {
  const pkgPath = join(projectPath, 'package.json');
  if (!existsSync(pkgPath)) {
    return { framework: 'unknown', bundler: 'unknown', version: null };
  }

  let pkg = {};
  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  } catch {
    return { framework: 'unknown', bundler: 'unknown', version: null };
  }

  const allDeps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
    ...pkg.peerDependencies,
  };

  // Framework aniqlash
  let framework = 'unknown';
  let frameworkVersion = null;

  if (allDeps['vue']) {
    framework = 'vue';
    frameworkVersion = allDeps['vue'];
    const major = parseInt(frameworkVersion.replace(/[^0-9]/, ''));
    framework = major >= 3 ? 'vue3' : 'vue2';
  } else if (allDeps['react']) {
    framework = 'react';
    frameworkVersion = allDeps['react'];
  } else if (allDeps['nuxt']) {
    framework = 'nuxt';
    frameworkVersion = allDeps['nuxt'];
  } else if (allDeps['next']) {
    framework = 'next';
    frameworkVersion = allDeps['next'];
  }

  // Bundler aniqlash
  let bundler = 'unknown';
  if (allDeps['vite'] || existsSync(join(projectPath, 'vite.config.js')) || existsSync(join(projectPath, 'vite.config.ts'))) {
    bundler = 'vite';
  } else if (allDeps['webpack'] || existsSync(join(projectPath, 'webpack.config.js'))) {
    bundler = 'webpack';
  } else if (allDeps['rollup'] || existsSync(join(projectPath, 'rollup.config.js'))) {
    bundler = 'rollup';
  } else if (allDeps['@vue/cli-service']) {
    bundler = 'vue-cli';
  }

  // TypeScript
  const hasTypeScript = !!(allDeps['typescript'] || existsSync(join(projectPath, 'tsconfig.json')));

  // Package manager
  let packageManager = 'npm';
  if (existsSync(join(projectPath, 'pnpm-lock.yaml'))) packageManager = 'pnpm';
  else if (existsSync(join(projectPath, 'yarn.lock'))) packageManager = 'yarn';
  else if (existsSync(join(projectPath, 'bun.lockb'))) packageManager = 'bun';

  return {
    framework,
    frameworkVersion,
    bundler,
    hasTypeScript,
    packageManager,
    name: pkg.name || 'unknown',
    version: pkg.version || '0.0.0',
  };
}

export function isVue(framework) {
  return framework === 'vue2' || framework === 'vue3' || framework === 'nuxt';
}

export function isReact(framework) {
  return framework === 'react' || framework === 'next';
}
