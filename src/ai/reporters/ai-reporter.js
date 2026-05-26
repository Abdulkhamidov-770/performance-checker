/**
 * AI hisobot generatori
 * Console (rangli), JSON va HTML formatda chiqaradi
 */
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m',
  red: '\x1b[31m', yellow: '\x1b[33m', blue: '\x1b[34m',
  green: '\x1b[32m', cyan: '\x1b[36m', gray: '\x1b[90m', magenta: '\x1b[35m',
};

export async function buildAIReport({ aiResults, summary, outputDir, format }) {
  if (format === 'console' || format === 'all') {
    printConsoleAIReport(aiResults, summary);
  }

  mkdirSync(outputDir, { recursive: true });

  if (format === 'json' || format === 'all') {
    const p = join(outputDir, 'ai-report.json');
    writeFileSync(p, JSON.stringify({ summary, results: aiResults }, null, 2), 'utf8');
    console.log(`\n${C.cyan}📄 AI JSON hisobot: ${p}${C.reset}`);
  }

  if (format === 'html' || format === 'all') {
    const p = join(outputDir, 'ai-report.html');
    writeFileSync(p, generateHTML(aiResults, summary), 'utf8');
    console.log(`${C.cyan}🌐 AI HTML hisobot: ${p}${C.reset}`);
  }
}

// ─── Console reporter ─────────────────────────────────────────────────────────

function printConsoleAIReport(results, summary) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`${C.bold}  🤖 AI Performance Tahlil — Qatlam 3${C.reset}`);
  console.log(`${'═'.repeat(70)}`);
  console.log(`  Jami topilmalar: ${summary.total}  |  AI tahlil qildi: ${summary.processed}  |  Muvaffaqiyatli: ${summary.successful}`);
  console.log(`${'─'.repeat(70)}\n`);

  // Prioritet bo'yicha tartiblash (1 = eng muhim)
  const sorted = [...results].sort((a, b) => (a.ai?.priority || 5) - (b.ai?.priority || 5));

  for (let i = 0; i < sorted.length; i++) {
    const { finding, context, ai } = sorted[i];
    if (ai?.error) continue;

    const sevColor = finding.severity === 'critical' ? C.red : finding.severity === 'warning' ? C.yellow : C.blue;
    const sevIcon = finding.severity === 'critical' ? '⛔' : finding.severity === 'warning' ? '⚠' : 'ℹ';
    const priorityStars = '★'.repeat(6 - (ai?.priority || 3)) + '☆'.repeat(ai?.priority - 1 || 2);

    console.log(`  ${sevIcon} ${sevColor}${C.bold}[${finding.severity.toUpperCase()}]${C.reset} ${C.cyan}${finding.file || 'runtime'}${finding.line ? ':' + finding.line : ''}${C.reset}`);
    console.log(`  ${C.gray}Rule:${C.reset} ${finding.rule}`);
    console.log(`  ${C.magenta}Prioritet:${C.reset} ${priorityStars} (${ai?.priority}/5)`);

    if (ai?.explanation) {
      console.log(`\n  ${C.bold}📌 Muammo:${C.reset}`);
      console.log(`  ${ai.explanation}`);
    }

    if (ai?.root_cause) {
      console.log(`\n  ${C.bold}🔍 Sabab:${C.reset} ${ai.root_cause}`);
    }

    if (ai?.fix_code) {
      console.log(`\n  ${C.green}${C.bold}💡 Fix kodi:${C.reset}`);
      const codeLines = ai.fix_code.split('\\n').join('\n').split('\n');
      for (const line of codeLines.slice(0, 20)) {
        console.log(`  ${C.gray}│${C.reset} ${line}`);
      }
      if (codeLines.length > 20) console.log(`  ${C.gray}│ ... (${codeLines.length - 20} qator qo'shimcha)${C.reset}`);
    }

    if (ai?.performance_impact) {
      console.log(`\n  ${C.cyan}📈 Kutilgan natija:${C.reset} ${ai.performance_impact}`);
    }

    console.log(`\n${'─'.repeat(70)}\n`);
  }

  // Xatoliklar
  const errors = results.filter(r => r.ai?.error);
  if (errors.length > 0) {
    console.log(`  ${C.yellow}⚠  ${errors.length} ta finding AI tahlilida xatolik:${C.reset}`);
    for (const { finding, ai } of errors) {
      console.log(`    ${C.gray}${finding.rule}: ${ai.error}${C.reset}`);
    }
  }

  console.log(`${'═'.repeat(70)}\n`);
}

// ─── HTML reporter ────────────────────────────────────────────────────────────

function generateHTML(results, summary) {
  const sorted = [...results]
    .filter(r => !r.ai?.error)
    .sort((a, b) => (a.ai?.priority || 5) - (b.ai?.priority || 5));

  const cards = sorted.map(({ finding, context, ai }) => {
    const sevColors = { critical: '#dc2626', warning: '#d97706', info: '#2563eb' };
    const sevColor = sevColors[finding.severity] || '#6b7280';
    const priority = ai?.priority || 3;
    const stars = '★'.repeat(6 - priority) + '☆'.repeat(priority - 1);

    const fixCode = ai?.fix_code
      ? `<div class="fix-block">
          <div class="fix-header">💡 Fix kodi</div>
          <pre class="code">${escapeHTML(ai.fix_code.split('\\n').join('\n'))}</pre>
        </div>`
      : '';

    const fileLink = finding.file
      ? `<span class="file-badge">${finding.file}${finding.line ? ':' + finding.line : ''}</span>`
      : `<span class="file-badge runtime">runtime metrika</span>`;

    return `
    <div class="card" data-severity="${finding.severity}" data-priority="${priority}">
      <div class="card-header">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <span class="sev-badge" style="background:${sevColor}">${finding.severity.toUpperCase()}</span>
          ${fileLink}
          <code class="rule">${finding.rule}</code>
        </div>
        <div class="priority">${stars} <span style="color:#6b7280;font-size:12px">prioritet ${priority}/5</span></div>
      </div>

      ${ai?.explanation ? `<div class="section"><div class="label">📌 Muammo</div><p>${ai.explanation}</p></div>` : ''}
      ${ai?.root_cause ? `<div class="section"><div class="label">🔍 Asosiy sabab</div><p>${ai.root_cause}</p></div>` : ''}

      ${fixCode}

      ${ai?.fix_explanation ? `<div class="section"><div class="label">📖 Fix tushuntirish</div><p>${ai.fix_explanation}</p></div>` : ''}
      ${ai?.performance_impact ? `<div class="section impact"><div class="label">📈 Kutilgan natija</div><p>${ai.performance_impact}</p></div>` : ''}

      ${context?.extractedLines ? `
      <details class="code-details">
        <summary>Muammo joylashgan kod ko'rish</summary>
        <pre class="code">${escapeHTML(context.extractedLines)}</pre>
      </details>` : ''}
    </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="uz">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>AI Performance Hisobot — Qatlam 3</title>
  <style>
    * { box-sizing:border-box;margin:0;padding:0 }
    body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;color:#111827;line-height:1.6 }
    .header { background:linear-gradient(135deg,#1e1b4b,#4c1d95);color:#fff;padding:32px 48px }
    .header h1 { font-size:26px;font-weight:700;margin-bottom:8px }
    .header p { opacity:.75;font-size:14px }
    .container { max-width:900px;margin:0 auto;padding:32px 24px }
    .summary { display:flex;gap:16px;margin-bottom:28px;flex-wrap:wrap }
    .stat { background:#fff;border-radius:12px;padding:18px 24px;box-shadow:0 1px 3px rgba(0,0,0,.08);flex:1;min-width:140px;text-align:center }
    .stat .num { font-size:32px;font-weight:700;color:#4c1d95 }
    .stat .lbl { font-size:12px;color:#6b7280;margin-top:4px }
    .filters { margin-bottom:20px;display:flex;gap:10px;flex-wrap:wrap }
    .filter-btn { padding:6px 16px;border-radius:20px;border:1.5px solid #e5e7eb;background:#fff;cursor:pointer;font-size:13px;transition:all .15s }
    .filter-btn.active { background:#4c1d95;color:#fff;border-color:#4c1d95 }
    .card { background:#fff;border-radius:14px;padding:24px;margin-bottom:20px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-left:4px solid #e5e7eb }
    .card[data-severity="critical"] { border-left-color:#dc2626 }
    .card[data-severity="warning"] { border-left-color:#d97706 }
    .card[data-severity="info"] { border-left-color:#2563eb }
    .card-header { display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;gap:12px;flex-wrap:wrap }
    .sev-badge { color:#fff;padding:3px 10px;border-radius:6px;font-size:11px;font-weight:700 }
    .file-badge { background:#f3f4f6;padding:3px 10px;border-radius:6px;font-size:12px;font-family:monospace;color:#374151 }
    .file-badge.runtime { background:#ede9fe;color:#4c1d95 }
    .rule { font-size:12px;color:#7c3aed;background:#f5f3ff;padding:3px 8px;border-radius:5px }
    .priority { font-size:18px;color:#f59e0b;white-space:nowrap }
    .section { margin-bottom:14px }
    .label { font-size:12px;font-weight:600;color:#6b7280;margin-bottom:6px;text-transform:uppercase;letter-spacing:.04em }
    .section p { font-size:14px;color:#374151 }
    .fix-block { background:#f0fdf4;border-radius:10px;padding:16px;margin:14px 0 }
    .fix-header { font-size:12px;font-weight:600;color:#059669;margin-bottom:10px }
    .code { background:#1e1b2e;color:#e2e8f0;padding:16px;border-radius:8px;font-size:12px;line-height:1.6;overflow-x:auto;white-space:pre;font-family:'Fira Code',Consolas,monospace }
    .impact { background:#eff6ff;border-radius:10px;padding:14px }
    .impact .label { color:#1d4ed8 }
    .impact p { color:#1e40af }
    .code-details { margin-top:12px }
    .code-details summary { cursor:pointer;font-size:13px;color:#6b7280;padding:8px 0;user-select:none }
    .code-details summary:hover { color:#4c1d95 }
    .card.hidden { display:none }
  </style>
</head>
<body>
<div class="header">
  <h1>🤖 AI Performance Hisobot — Qatlam 3</h1>
  <p>Claude Sonnet bilan grounded tahlil • ${new Date().toLocaleString('uz-UZ')}</p>
</div>
<div class="container">
  <div class="summary">
    <div class="stat"><div class="num">${summary.total}</div><div class="lbl">Jami topilmalar</div></div>
    <div class="stat"><div class="num">${summary.processed}</div><div class="lbl">AI tahlil qildi</div></div>
    <div class="stat"><div class="num" style="color:#dc2626">${summary.bySeverity?.critical || 0}</div><div class="lbl">Critical</div></div>
    <div class="stat"><div class="num" style="color:#d97706">${summary.bySeverity?.warning || 0}</div><div class="lbl">Warning</div></div>
  </div>

  <div class="filters">
    <button class="filter-btn active" onclick="filter('all')">Barchasi</button>
    <button class="filter-btn" onclick="filter('critical')">Critical</button>
    <button class="filter-btn" onclick="filter('warning')">Warning</button>
    <button class="filter-btn" onclick="filterPriority(1)">Prioritet 1 (eng muhim)</button>
    <button class="filter-btn" onclick="filterPriority(2)">Prioritet 2</button>
  </div>

  ${cards}
</div>
<script>
function filter(sev) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  document.querySelectorAll('.card').forEach(c => {
    c.classList.toggle('hidden', sev !== 'all' && c.dataset.severity !== sev);
  });
}
function filterPriority(p) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  document.querySelectorAll('.card').forEach(c => {
    c.classList.toggle('hidden', parseInt(c.dataset.priority) !== p);
  });
}
</script>
</body></html>`;
}

function escapeHTML(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
