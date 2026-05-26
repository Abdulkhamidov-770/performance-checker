/**
 * Web Vitals kollektori — `web-vitals` npm paketi page kontekstiga inject qilinadi.
 * onLCP/onCLS/onINP/onFCP/onTTFB callback'lari window.__PERF_VITALS__ ga yozadi.
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

let _bundleCache = null;

function loadWebVitalsBundle() {
  if (_bundleCache) return _bundleCache;
  try {
    // node_modules/web-vitals/dist/web-vitals.iife.js
    const here = dirname(fileURLToPath(import.meta.url));
    const candidates = [
      join(here, '..', '..', '..', 'node_modules', 'web-vitals', 'dist', 'web-vitals.iife.js'),
      join(process.cwd(), 'node_modules', 'web-vitals', 'dist', 'web-vitals.iife.js'),
    ];
    for (const p of candidates) {
      try {
        _bundleCache = readFileSync(p, 'utf8');
        return _bundleCache;
      } catch {}
    }
  } catch {}
  return null;
}

/**
 * Web Vitals tracking'ni page'ga inject qilish (page.goto'dan oldin chaqirilishi kerak).
 */
export async function injectWebVitals(page) {
  const bundle = loadWebVitalsBundle();
  if (!bundle) return false;

  await page.addInitScript({
    content: `
      ${bundle}
      ;(function() {
        window.__PERF_VITALS__ = { LCP: null, CLS: null, INP: null, FCP: null, TTFB: null };
        if (window.webVitals) {
          try { webVitals.onLCP(m => { window.__PERF_VITALS__.LCP = Math.round(m.value); }, { reportAllChanges: true }); } catch {}
          try { webVitals.onCLS(m => { window.__PERF_VITALS__.CLS = Math.round(m.value * 1000) / 1000; }, { reportAllChanges: true }); } catch {}
          try { webVitals.onINP(m => { window.__PERF_VITALS__.INP = Math.round(m.value); }, { reportAllChanges: true }); } catch {}
          try { webVitals.onFCP(m => { window.__PERF_VITALS__.FCP = Math.round(m.value); }); } catch {}
          try { webVitals.onTTFB(m => { window.__PERF_VITALS__.TTFB = Math.round(m.value); }); } catch {}
        }
      })();
    `,
  });
  return true;
}

/**
 * Sahifadan yig'ilgan vitals'ni oladi. TBT alohida hisoblanadi (longtask entries dan).
 */
export async function readVitalsFromPage(page) {
  const data = await page.evaluate(() => {
    const v = window.__PERF_VITALS__ || {};
    // TBT — longtask entries dan
    let tbt = 0;
    try {
      const entries = performance.getEntriesByType('longtask');
      for (const e of entries) tbt += Math.max(0, e.duration - 50);
    } catch {}
    // Navigation timing (TTFB fallback va loadEvent)
    let domContentLoaded = null, loadEvent = null, ttfbFallback = null;
    try {
      const nav = performance.getEntriesByType('navigation')[0];
      if (nav) {
        domContentLoaded = Math.round(nav.domContentLoadedEventEnd);
        loadEvent = Math.round(nav.loadEventEnd);
        ttfbFallback = Math.round(nav.responseStart - nav.requestStart);
      }
    } catch {}
    return {
      ...v,
      TBT: Math.round(tbt),
      TTFB: v.TTFB ?? ttfbFallback,
      domContentLoaded,
      loadEvent,
    };
  }).catch(() => ({}));
  return data;
}
