/**
 * perf.config.js — Performance checker konfiguratsiyasi
 * Bu faylni loyiha root'iga joylang va o'zingizga moslang.
 *
 * Ishlatish:
 *   perf-check --config ./perf.config.js
 */

export default {
  // Tekshiriladigan loyiha papkasi
  project: '.',

  // Qaysi qatlamlarni ishlatish: 'lint', 'bundle', 'deps', yoki hammasi
  layers: ['lint', 'bundle', 'deps'],

  // Hisobot formati: 'console', 'json', 'html', 'all'
  format: 'console',

  // Hisobotlar saqlanadigan papka
  outputDir: './perf-reports',

  // Performance budget — bu chegaralardan oshsa CI bloklaydi
  budget: {
    bundleSize: {
      totalJS: 500 * 1024,     // 500KB — jami JS (gzip oldidan)
      totalCSS: 100 * 1024,    // 100KB — jami CSS
      initialJS: 200 * 1024,   // 200KB — initial chunk (birinchi yuklanish)
    },
    findings: {
      critical: 0,             // Birorta ham critical bo'lmasin (CI block)
      warning: 15,             // 15 tagacha warning — ok
    },
  },
};
