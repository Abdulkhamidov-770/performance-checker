/**
 * Qatlam 4 orchestrator — 30+ loyihani parallel skanlash.
 *
 * Konfiguratsiya `projects.config.js`:
 *   export default {
 *     concurrency: 4,
 *     historyDir: './.perf-history',
 *     projects: [
 *       { name: 'admin', path: './apps/admin' },
 *       { name: 'shop',  path: './apps/shop', url: 'http://localhost:5173', framework: 'vue' },
 *     ],
 *   };
 */
import { existsSync, mkdirSync, writeFileSync, readdirSync, readFileSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { pathToFileURL } from 'url';
import pLimit from 'p-limit';
import { validateProjectsConfig } from '../config/schema.js';
import { loadProjectConfig } from '../config/loader.js';
import { runStaticAnalysis } from '../static/index.js';
import { logger } from '../utils/logger.js';

/**
 * @param {Object} opts - { configPath, historyDir? }
 * @returns {Promise<Array>} har bir loyiha natijasi
 */
export async function runOrchestrator({ configPath, historyDir }) {
  const absConfig = resolve(configPath);
  if (!existsSync(absConfig)) {
    throw new Error(`projects.config.js topilmadi: ${absConfig}\n  Misol uchun papkadagi "projects.config.js" fayli yarating.`);
  }

  let raw;
  try {
    const mod = await import(pathToFileURL(absConfig).href);
    raw = mod.default || mod;
  } catch (err) {
    throw new Error(`projects.config.js yuklanmadi: ${err.message}`);
  }

  const v = validateProjectsConfig(raw);
  if (!v.ok) throw new Error(v.error);
  const cfg = v.data;

  const concurrency = cfg.concurrency || 4;
  const history = resolve(historyDir || cfg.historyDir || './.perf-history');
  mkdirSync(history, { recursive: true });

  // configPath joylashgan papka — loyiha yo'llarini shu papka relative qilamiz
  const configDir = dirname(absConfig);

  logger.info(`\n🚀  ${cfg.projects.length} ta loyiha skanlanmoqda (concurrency: ${concurrency})\n`);

  const limit = pLimit(concurrency);
  const tasks = cfg.projects.map(p =>
    limit(() => scanProject(p, configDir, history))
  );

  const results = await Promise.all(tasks);

  logger.info(`\n✅ Skan tugadi: ${results.filter(r => r.ok).length}/${results.length} muvaffaqiyatli\n`);
  return results;
}

async function scanProject(project, configDir, historyDir) {
  const startedAt = Date.now();
  const projectPath = resolve(configDir, project.path);
  const projectName = project.name;
  const result = {
    name: projectName,
    path: projectPath,
    ok: false,
    durationMs: 0,
    static: null,
    runtime: null,
    regression: false,
  };

  try {
    if (!existsSync(projectPath)) {
      throw new Error(`Loyiha yo'li mavjud emas: ${projectPath}`);
    }

    logger.info(`   ▶  [${projectName}] boshlandi`);

    // Qatlam 1 — static
    const config = await loadProjectConfig({
      project: projectPath,
      layer: 'all',
      format: 'json',
    });
    const staticResults = await runStaticAnalysis(config);
    result.static = staticResults;

    // Qatlam 2 — runtime (faqat URL bo'lsa)
    if (project.url) {
      try {
        const { runRuntimeAnalysis } = await import('../runtime/index.js');
        const runtimeResults = await runRuntimeAnalysis({
          url: project.url,
          scenario: project.scenario || 'desktop',
          framework: project.framework || config.framework?.framework || 'vue',
          runs: project.runs || 3,
          lighthouse: project.lighthouse !== false,
        });
        result.runtime = runtimeResults;
      } catch (err) {
        logger.warn(`[${projectName}] Runtime o'tkazib yuborildi: ${err.message}`);
      }
    }

    // Yagona snapshot
    const snapshot = buildSnapshot(result);
    result.snapshot = snapshot;

    // Tarixiy faylni yozish
    const projectHistoryDir = join(historyDir, sanitizeName(projectName));
    mkdirSync(projectHistoryDir, { recursive: true });
    const filename = new Date().toISOString().replace(/[:.]/g, '-') + '.json';
    writeFileSync(
      join(projectHistoryDir, filename),
      JSON.stringify(snapshot, null, 2),
      'utf8'
    );

    // Regression — oldingi natijaga nisbatan
    result.regression = detectRegression(projectHistoryDir, snapshot);

    result.ok = true;
    result.durationMs = Date.now() - startedAt;
    const reg = result.regression ? ' ⚠ REGRESSION' : '';
    logger.success(`   [${projectName}] tugadi: ${snapshot.totals.findings} finding, ${snapshot.totals.critical} critical${reg}`);
  } catch (err) {
    result.error = err.message;
    result.durationMs = Date.now() - startedAt;
    logger.error(`   [${projectName}] xato: ${err.message}`);
  }

  return result;
}

function buildSnapshot(result) {
  const staticFindings = result.static?.findings || [];
  const runtimeFindings = result.runtime?.findings || [];
  const allFindings = [...staticFindings, ...runtimeFindings];

  const vitals = result.runtime?.rawMetrics?.vitals || {};
  const lh = result.runtime?.lighthouseResult?.categories?.performance?.score;

  return {
    name: result.name,
    path: result.path,
    timestamp: new Date().toISOString(),
    framework: result.static?.meta?.framework || null,
    totals: {
      findings: allFindings.length,
      critical: allFindings.filter(f => f.severity === 'critical').length,
      warning: allFindings.filter(f => f.severity === 'warning').length,
      info: allFindings.filter(f => f.severity === 'info').length,
    },
    metrics: {
      lighthouseScore: lh != null ? Math.round(lh * 100) : null,
      LCP: vitals.LCP ?? null,
      CLS: vitals.CLS ?? null,
      INP: vitals.INP ?? null,
      FCP: vitals.FCP ?? null,
      TTFB: vitals.TTFB ?? null,
      TBT: vitals.TBT ?? null,
      bundleJSKB: extractBundleSizeKB(result.static),
    },
    findings: allFindings,
  };
}

function extractBundleSizeKB(staticResult) {
  if (!staticResult) return null;
  // Bundle layer: findings'da `js-size-over-budget` xabarida hajm bor — yaxshiroq:
  // Bundle layer stats.totalJsSize ham bor edi, lekin biz buni bundle/index.js qaytarmaydi
  // Hozircha findings'dan ekstrakt qilamiz.
  const f = staticResult.findings?.find(x => x.rule === 'bundle/js-size-over-budget');
  if (!f) return null;
  const m = f.message?.match(/(\d+(?:\.\d+)?)\s*(KB|MB)/i);
  if (!m) return null;
  const val = parseFloat(m[1]);
  return m[2].toUpperCase() === 'MB' ? val * 1024 : val;
}

/**
 * Oxirgi snapshot va undan oldingi snapshot — agar yangi yomonroq bo'lsa true.
 */
function detectRegression(projectHistoryDir, current) {
  try {
    const files = readdirSync(projectHistoryDir)
      .filter(f => f.endsWith('.json'))
      .sort();
    if (files.length < 2) return false;
    // Eng oxirgi — joriy. Undan oldingi — solishtirilayotgan.
    const prevPath = join(projectHistoryDir, files[files.length - 2]);
    const prev = JSON.parse(readFileSync(prevPath, 'utf8'));

    // Kritik findings ko'paygan
    if ((current.totals.critical ?? 0) > (prev.totals.critical ?? 0)) return true;

    // Lighthouse score 5+ ball tushgan
    if (current.metrics.lighthouseScore != null && prev.metrics.lighthouseScore != null) {
      if (prev.metrics.lighthouseScore - current.metrics.lighthouseScore >= 5) return true;
    }

    // LCP 20%+ yomonlashgan
    if (current.metrics.LCP != null && prev.metrics.LCP != null && prev.metrics.LCP > 0) {
      if ((current.metrics.LCP - prev.metrics.LCP) / prev.metrics.LCP > 0.2) return true;
    }

    return false;
  } catch {
    return false;
  }
}

function sanitizeName(name) {
  return name.replace(/[^a-zA-Z0-9_-]/g, '-');
}
