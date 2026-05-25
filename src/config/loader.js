/**
 * Config loader — perf.config.js yoki CLI argumentlardan config yuklab beradi
 */
import { existsSync } from 'fs';
import { resolve } from 'path';
import { pathToFileURL } from 'url';
import { detectFramework } from '../utils/detect.js';

export const DEFAULT_BUDGET = {
  bundleSize: {
    totalJS: 500 * 1024,      // 500KB
    totalCSS: 100 * 1024,     // 100KB
    initialJS: 200 * 1024,    // 200KB — initial chunk
  },
  lighthouse: {
    performance: 75,
    accessibility: 90,
    bestPractices: 85,
  },
  findings: {
    critical: 0,               // CI'da 0 critical bo'lishi shart
    warning: 10,
  },
};

export async function loadProjectConfig(opts = {}) {
  let userConfig = {};

  const configPath = resolve(opts.config || './perf.config.js');
  if (existsSync(configPath)) {
    const mod = await import(pathToFileURL(configPath).href);
    userConfig = mod.default || mod;
  }

  const projectPath = resolve(opts.project || userConfig.project || '.');
  const framework = await detectFramework(projectPath);

  const layers = opts.layer === 'all' || !opts.layer
    ? ['lint', 'bundle', 'deps']
    : opts.layer.split(',').map(s => s.trim());

  return {
    projectPath,
    framework,
    layers,
    format: opts.format || userConfig.format || 'console',
    outputDir: resolve(opts.output || userConfig.outputDir || './perf-reports'),
    budget: { ...DEFAULT_BUDGET, ...(userConfig.budget || {}) },
    report: opts.report || false,
    ...userConfig,
  };
}
