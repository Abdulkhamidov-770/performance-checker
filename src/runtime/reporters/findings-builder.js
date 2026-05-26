/**
 * Runtime findings builder
 * Ham metrikalar → normalized findings (Qatlam 1 bilan bir xil format)
 * Har bir topilma: { file, line, rule, message, severity, fix, layer:'runtime' }
 */

export function buildRuntimeFindings(metrics, lighthouse, budget) {
  const findings = [];
  const { vitals, network, renders, traces } = metrics;

  // ─── Core Web Vitals ──────────────────────────────────────────────

  // LCP
  if (vitals.LCP != null) {
    if (vitals.LCP > budget.LCP * 2) {
      findings.push(finding(
        'runtime/lcp-critical',
        `LCP ${ms(vitals.LCP)} — juda sekin (limit: ${ms(budget.LCP)})`,
        'critical',
        'Eng katta elementni (rasm/heading) preload qiling. render-blocking resurslarni olib tashlang.'
      ));
    } else if (vitals.LCP > budget.LCP) {
      findings.push(finding(
        'runtime/lcp-warning',
        `LCP ${ms(vitals.LCP)} — sekin (limit: ${ms(budget.LCP)})`,
        'warning',
        "LCP elementni `fetchpriority=\"high\"` bilan belgilang. Server response time'ni tekshiring."
      ));
    }
  }

  // CLS
  if (vitals.CLS != null) {
    if (vitals.CLS > budget.CLS * 2.5) {
      findings.push(finding(
        'runtime/cls-critical',
        `CLS ${vitals.CLS} — juda yuqori (limit: ${budget.CLS})`,
        'critical',
        'Rasm va video\'ga `width`/`height` atribut qo\'sing. Font swap uchun `font-display: optional` ishlating.'
      ));
    } else if (vitals.CLS > budget.CLS) {
      findings.push(finding(
        'runtime/cls-warning',
        `CLS ${vitals.CLS} — yuqori (limit: ${budget.CLS})`,
        'warning',
        'Dinamik kontent uchun joy band qiling (skeleton, aspect-ratio). `transform` animatsiya ishlating.'
      ));
    }
  }

  // INP
  if (vitals.INP != null) {
    if (vitals.INP > budget.INP * 2.5) {
      findings.push(finding(
        'runtime/inp-critical',
        `INP ${ms(vitals.INP)} — juda sekin (limit: ${ms(budget.INP)})`,
        'critical',
        'Event handler\'larni optimize qiling. Og\'ir hisob-kitoblarni Web Worker\'ga o\'tkaring.'
      ));
    } else if (vitals.INP > budget.INP) {
      findings.push(finding(
        'runtime/inp-warning',
        `INP ${ms(vitals.INP)} — sekin (limit: ${ms(budget.INP)})`,
        'warning',
        "`requestAnimationFrame` yoki `scheduler.postTask` bilan rendering optimallashtiriladi."
      ));
    }
  }

  // FCP
  if (vitals.FCP != null && vitals.FCP > budget.FCP) {
    findings.push(finding(
      'runtime/fcp-warning',
      `FCP ${ms(vitals.FCP)} — sekin (limit: ${ms(budget.FCP)})`,
      'warning',
      'Critical CSS\'ni inline qiling. Render-blocking skriptlarni defer/async qiling.'
    ));
  }

  // TTFB
  if (vitals.TTFB != null && vitals.TTFB > budget.TTFB) {
    findings.push(finding(
      'runtime/ttfb-warning',
      `TTFB ${ms(vitals.TTFB)} — server sekin javob berayapti (limit: ${ms(budget.TTFB)})`,
      'warning',
      'CDN ishlating. Server-side caching yoqing. Database so\'rovlarini optimizatsiya qiling.'
    ));
  }

  // TBT
  if (vitals.TBT != null && vitals.TBT > budget.TBT) {
    const severity = vitals.TBT > budget.TBT * 3 ? 'critical' : 'warning';
    findings.push(finding(
      'runtime/tbt-high',
      `TBT ${ms(vitals.TBT)} — main thread ko\'p bloklanyapti (limit: ${ms(budget.TBT)})`,
      severity,
      'Katta JS chunk\'larni code splitting bilan bo\'ling. Og\'ir hisob-kitoblarni Web Worker\'ga o\'tkaring.'
    ));
  }

  // ─── Long Tasks ───────────────────────────────────────────────────

  if (traces.longTaskCount > budget.longTaskCount) {
    findings.push(finding(
      'runtime/long-tasks',
      `${traces.longTaskCount} ta Long Task topildi (limit: ${budget.longTaskCount}) — jami ${ms(traces.longTaskTotalMs)}`,
      traces.longTaskCount > budget.longTaskCount * 2 ? 'critical' : 'warning',
      'Long Task\'larni ko\'rsatayotgan scriptlarni toping va dynamic import bilan bo\'ling.'
    ));
  }

  // DOM Nodes
  if (traces.domNodes != null && traces.domNodes > 1500) {
    findings.push(finding(
      'runtime/dom-size',
      `DOM nodes soni: ${traces.domNodes} — juda ko\'p (limit: 1500)`,
      traces.domNodes > 3000 ? 'critical' : 'warning',
      'Virtual scrolling ishlating. Ko\'rinmaydigan elementlarni `v-if`/conditional rendering bilan yashiring.'
    ));
  }

  // JS Heap
  if (traces.jsHeapUsedMB != null && traces.jsHeapUsedMB > 50) {
    findings.push(finding(
      'runtime/memory-usage',
      `JS Heap: ${traces.jsHeapUsedMB}MB — yuqori xotira sarfi`,
      traces.jsHeapUsedMB > 100 ? 'critical' : 'warning',
      'Memory leak\'ni tekshiring: event listener, timer, store kuzatib boring.'
    ));
  }

  // ─── Network ──────────────────────────────────────────────────────

  if (network.totalTransferKB > budget.totalTransferSize) {
    findings.push(finding(
      'runtime/network-size',
      `Jami yuklab olingan: ${network.totalTransferKB}KB (limit: ${budget.totalTransferSize}KB)`,
      network.totalTransferKB > budget.totalTransferSize * 2 ? 'critical' : 'warning',
      'Rasm va videolarni compress qiling. Keraksiz third-party skriptlarni olib tashlang.'
    ));
  }

  // JS transfer size
  const jsSize = network.byType?.javascript?.sizeKB || 0;
  if (jsSize > budget.jsTransferSize) {
    findings.push(finding(
      'runtime/js-size',
      `JS hajmi: ${jsSize}KB (limit: ${budget.jsTransferSize}KB)`,
      jsSize > budget.jsTransferSize * 2 ? 'critical' : 'warning',
      'Tree-shaking, code splitting va lazy loading tekshiring.'
    ));
  }

  // Slow requests
  for (const req of (network.slowRequests || []).slice(0, 3)) {
    findings.push(finding(
      'runtime/slow-request',
      `Sekin so'rov: ${req.url} — ${req.duration}ms (${req.sizeKB}KB)`,
      req.duration > 3000 ? 'critical' : 'warning',
      'CDN, caching yoki lazy loading orqali tezlashtiring.'
    ));
  }

  // ─── Render counts ────────────────────────────────────────────────

  for (const { name, count } of (renders.topRerenders || []).slice(0, 5)) {
    if (count > budget.maxComponentRenders) {
      findings.push(finding(
        'runtime/excessive-renders',
        `"${name}" komponenti ${count} marta render bo'ldi (limit: ${budget.maxComponentRenders})`,
        count > budget.maxComponentRenders * 3 ? 'critical' : 'warning',
        `"${name}" komponentini \`v-memo\`/\`React.memo\` bilan memoize qiling. Props'larni tekshiring.`
      ));
    }
  }

  // ─── Lighthouse ───────────────────────────────────────────────────

  if (lighthouse) {
    const perfScore = Math.round((lighthouse.categories?.performance?.score || 0) * 100);
    if (perfScore < budget.lighthouseScore) {
      findings.push(finding(
        'runtime/lighthouse-score',
        `Lighthouse performance score: ${perfScore} (limit: ${budget.lighthouseScore})`,
        perfScore < budget.lighthouseScore - 20 ? 'critical' : 'warning',
        'Lighthouse audits natijalarini ko\'rib, eng past score\'li masalalarni hal qiling.'
      ));
    }

    // Lighthouse audit'lardan failing'larni qo'shamiz
    const failingAudits = [
      { id: 'unused-javascript', rule: 'runtime/unused-js', fix: 'Tree-shaking va dynamic import bilan ishlatilmagan JS\'ni olib tashlang.' },
      { id: 'unused-css-rules', rule: 'runtime/unused-css', fix: 'PurgeCSS yoki CSS Modules bilan ishlatilmagan CSS\'ni olib tashlang.' },
      { id: 'render-blocking-resources', rule: 'runtime/render-blocking', fix: 'Render-blocking resurs(lar)ni defer/async/preload qiling.' },
      { id: 'uses-optimized-images', rule: 'runtime/unoptimized-images', fix: 'Rasmlarni compress qiling va to\'g\'ri o\'lchamda bering.' },
      { id: 'uses-text-compression', rule: 'runtime/no-compression', fix: "Server'da gzip yoki brotli compression yoqing." },
    ];

    for (const { id, rule, fix } of failingAudits) {
      const audit = lighthouse.audits?.[id];
      if (audit && audit.score != null && audit.score < 0.9) {
        findings.push(finding(
          rule,
          `Lighthouse: ${audit.displayValue || id} (score: ${Math.round((audit.score || 0) * 100)})`,
          audit.score < 0.5 ? 'critical' : 'warning',
          fix
        ));
      }
    }
  }

  return findings.map(f => ({ ...f, layer: 'runtime' }));
}

// ─── Yordamchi funksiyalar ────────────────────────────────────────────────────

function finding(rule, message, severity, fix) {
  return { file: null, line: null, rule, message, severity, fix };
}

function ms(val) {
  return val >= 1000 ? `${(val / 1000).toFixed(1)}s` : `${val}ms`;
}
