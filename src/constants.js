/**
 * Markaziy konstantalar — sehrli raqamlar bitta joyda.
 */

export const SEVERITY = {
  CRITICAL: 'critical',
  WARNING: 'warning',
  INFO: 'info',
};

export const LAYER = {
  LINT: 'lint',
  BUNDLE: 'bundle',
  DEPS: 'deps',
  RUNTIME: 'runtime',
  AI: 'ai',
};

export const DEFAULT_BUDGET = {
  bundleSize: {
    totalJS: 500 * 1024,
    totalCSS: 100 * 1024,
    initialJS: 200 * 1024,
  },
  lighthouse: {
    performance: 75,
    accessibility: 90,
    bestPractices: 85,
  },
  findings: {
    critical: 0,
    warning: 10,
  },
  webVitals: {
    LCP: 2500,
    INP: 200,
    CLS: 0.1,
    FCP: 1800,
    TTFB: 800,
    TBT: 200,
  },
  runtime: {
    lighthouseScore: 75,
    longTaskCount: 5,
    totalTransferSize: 1500,
    jsTransferSize: 400,
    imageTransferSize: 500,
    maxComponentRenders: 10,
    domNodes: 1500,
    jsHeapMB: 50,
  },
};

export const VUE_FRAMEWORKS = new Set(['vue2', 'vue3', 'nuxt']);
export const REACT_FRAMEWORKS = new Set(['react', 'next']);
