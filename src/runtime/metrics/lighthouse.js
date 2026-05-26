/**
 * Lighthouse runner — Programmatic API orqali
 * Score + audit natijalarini qaytaradi
 */
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

export async function runLighthouse(url, scenario = {}) {
  let lighthouse, chromeLauncher;

  try {
    lighthouse = (await import('lighthouse')).default;
    const cl = await import('chrome-launcher');
    chromeLauncher = cl.default || cl;
  } catch (err) {
    throw new Error('Lighthouse yoki chrome-launcher o\'rnatilmagan: npm install lighthouse chrome-launcher');
  }

  // Chrome'ni alohida ishlatamiz (Playwright bilan konflikt bo'lmasin)
  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless', '--no-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const options = {
      logLevel: 'error',
      output: 'json',
      port: chrome.port,
      // Throttling stsenariysiga qarab
      throttlingMethod: scenario.lighthouse?.throttlingMethod || 'simulate',
      throttling: scenario.lighthouse?.throttling || {
        rttMs: 40,
        throughputKbps: 10240,
        cpuSlowdownMultiplier: 1,
      },
      formFactor: scenario.lighthouse?.formFactor || 'desktop',
      screenEmulation: scenario.lighthouse?.screenEmulation || {
        mobile: false,
        width: 1280,
        height: 800,
        deviceScaleFactor: 1,
        disabled: false,
      },
    };

    const runnerResult = await lighthouse(url, options);
    const report = runnerResult.lhr;

    // Muhim auditlarni chiqarib olamiz
    const audits = {};
    const keyAudits = [
      'first-contentful-paint',
      'largest-contentful-paint',
      'total-blocking-time',
      'cumulative-layout-shift',
      'speed-index',
      'interactive',
      'server-response-time',
      'render-blocking-resources',
      'unused-javascript',
      'unused-css-rules',
      'uses-optimized-images',
      'uses-webp-images',
      'efficiently-loaded-third-party',
      'unminified-javascript',
      'unminified-css',
      'uses-text-compression',
      'uses-long-cache-ttl',
      'dom-size',
      'no-document-write',
      'bootup-time',
      'mainthread-work-breakdown',
      'uses-passive-event-listeners',
    ];

    for (const auditId of keyAudits) {
      const audit = report.audits[auditId];
      if (!audit) continue;
      audits[auditId] = {
        score: audit.score,
        displayValue: audit.displayValue,
        numericValue: audit.numericValue,
        description: audit.description,
        // Failing items (fayllar ro'yxati)
        items: audit.details?.items?.slice(0, 5)?.map(item => ({
          url: item.url || item.source?.url || null,
          wastedMs: item.wastedMs || null,
          wastedBytes: item.wastedBytes || null,
          totalBytes: item.totalBytes || null,
        })) || [],
      };
    }

    return {
      categories: {
        performance: report.categories.performance,
        accessibility: report.categories.accessibility,
        'best-practices': report.categories['best-practices'],
        seo: report.categories.seo,
      },
      audits,
      fetchTime: report.fetchTime,
      userAgent: report.userAgent,
    };

  } finally {
    await chrome.kill();
  }
}
