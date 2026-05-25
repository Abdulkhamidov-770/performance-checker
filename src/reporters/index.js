/**
 * Reporter — natijalarni chiroyli ko'rsatadi
 * Formatlar: console (rangli jadval), json (fayl), html (brauzer hisoboti)
 */
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

// Terminal rang kodlari
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  bgRed: '\x1b[41m',
  bgYellow: '\x1b[43m',
};

const SEVERITY_ICON = {
  critical: `${C.red}⛔ CRITICAL${C.reset}`,
  warning: `${C.yellow}⚠  WARNING${C.reset}`,
  info: `${C.blue}ℹ  INFO${C.reset}`,
};

const SEVERITY_COLOR = {
  critical: C.red,
  warning: C.yellow,
  info: C.blue,
};

export async function generateReport(results, config) {
  const { format, outputDir, report } = config;

  if (format === 'console' || format === 'all') {
    printConsoleReport(results);
  }

  if (format === 'json' || format === 'all' || report) {
    mkdirSync(outputDir, { recursive: true });
    const outPath = join(outputDir, 'perf-report.json');
    writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
    console.log(`\n${C.cyan}📄 JSON hisobot: ${outPath}${C.reset}`);
  }

  if (format === 'html' || report) {
    mkdirSync(outputDir, { recursive: true });
    const htmlPath = join(outputDir, 'perf-report.html');
    writeFileSync(htmlPath, generateHTML(results), 'utf8');
    console.log(`${C.cyan}🌐 HTML hisobot: ${htmlPath}${C.reset}`);
  }
}

// ─── Console reporter ─────────────────────────────────────────────────────────

function printConsoleReport(results) {
  const { findings, summary, meta } = results;

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`${C.bold}  ⚡ Performance Checker — Qatlam 1 (Statik Analiz)${C.reset}`);
  console.log(`${'═'.repeat(70)}`);
  console.log(`  Loyiha: ${C.cyan}${meta.projectPath}${C.reset}`);
  console.log(`  Framework: ${C.cyan}${meta.framework.framework} / ${meta.framework.bundler}${C.reset}`);
  console.log(`  Sana: ${meta.analyzedAt}`);
  console.log(`${'─'.repeat(70)}`);

  // Summary
  console.log(`\n${C.bold}  📊 Xulosa${C.reset}`);
  console.log(`  Jami topilmalar: ${C.bold}${summary.total}${C.reset}`);
  console.log(`  ${C.red}⛔ Critical: ${summary.bySeverity.critical}${C.reset}  ` +
    `${C.yellow}⚠  Warning: ${summary.bySeverity.warning}${C.reset}  ` +
    `${C.blue}ℹ  Info: ${summary.bySeverity.info || 0}${C.reset}`);

  // Layer breakdown
  console.log(`\n  Qatlamlar bo'yicha:`);
  for (const [layer, count] of Object.entries(summary.byLayer)) {
    console.log(`    ${C.gray}${layer.padEnd(10)}${C.reset} ${count} ta topilma`);
  }

  // Budget status
  console.log(`\n  Budget holati:`);
  const bc = summary.budgetStatus;
  const critOk = bc.critical.ok ? `${C.green}✓${C.reset}` : `${C.red}✗${C.reset}`;
  const warnOk = bc.warning.ok ? `${C.green}✓${C.reset}` : `${C.yellow}✗${C.reset}`;
  console.log(`    Critical ${critOk} (${bc.critical.actual}/${bc.critical.limit} ta ruxsat)`);
  console.log(`    Warning  ${warnOk} (${bc.warning.actual}/${bc.warning.limit} ta ruxsat)`);

  // Hotspot fayllar
  if (summary.hotspots.length > 0) {
    console.log(`\n  🔥 Ko'p muammoli fayllar (top ${Math.min(5, summary.hotspots.length)}):`);
    for (const { file, count } of summary.hotspots.slice(0, 5)) {
      const bar = '█'.repeat(Math.min(count, 20));
      console.log(`    ${C.yellow}${bar}${C.reset} ${count}x ${C.gray}${file}${C.reset}`);
    }
  }

  // Findings jadval
  if (findings.length === 0) {
    console.log(`\n  ${C.green}✅ Muammo topilmadi! Ajoyib!${C.reset}\n`);
    return;
  }

  console.log(`\n${'─'.repeat(70)}`);
  console.log(`${C.bold}  📋 Batafsil topilmalar${C.reset}`);
  console.log(`${'─'.repeat(70)}\n`);

  // Severity bo'yicha guruhlash
  for (const severity of ['critical', 'warning', 'info']) {
    const group = findings.filter(f => f.severity === severity);
    if (group.length === 0) continue;

    console.log(`\n  ${SEVERITY_ICON[severity]} (${group.length} ta)\n`);

    for (const f of group) {
      const location = f.file ? `${C.cyan}${f.file}${C.reset}${f.line ? `:${C.yellow}${f.line}${C.reset}` : ''}` : '';
      const layer = `${C.gray}[${f.layer || '?'}]${C.reset}`;
      console.log(`  ${layer} ${location}`);
      console.log(`    ${SEVERITY_COLOR[severity]}Rule:${C.reset} ${f.rule}`);
      console.log(`    ${C.bold}📌 ${f.message}${C.reset}`);
      if (f.fix) {
        console.log(`    ${C.green}💡 ${f.fix}${C.reset}`);
      }
      console.log();
    }
  }

  // Final status
  console.log(`${'═'.repeat(70)}`);
  if (summary.passed) {
    console.log(`  ${C.green}${C.bold}✅ PASSED — Budget chegarasida${C.reset}`);
  } else {
    console.log(`  ${C.red}${C.bold}❌ FAILED — Budget oshdi, CI'da bloklash kerak${C.reset}`);
  }
  console.log(`${'═'.repeat(70)}\n`);
}

// ─── HTML reporter ────────────────────────────────────────────────────────────

function generateHTML(results) {
  const { findings, summary, meta } = results;

  const severityBadge = (s) => {
    const colors = { critical: '#dc2626', warning: '#d97706', info: '#2563eb' };
    const icons = { critical: '⛔', warning: '⚠', info: 'ℹ' };
    return `<span style="background:${colors[s]};color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600">${icons[s]} ${s.toUpperCase()}</span>`;
  };

  const findingRows = findings.map(f => `
    <tr>
      <td>${severityBadge(f.severity)}</td>
      <td><code style="font-size:12px;color:#0891b2">${f.file || ''}${f.line ? ':' + f.line : ''}</code></td>
      <td><code style="font-size:12px;color:#7c3aed">${f.rule || ''}</code></td>
      <td style="font-size:13px">${f.message}</td>
      <td style="font-size:12px;color:#059669">${f.fix || ''}</td>
    </tr>
  `).join('');

  const hotspotBars = summary.hotspots.slice(0, 8).map(({ file, count }) => `
    <div style="margin:4px 0;display:flex;align-items:center;gap:8px">
      <div style="width:${Math.min(count * 20, 200)}px;height:16px;background:#f59e0b;border-radius:3px"></div>
      <span style="font-size:12px;color:#374151">${count}x</span>
      <code style="font-size:11px;color:#6b7280">${file}</code>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html lang="uz">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Performance Checker — Hisobot</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; color: #111827; }
    .header { background: linear-gradient(135deg, #1e1b4b, #312e81); color: #fff; padding: 32px 48px; }
    .header h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
    .header p { opacity: 0.75; font-size: 14px; }
    .container { max-width: 1200px; margin: 0 auto; padding: 32px 24px; }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 32px; }
    .card { background: #fff; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .card h3 { font-size: 13px; color: #6b7280; font-weight: 500; margin-bottom: 8px; }
    .card .num { font-size: 36px; font-weight: 700; }
    .num.red { color: #dc2626; }
    .num.yellow { color: #d97706; }
    .num.blue { color: #2563eb; }
    .num.green { color: #059669; }
    table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    th { background: #f3f4f6; padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.05em; }
    td { padding: 12px 16px; border-top: 1px solid #f3f4f6; font-size: 13px; vertical-align: top; }
    tr:hover td { background: #f9fafb; }
    .status { padding: 16px 24px; border-radius: 12px; margin-bottom: 24px; font-weight: 600; font-size: 16px; }
    .status.pass { background: #ecfdf5; color: #059669; border: 1px solid #6ee7b7; }
    .status.fail { background: #fef2f2; color: #dc2626; border: 1px solid #fca5a5; }
    h2 { font-size: 18px; font-weight: 600; margin: 24px 0 16px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>⚡ Performance Checker Hisoboti</h1>
    <p>${meta.projectPath} • ${meta.framework.framework}/${meta.framework.bundler} • ${meta.analyzedAt}</p>
  </div>
  <div class="container">
    <div class="status ${summary.passed ? 'pass' : 'fail'}">
      ${summary.passed ? '✅ PASSED — Budget chegarasida' : '❌ FAILED — Budget oshdi, CI\'da bloklash kerak'}
    </div>

    <div class="summary-grid">
      <div class="card"><h3>Jami topilmalar</h3><div class="num">${summary.total}</div></div>
      <div class="card"><h3>Critical</h3><div class="num red">${summary.bySeverity.critical}</div></div>
      <div class="card"><h3>Warning</h3><div class="num yellow">${summary.bySeverity.warning}</div></div>
      <div class="card"><h3>Info</h3><div class="num blue">${summary.bySeverity.info || 0}</div></div>
    </div>

    ${summary.hotspots.length > 0 ? `
    <div class="card" style="margin-bottom:24px">
      <h3 style="margin-bottom:12px">🔥 Ko'p muammoli fayllar</h3>
      ${hotspotBars}
    </div>` : ''}

    <h2>📋 Batafsil topilmalar</h2>
    <table>
      <thead>
        <tr>
          <th>Jiddiylik</th><th>Fayl:Qator</th><th>Rule</th><th>Muammo</th><th>Tavsiya</th>
        </tr>
      </thead>
      <tbody>${findingRows}</tbody>
    </table>
  </div>
</body>
</html>`;
}
