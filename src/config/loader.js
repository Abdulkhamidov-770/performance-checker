/**
 * Config loader — perf.config.js yoki CLI argumentlardan config yuklab beradi.
 * zod schema bilan validatsiya qilinadi.
 */
import { existsSync } from 'fs';
import { resolve } from 'path';
import { pathToFileURL } from 'url';
import { detectFramework } from '../utils/detect.js';
import { logger } from '../utils/logger.js';
import { DEFAULT_BUDGET } from '../constants.js';
import { validatePerfConfig } from './schema.js';

export { DEFAULT_BUDGET };

export async function loadProjectConfig(opts = {}) {
  let userConfig = {};

  const configPath = resolve(opts.config || './perf.config.js');
  if (existsSync(configPath)) {
    try {
      const mod = await import(pathToFileURL(configPath).href);
      userConfig = mod.default || mod;
    } catch (err) {
      throw new Error(`perf.config.js yuklanmadi: ${err.message}\n  Faylni JS ESM eksport ekanligini tekshiring.`);
    }
  }

  // Schema validatsiyasi (faqat user config — defaults har doim valid)
  if (Object.keys(userConfig).length > 0) {
    const v = validatePerfConfig(userConfig);
    if (!v.ok) {
      throw new Error(v.error);
    }
    userConfig = v.data;
  }

  const projectPath = resolve(opts.project || userConfig.project || '.');
  const framework = await detectFramework(projectPath);

  const layers = opts.layer === 'all' || !opts.layer
    ? ['lint', 'bundle', 'deps']
    : opts.layer.split(',').map(s => s.trim());

  if (opts.verbose) logger.setVerbose(true);

  return {
    projectPath,
    framework,
    layers,
    format: opts.format || userConfig.format || 'console',
    outputDir: resolve(opts.output || userConfig.outputDir || './perf-reports'),
    budget: deepMerge(DEFAULT_BUDGET, userConfig.budget || {}),
    report: opts.report || false,
    ignore: userConfig.ignore || [],
    rules: userConfig.rules || {},
    verbose: !!opts.verbose,
  };
}

function deepMerge(base, override) {
  if (!override || typeof override !== 'object') return base;
  const out = { ...base };
  for (const k of Object.keys(override)) {
    const v = override[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object') {
      out[k] = deepMerge(base[k], v);
    } else if (v !== undefined) {
      out[k] = v;
    }
  }
  return out;
}
