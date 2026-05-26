/**
 * Qatlam 2 — Runtime analiz orchestrator'i.
 * Playwright + CDP + web-vitals npm bilan real metrikalar.
 */
import { createBrowserSession, closeBrowser } from './playwright/browser.js';
import { injectWebVitals, readVitalsFromPage } from './metrics/web-vitals.js';
import { runLighthouse } from './metrics/lighthouse.js';
import { getScenario } from './scenarios/index.js';
import { buildRuntimeFindings } from './reporters/findings-builder.js';
import { DEFAULT_BUDGET } from '../constants.js';
import { logger } from '../utils/logger.js';

const RUNTIME_DEFAULTS = {
  LCP: DEFAULT_BUDGET.webVitals.LCP,
  INP: DEFAULT_BUDGET.webVitals.INP,
  CLS: DEFAULT_BUDGET.webVitals.CLS,
  FCP: DEFAULT_BUDGET.webVitals.FCP,
  TTFB: DEFAULT_BUDGET.webVitals.TTFB,
  TBT: DEFAULT_BUDGET.webVitals.TBT,
  lighthouseScore: DEFAULT_BUDGET.runtime.lighthouseScore,
  longTaskCount: DEFAULT_BUDGET.runtime.longTaskCount,
  totalTransferSize: DEFAULT_BUDGET.runtime.totalTransferSize,
  jsTransferSize: DEFAULT_BUDGET.runtime.jsTransferSize,
  imageTransferSize: DEFAULT_BUDGET.runtime.imageTransferSize,
  maxComponentRenders: DEFAULT_BUDGET.runtime.maxComponentRenders,
};

export async function runRuntimeAnalysis(config) {
  const {
    url,
    scenario: scenarioName = 'desktop',
    framework = 'vue',
    runs = 3,
    budget = {},
    lighthouse: runLH = true,
    userDataDir,
    chromeProfile,
    headed,
  } = config;

  const scenario = getScenario(scenarioName);
  const meta = {
    url,
    scenario: scenarioName,
    framework,
    runs,
    analyzedAt: new Date().toISOString(),
  };

  logger.info(`\n🌐  URL: ${url}`);
  logger.info(`📱  Stsenariy: ${scenarioName} (${scenario.label})`);
  logger.info(`🔁  Runs: ${runs} (trimmed mean olinadi)\n`);

  const allRuns = [];
  let renderTrackingAvailable = false;

  for (let i = 0; i < runs; i++) {
    logger.info(`   ⏱  Run ${i + 1}/${runs}...`);
    let session = null;
    try {
      session = await createBrowserSession(scenario, {
        userDataDir,
        chromeProfile,
        headless: !headed,
      });
      const runData = await collectSingleRun(session, url, framework, scenario);
      allRuns.push(runData);
      if (runData.renders?.totalRenders > 0) renderTrackingAvailable = true;
    } catch (err) {
      logger.warn(`Run ${i + 1} xatolik: ${err.message}`);
    } finally {
      if (session) await closeBrowser(session);
    }
  }

  if (allRuns.length === 0) {
    throw new Error('Barcha runlar muvaffaqiyatsiz. URL mavjudligini tekshiring.');
  }

  if (!renderTrackingAvailable) {
    logger.warn(`Komponent render counting ma'lumot bermadi (devtools hook prod build'da o'chirilgan). Bu metric — EXPERIMENTAL. Faqat dev build'da ishonchli.`);
  }

  const aggregated = aggregateRuns(allRuns);

  // Lighthouse alohida run
  let lighthouseResult = null;
  if (runLH) {
    logger.info('\n🔦  Lighthouse analiz...');
    try {
      lighthouseResult = await runLighthouse(url, scenario);
    } catch (err) {
      logger.warn(`Lighthouse: ${err.message}`);
    }
  }

  const mergedBudget = { ...RUNTIME_DEFAULTS, ...budget };
  const findings = buildRuntimeFindings(aggregated, lighthouseResult, mergedBudget);
  const summary = buildSummary(findings, aggregated, lighthouseResult, renderTrackingAvailable);

  return { findings, summary, rawMetrics: aggregated, lighthouseResult, meta };
}

// ─── Bitta run ───────────────────────────────────────────────────────────────

async function collectSingleRun(session, url, framework, scenario) {
  const { page, cdp } = session;

  await cdp.send('Performance.enable').catch(() => {});
  await cdp.send('Network.enable').catch(() => {});

  if (scenario.network) {
    await cdp.send('Network.emulateNetworkConditions', scenario.network).catch(() => {});
  }
  if (scenario.cpuThrottling) {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: scenario.cpuThrottling }).catch(() => {});
  }

  const networkEvents = [];
  cdp.on('Network.responseReceived', e => networkEvents.push({ type: 'response', data: e }));
  cdp.on('Network.loadingFailed', e => networkEvents.push({ type: 'failed', data: e }));

  // Inject web-vitals va render tracking (page.goto'dan OLDIN)
  await injectWebVitals(page);
  await injectRenderTracking(page, framework);

  await page.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });

  // Async LCP/CLS uchun kutamiz
  await page.waitForTimeout(2500);

  const [vitals, traces, network, renders] = await Promise.all([
    readVitalsFromPage(page),
    collectTracesFromPage(cdp, page),
    collectNetworkFromPage(page, url, networkEvents),
    collectRendersFromPage(page),
  ]);

  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 }).catch(() => {});

  return { vitals, network, renders, traces };
}

async function collectTracesFromPage(cdp, page) {
  const metrics = await cdp.send('Performance.getMetrics').catch(() => ({ metrics: [] }));
  const m = {};
  for (const item of metrics.metrics || []) m[item.name] = item.value;

  const longTasks = await page.evaluate(() =>
    performance.getEntriesByType('longtask').map(e => ({
      startTime: Math.round(e.startTime),
      duration: Math.round(e.duration),
    }))
  ).catch(() => []);

  return {
    longTaskCount: longTasks.length,
    longTaskTotalMs: longTasks.reduce((s, t) => s + t.duration, 0),
    longTasks,
    mainThreadBlocked: longTasks.reduce((s, t) => s + Math.max(0, t.duration - 50), 0),
    jsHeapUsedMB: m.JSHeapUsedSize ? Math.round(m.JSHeapUsedSize / 1024 / 1024 * 10) / 10 : null,
    jsHeapTotalMB: m.JSHeapTotalSize ? Math.round(m.JSHeapTotalSize / 1024 / 1024 * 10) / 10 : null,
    domNodes: m.Nodes || null,
    jsEventListeners: m.JSEventListeners || null,
  };
}

async function collectNetworkFromPage(page, url, networkEvents) {
  const resources = await page.evaluate(() =>
    performance.getEntriesByType('resource').map(r => ({
      name: r.name,
      initiatorType: r.initiatorType,
      transferSize: r.transferSize,
      encodedBodySize: r.encodedBodySize || r.decodedBodySize || 0,
      decodedBodySize: r.decodedBodySize || 0,
      duration: Math.round(r.duration),
      cached: r.transferSize === 0 && r.encodedBodySize > 0,
    }))
  ).catch(() => []);

  const typeMap = {};
  let totalTransferKB = 0;
  const largestResources = [];
  const slowRequests = [];

  for (const r of resources) {
    const type = classifyResource(r.name, r.initiatorType);
    const sizeKB = Math.round((r.encodedBodySize || r.transferSize || 0) / 1024 * 10) / 10;
    if (!typeMap[type]) typeMap[type] = { count: 0, sizeKB: 0 };
    typeMap[type].count++;
    typeMap[type].sizeKB += sizeKB;
    totalTransferKB += sizeKB;
    largestResources.push({ url: r.name.split('?')[0].slice(-60), type, sizeKB, duration: r.duration });
    if (r.duration > 500) slowRequests.push({ url: r.name.slice(-60), duration: r.duration, type, sizeKB });
  }

  return {
    totalRequests: resources.length,
    totalTransferKB: Math.round(totalTransferKB * 10) / 10,
    byType: typeMap,
    largestResources: largestResources.sort((a, b) => b.sizeKB - a.sizeKB).slice(0, 10),
    slowRequests: slowRequests.sort((a, b) => b.duration - a.duration).slice(0, 5),
    thirdPartyRequests: 0,
    cachedRequests: resources.filter(r => r.cached || (r.transferSize === 0 && r.encodedBodySize > 0)).length,
    failedRequests: networkEvents.filter(e => e.type === 'failed').length,
  };
}

async function collectRendersFromPage(page) {
  const counts = await page.evaluate(() => window.__PERF_RENDER_COUNTS__ || {}).catch(() => ({}));
  const topRerenders = Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  return {
    totalRenders: Object.values(counts).reduce((s, n) => s + n, 0),
    componentCounts: counts,
    topRerenders,
    experimental: true,
  };
}

// ─── Render tracking inject ─────────────────────────────────────────────────

async function injectRenderTracking(page, framework) {
  await page.addInitScript((fw) => {
    window.__PERF_RENDER_COUNTS__ = {};

    if (fw === 'vue' || fw === 'vue3' || fw === 'nuxt') {
      const hook = window.__VUE_DEVTOOLS_GLOBAL_HOOK__;
      if (hook && hook.emit) {
        const orig = hook.emit.bind(hook);
        hook.emit = function(event, ...args) {
          if (event === 'component:updated' || event === 'component:mount') {
            const name = args[0]?.type?.name || args[0]?.type?.__name || 'Anonymous';
            window.__PERF_RENDER_COUNTS__[name] = (window.__PERF_RENDER_COUNTS__[name] || 0) + 1;
          }
          return orig.call(this, event, ...args);
        };
      }
    }

    if (fw === 'react' || fw === 'next') {
      if (!window.__REACT_DEVTOOLS_GLOBAL_HOOK__) window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {};
      const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
      const orig = hook.onCommitFiberRoot;
      hook.onCommitFiberRoot = function(id, root, ...args) {
        try {
          (function walk(fiber) {
            if (!fiber) return;
            if (typeof fiber.type === 'function') {
              const name = fiber.type.displayName || fiber.type.name;
              if (name && !name.startsWith('_')) {
                window.__PERF_RENDER_COUNTS__[name] = (window.__PERF_RENDER_COUNTS__[name] || 0) + 1;
              }
            }
            walk(fiber.child);
            walk(fiber.sibling);
          })(root.current);
        } catch {}
        if (orig) return orig.call(this, id, root, ...args);
      };
    }
  }, framework);
}

// ─── Trimmed mean ────────────────────────────────────────────────────────────

/**
 * Bir nechta runlardan trimmed mean / median.
 * N >= 5 da 10% trimmed mean, N < 5 da median.
 */
export function aggregateRuns(runs) {
  if (runs.length === 1) return runs[0];

  const vKeys = Object.keys(runs[0].vitals || {});
  const vitals = {};
  for (const k of vKeys) {
    vitals[k] = trimmedMean(runs.map(r => r.vitals?.[k]));
  }

  return {
    vitals,
    network: runs[0].network,
    renders: runs[0].renders,
    traces: {
      longTaskCount: roundOrNull(trimmedMean(runs.map(r => r.traces?.longTaskCount))),
      longTaskTotalMs: roundOrNull(trimmedMean(runs.map(r => r.traces?.longTaskTotalMs))),
      longTasks: runs[0].traces?.longTasks || [],
      mainThreadBlocked: roundOrNull(trimmedMean(runs.map(r => r.traces?.mainThreadBlocked))),
      jsHeapUsedMB: trimmedMean(runs.map(r => r.traces?.jsHeapUsedMB)),
      jsHeapTotalMB: trimmedMean(runs.map(r => r.traces?.jsHeapTotalMB)),
      domNodes: roundOrNull(trimmedMean(runs.map(r => r.traces?.domNodes))),
      jsEventListeners: roundOrNull(trimmedMean(runs.map(r => r.traces?.jsEventListeners))),
    },
  };
}

export function trimmedMean(arr, pct = 0.1) {
  const cleaned = arr.filter(v => v != null && Number.isFinite(v));
  if (cleaned.length === 0) return null;
  if (cleaned.length < 5) return median(cleaned);
  const sorted = [...cleaned].sort((a, b) => a - b);
  // Kamida 1 ta har tomondan trim (5 ta uchun ham outlier'ni o'chirish uchun)
  const trim = Math.max(1, Math.floor(sorted.length * pct));
  const trimmed = sorted.slice(trim, sorted.length - trim);
  if (trimmed.length === 0) return median(sorted);
  return trimmed.reduce((s, v) => s + v, 0) / trimmed.length;
}

function median(arr) {
  if (!arr.length) return null;
  const m = Math.floor(arr.length / 2);
  return arr.length % 2 ? arr[m] : (arr[m - 1] + arr[m]) / 2;
}

function roundOrNull(v) {
  return v == null ? null : Math.round(v);
}

// ─── Summary ─────────────────────────────────────────────────────────────────

function buildSummary(findings, metrics, lighthouse, renderTrackingAvailable) {
  const bySeverity = { critical: 0, warning: 0, info: 0 };
  for (const f of findings) bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
  return {
    total: findings.length,
    bySeverity,
    coreWebVitals: metrics.vitals,
    lighthouseScore: lighthouse?.categories?.performance?.score
      ? Math.round(lighthouse.categories.performance.score * 100) : null,
    longTaskCount: metrics.traces?.longTaskCount || 0,
    passed: bySeverity.critical === 0,
    renderTracking: renderTrackingAvailable ? 'available' : 'unavailable (devtools hook yo\'q — production build?)',
  };
}

function classifyResource(url, type) {
  const u = url.toLowerCase();
  if (u.includes('.js')) return 'javascript';
  if (u.includes('.css')) return 'stylesheet';
  if (/\.(png|jpg|jpeg|gif|webp|avif|svg|ico)/.test(u)) return 'image';
  if (/\.(woff|woff2|ttf|eot)/.test(u)) return 'font';
  if (type === 'fetch' || type === 'xmlhttprequest') return 'api';
  return 'other';
}

export { DEFAULT_BUDGET };
