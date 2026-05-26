/**
 * Runtime reporter — metrikalar + topilmalar chiroyli ko'rsatadi
 */
import { mkdirSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { exec } from 'child_process';

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m',
  red: '\x1b[31m', yellow: '\x1b[33m', blue: '\x1b[34m',
  green: '\x1b[32m', cyan: '\x1b[36m', gray: '\x1b[90m', magenta: '\x1b[35m',
};

export function printRuntimeReport(results) {
  const { findings, summary, rawMetrics, lighthouseResult, meta } = results;
  const { vitals, network, renders, traces } = rawMetrics;

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`${C.bold}  ⚡ Performance Checker — Qatlam 2 (Runtime Analiz)${C.reset}`);
  console.log(`${'═'.repeat(70)}`);
  console.log(`  URL:       ${C.cyan}${meta.url}${C.reset}`);
  console.log(`  Stsenariy: ${C.cyan}${meta.scenario}${C.reset}`);
  console.log(`  Framework: ${C.cyan}${meta.framework}${C.reset}`);
  console.log(`  Sana:      ${meta.analyzedAt}`);
  console.log(`${'─'.repeat(70)}`);

  // ─── Core Web Vitals Dashboard ────────────────────────────────────
  console.log(`\n${C.bold}  📊 Core Web Vitals${C.reset}\n`);

  const vitalRows = [
    { name: 'LCP', value: vitals.LCP, unit: 'ms', good: 2500, poor: 4000, format: ms },
    { name: 'CLS', value: vitals.CLS, unit: '',   good: 0.1,  poor: 0.25, format: v => v?.toFixed(3) },
    { name: 'INP', value: vitals.INP, unit: 'ms', good: 200,  poor: 500,  format: ms },
    { name: 'FCP', value: vitals.FCP, unit: 'ms', good: 1800, poor: 3000, format: ms },
    { name: 'TTFB', value: vitals.TTFB, unit: 'ms', good: 800, poor: 1800, format: ms },
    { name: 'TBT', value: vitals.TBT, unit: 'ms', good: 200, poor: 600,  format: ms },
  ];

  for (const row of vitalRows) {
    if (row.value == null) continue;
    const status = row.value <= row.good ? `${C.green}✓ Good${C.reset}`
      : row.value <= row.poor ? `${C.yellow}⚠ Needs Improvement${C.reset}`
      : `${C.red}✗ Poor${C.reset}`;
    const val = row.format ? row.format(row.value) : row.value;
    console.log(`  ${row.name.padEnd(6)} ${String(val).padStart(8)}   ${status}`);
  }

  // ─── Lighthouse Score ──────────────────────────────────────────────
  if (lighthouseResult) {
    const score = Math.round((lighthouseResult.categories?.performance?.score || 0) * 100);
    const accScore = Math.round((lighthouseResult.categories?.accessibility?.score || 0) * 100);
    const bpScore = Math.round((lighthouseResult.categories?.['best-practices']?.score || 0) * 100);
    const seoScore = Math.round((lighthouseResult.categories?.seo?.score || 0) * 100);
    const scoreColor = score >= 90 ? C.green : score >= 50 ? C.yellow : C.red;

    console.log(`\n${C.bold}  🔦 Lighthouse${C.reset}\n`);
    console.log(`  Performance   ${scoreColor}${score}${C.reset}   Accessibility ${accScore}`);
    console.log(`  Best Practices ${bpScore}   SEO           ${seoScore}`);
  }

  // ─── Network ──────────────────────────────────────────────────────
  console.log(`\n${C.bold}  🌐 Network${C.reset}\n`);
  console.log(`  Jami so'rovlar:  ${network.totalRequests}`);
  console.log(`  Jami transfer:   ${network.totalTransferKB}KB`);
  console.log(`  3rd party:       ${network.thirdPartyRequests} so'rov`);
  console.log(`  Cache hit:       ${network.cachedRequests} so'rov`);

  if (Object.keys(network.byType || {}).length > 0) {
    console.log(`\n  Turdagi hajmlar:`);
    for (const [type, info] of Object.entries(network.byType).sort((a, b) => b[1].sizeKB - a[1].sizeKB)) {
      const bar = '█'.repeat(Math.min(Math.round(info.sizeKB / 20), 20));
      console.log(`    ${C.gray}${type.padEnd(12)}${C.reset} ${bar} ${info.sizeKB}KB (${info.count} ta)`);
    }
  }

  // ─── Traces ───────────────────────────────────────────────────────
  console.log(`\n${C.bold}  🔬 Traces${C.reset}\n`);
  console.log(`  Long Tasks:   ${traces.longTaskCount} ta (jami ${ms(traces.longTaskTotalMs)})`);
  if (traces.domNodes) console.log(`  DOM nodes:    ${traces.domNodes}`);
  if (traces.jsHeapUsedMB) console.log(`  JS Heap:      ${traces.jsHeapUsedMB}MB`);
  if (traces.jsEventListeners) console.log(`  Event listeners: ${traces.jsEventListeners}`);

  // ─── Render Counts ─────────────────────────────────────────────────
  if ((renders.topRerenders || []).length > 0) {
    console.log(`\n${C.bold}  🔄 Komponent render'lari${C.reset}\n`);
    console.log(`  Jami render: ${renders.totalRenders}`);
    for (const { name, count } of renders.topRerenders.slice(0, 5)) {
      const bar = '█'.repeat(Math.min(count, 30));
      const color = count > 20 ? C.red : count > 10 ? C.yellow : C.green;
      console.log(`  ${color}${bar}${C.reset} ${count}x ${C.gray}${name}${C.reset}`);
    }
  }

  // ─── Findings ─────────────────────────────────────────────────────
  if (findings.length > 0) {
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`${C.bold}  📋 Topilmalar (${findings.length} ta)${C.reset}`);
    console.log(`${'─'.repeat(70)}\n`);

    const bySeverity = { critical: [], warning: [], info: [] };
    for (const f of findings) (bySeverity[f.severity] || bySeverity.info).push(f);

    const icons = { critical: `${C.red}⛔ CRITICAL${C.reset}`, warning: `${C.yellow}⚠  WARNING${C.reset}`, info: `${C.blue}ℹ  INFO${C.reset}` };

    for (const [sev, items] of Object.entries(bySeverity)) {
      if (items.length === 0) continue;
      console.log(`\n  ${icons[sev]} (${items.length} ta)\n`);
      for (const f of items) {
        console.log(`  ${C.gray}[${f.layer}]${C.reset} ${C.bold}${f.rule}${C.reset}`);
        console.log(`    📌 ${f.message}`);
        if (f.fix) console.log(`    ${C.green}💡 ${f.fix}${C.reset}`);
        console.log();
      }
    }
  }

  // ─── Final status ──────────────────────────────────────────────────
  console.log(`${'═'.repeat(70)}`);
  const critCount = findings.filter(f => f.severity === 'critical').length;
  if (critCount === 0) {
    console.log(`  ${C.green}${C.bold}✅ PASSED${C.reset}`);
  } else {
    console.log(`  ${C.red}${C.bold}❌ FAILED — ${critCount} critical topilma${C.reset}`);
  }
  console.log(`${'═'.repeat(70)}\n`);
}

export async function saveRuntimeReport(results, outputDir, format) {
  mkdirSync(outputDir, { recursive: true });

  if (format === 'json' || format === 'all') {
    const p = join(outputDir, 'runtime-report.json');
    writeFileSync(p, JSON.stringify(results, null, 2), 'utf8');
    console.log(`${C.cyan}📄 JSON: ${p}${C.reset}`);
  }

  if (format === 'html' || format === 'all') {
    const p = resolve(join(outputDir, 'runtime-report.html'));
    writeFileSync(p, generateRuntimeHTML(results), 'utf8');
    console.log(`${C.cyan}🌐 HTML: ${p}${C.reset}`);
    openInBrowser(p);
  }
}

function openInBrowser(filePath) {
  const platform = process.platform;
  let cmd;
  if (platform === 'win32') cmd = `cmd /c start "" "${filePath}"`;
  else if (platform === 'darwin') cmd = `open "${filePath}"`;
  else cmd = `xdg-open "${filePath}"`;
  exec(cmd, (err) => {
    if (!err) console.log(`${C.green}🚀 Brauzerda ochildi!${C.reset}`);
  });
}

function ms(val) {
  if (val == null) return 'N/A';
  return val >= 1000 ? `${(val / 1000).toFixed(1)}s` : `${val}ms`;
}

function generateRuntimeHTML(results) {
  const { findings, rawMetrics, lighthouseResult, meta } = results;
  const { vitals, network, renders, traces } = rawMetrics;

  const lhScore = lighthouseResult
    ? Math.round((lighthouseResult.categories?.performance?.score || 0) * 100)
    : null;

  const statusColor = (val, good, poor) =>
    val == null ? '#9ca3af' : val <= good ? '#10b981' : val <= poor ? '#f59e0b' : '#ef4444';
  const statusLabel = (val, good, poor) =>
    val == null ? 'N/A' : val <= good ? 'Good' : val <= poor ? 'Needs Improvement' : 'Poor';

  const vCard = (name, val, good, poor, fmt = ms) => val == null ? '' : `
    <div class="vcard" style="border-top:3px solid ${statusColor(val,good,poor)}">
      <div class="vname">${name}</div>
      <div class="vval" style="color:${statusColor(val,good,poor)}">${fmt(val)}</div>
      <div class="vstatus" style="color:${statusColor(val,good,poor)}">${statusLabel(val,good,poor)}</div>
      <div class="vrange">Good ≤ ${fmt(good)}</div>
    </div>`;

  const gaugeColor = s => s >= 90 ? '#10b981' : s >= 50 ? '#f59e0b' : '#ef4444';

  const networkBars = Object.entries(network.byType || {})
    .filter(([,i]) => i.sizeKB > 0)
    .sort((a,b) => b[1].sizeKB - a[1].sizeKB)
    .map(([type, info]) => {
      const colors = {javascript:'#6366f1',stylesheet:'#ec4899',image:'#f59e0b',font:'#14b8a6',api:'#8b5cf6',other:'#94a3b8'};
      const color = colors[type] || '#94a3b8';
      const pct = Math.min(info.sizeKB / (network.totalTransferKB || 1) * 100, 100);
      return `<div class="net-row">
        <div class="net-label">
          <span class="dot" style="background:${color}"></span>
          <span>${type}</span>
          <span class="net-count">${info.count} ta</span>
        </div>
        <div class="net-bar-wrap"><div class="net-bar" style="width:${pct}%;background:${color}"></div></div>
        <div class="net-size">${info.sizeKB.toFixed(1)} KB</div>
      </div>`;
    }).join('') || '<p style="color:#9ca3af;font-size:13px">Ma\'lumot yo\'q (resurslar cache\'dan keldi)</p>';

  const renderBars = (renders.topRerenders || []).slice(0, 8).map(({name, count}) => {
    const color = count > 20 ? '#ef4444' : count > 10 ? '#f59e0b' : '#10b981';
    const pct = Math.min(count / 30 * 100, 100);
    return `<div class="net-row">
      <div class="net-label"><span class="dot" style="background:${color}"></span><span>${name}</span></div>
      <div class="net-bar-wrap"><div class="net-bar" style="width:${pct}%;background:${color}"></div></div>
      <div class="net-size">${count}x</div>
    </div>`;
  }).join('');

  const traceItems = [
    { label: 'Long Tasks', value: traces.longTaskCount, unit: 'ta', warn: 5, crit: 10 },
    { label: 'DOM nodes', value: traces.domNodes, unit: '', warn: 1500, crit: 3000 },
    { label: 'JS Heap', value: traces.jsHeapUsedMB, unit: 'MB', warn: 50, crit: 100 },
    { label: 'Event listeners', value: traces.jsEventListeners, unit: '', warn: 500, crit: 1000 },
  ].filter(t => t.value != null).map(t => {
    const color = t.value >= t.crit ? '#ef4444' : t.value >= t.warn ? '#f59e0b' : '#10b981';
    return `<div class="trace-item">
      <span class="trace-label">${t.label}</span>
      <span class="trace-value" style="color:${color}">${t.value}${t.unit ? ' ' + t.unit : ''}</span>
    </div>`;
  }).join('');

  const findingRows = findings.length === 0
    ? '<tr><td colspan="4" style="text-align:center;color:#10b981;padding:20px">✅ Muammo topilmadi</td></tr>'
    : findings.map(f => {
        const bg = {critical:'#fef2f2',warning:'#fffbeb',info:'#eff6ff'}[f.severity]||'#fff';
        const color = {critical:'#dc2626',warning:'#d97706',info:'#2563eb'}[f.severity]||'#374151';
        const icon = {critical:'⛔',warning:'⚠️',info:'ℹ️'}[f.severity]||'';
        return `<tr style="background:${bg}">
          <td><span style="color:${color};font-weight:600;font-size:12px">${icon} ${f.severity}</span></td>
          <td><code style="font-size:11px;background:#f3f4f6;padding:2px 6px;border-radius:4px;color:#7c3aed">${f.rule}</code></td>
          <td style="font-size:13px">${f.message}</td>
          <td style="font-size:12px;color:#059669">${f.fix||''}</td>
        </tr>`;
      }).join('');

  const passed = findings.filter(f=>f.severity==='critical').length === 0;
  const critCount = findings.filter(f=>f.severity==='critical').length;
  const warnCount = findings.filter(f=>f.severity==='warning').length;

  return `<!DOCTYPE html>
<html lang="uz">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Runtime Hisobot — ${meta.url}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f1f5f9;color:#0f172a;min-height:100vh}
.topbar{background:linear-gradient(135deg,#1e1b4b 0%,#312e81 50%,#4c1d95 100%);padding:28px 40px;color:#fff}
.topbar h1{font-size:22px;font-weight:700;margin-bottom:6px;display:flex;align-items:center;gap:10px}
.topbar p{font-size:13px;opacity:.75}
.status-badge{display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:20px;font-size:13px;font-weight:600;margin-top:12px}
.status-pass{background:rgba(16,185,129,.2);color:#6ee7b7;border:1px solid rgba(16,185,129,.3)}
.status-fail{background:rgba(239,68,68,.2);color:#fca5a5;border:1px solid rgba(239,68,68,.3)}
.wrap{max-width:1100px;margin:0 auto;padding:28px 24px;display:grid;gap:20px}
.card{background:#fff;border-radius:16px;padding:24px;box-shadow:0 1px 4px rgba(0,0,0,.06)}
.card-title{font-size:14px;font-weight:600;color:#374151;margin-bottom:18px;display:flex;align-items:center;gap:8px}
.vitals{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px}
.vcard{background:#f8fafc;border-radius:12px;padding:16px;text-align:center;border-top:3px solid #e2e8f0;transition:transform .15s}
.vcard:hover{transform:translateY(-2px)}
.vname{font-size:11px;font-weight:600;color:#64748b;letter-spacing:.05em;text-transform:uppercase;margin-bottom:10px}
.vval{font-size:26px;font-weight:700;margin-bottom:4px}
.vstatus{font-size:11px;font-weight:600;margin-bottom:4px}
.vrange{font-size:10px;color:#94a3b8;margin-top:6px}
.lh-circle{width:80px;height:80px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;color:#fff;margin:0 auto 8px}
.net-row{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.net-label{display:flex;align-items:center;gap:6px;width:140px;font-size:13px;color:#374151}
.net-count{color:#94a3b8;font-size:11px;margin-left:auto}
.net-bar-wrap{flex:1;background:#f1f5f9;border-radius:4px;height:8px;overflow:hidden}
.net-bar{height:100%;border-radius:4px;transition:width .3s}
.net-size{width:70px;text-align:right;font-size:13px;font-weight:500;color:#374151}
.trace-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}
.trace-item{background:#f8fafc;border-radius:10px;padding:14px 16px;display:flex;justify-content:space-between;align-items:center}
.trace-label{font-size:13px;color:#64748b}
.trace-value{font-size:18px;font-weight:700}
.findings-table{width:100%;border-collapse:collapse;font-size:13px}
.findings-table th{background:#f8fafc;padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.05em;border-bottom:2px solid #e2e8f0}
.findings-table td{padding:12px 14px;border-bottom:1px solid #f1f5f9;vertical-align:top}
.summary-chips{display:flex;gap:10px;flex-wrap:wrap;margin-top:8px}
.chip{padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600}
.chip-red{background:#fef2f2;color:#dc2626}
.chip-yellow{background:#fffbeb;color:#d97706}
.chip-green{background:#f0fdf4;color:#16a34a}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:20px}
@media(max-width:640px){.grid2{grid-template-columns:1fr}}
</style>
</head>
<body>
<div class="topbar">
  <h1>⚡ Runtime Hisobot — Qatlam 2</h1>
  <p>${meta.url} &nbsp;•&nbsp; ${meta.scenario} &nbsp;•&nbsp; ${meta.framework} &nbsp;•&nbsp; ${new Date(meta.analyzedAt).toLocaleString('uz-UZ')}</p>
  <div class="status-badge ${passed ? 'status-pass' : 'status-fail'}">
    ${passed ? '✅ PASSED' : '❌ FAILED'}
  </div>
  <div class="summary-chips">
    <span class="chip chip-red">⛔ Critical: ${critCount}</span>
    <span class="chip chip-yellow">⚠️ Warning: ${warnCount}</span>
    <span class="chip chip-green">✓ Findings: ${findings.length}</span>
    ${lhScore != null ? `<span class="chip" style="background:#ede9fe;color:#7c3aed">🔦 Lighthouse: ${lhScore}</span>` : ''}
  </div>
</div>

<div class="wrap">

  <div class="card">
    <div class="card-title">📊 Core Web Vitals</div>
    <div class="vitals">
      ${vCard('LCP', vitals.LCP, 2500, 4000)}
      ${vCard('FCP', vitals.FCP, 1800, 3000)}
      ${vCard('CLS', vitals.CLS, 0.1, 0.25, v => v?.toFixed(3))}
      ${vCard('TTFB', vitals.TTFB, 800, 1800)}
      ${vCard('TBT', vitals.TBT, 200, 600)}
      ${vCard('INP', vitals.INP, 200, 500)}
      ${lhScore != null ? `
      <div class="vcard" style="border-top:3px solid ${gaugeColor(lhScore)}">
        <div class="vname">Lighthouse</div>
        <div class="lh-circle" style="background:${gaugeColor(lhScore)}">${lhScore}</div>
        <div class="vstatus" style="color:${gaugeColor(lhScore)}">${lhScore>=90?'Good':lhScore>=50?'Average':'Poor'}</div>
      </div>` : ''}
    </div>
  </div>

  <div class="grid2">
    <div class="card">
      <div class="card-title">🌐 Network
        <span style="font-size:12px;font-weight:400;color:#64748b;margin-left:auto">
          ${network.totalTransferKB} KB &nbsp;|&nbsp; ${network.totalRequests} so'rov &nbsp;|&nbsp; ${network.cachedRequests} cached
        </span>
      </div>
      ${networkBars}
    </div>

    <div class="card">
      <div class="card-title">🔬 Traces</div>
      <div class="trace-grid">${traceItems}</div>
      ${traces.longTaskCount > 0 ? `
      <div style="margin-top:14px;padding:12px;background:#fef9f0;border-radius:8px;font-size:12px;color:#92400e">
        ⚠️ ${traces.longTaskCount} ta Long Task — jami ${traces.longTaskTotalMs}ms main thread bloklanishi
      </div>` : `
      <div style="margin-top:14px;padding:12px;background:#f0fdf4;border-radius:8px;font-size:12px;color:#166534">
        ✅ Long Task yo'q — main thread sog'lom
      </div>`}
    </div>
  </div>

  ${renderBars ? `
  <div class="card">
    <div class="card-title">🔄 Komponent render'lari
      <span style="font-size:12px;font-weight:400;color:#64748b;margin-left:auto">Jami: ${renders.totalRenders}</span>
    </div>
    ${renderBars || '<p style="color:#9ca3af;font-size:13px">Render data yo\'q (devtools hook ulanmagan)</p>'}
  </div>` : ''}

  <div class="card">
    <div class="card-title">📋 Topilmalar (${findings.length} ta)</div>
    <table class="findings-table">
      <thead><tr><th>Jiddiylik</th><th>Rule</th><th>Muammo</th><th>Tavsiya</th></tr></thead>
      <tbody>${findingRows}</tbody>
    </table>
  </div>

</div>
</body>
</html>`;
}
