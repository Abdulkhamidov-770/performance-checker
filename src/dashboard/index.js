/**
 * Qatlam 4 dashboard — statik HTML, server kerak emas.
 * .perf-history/<project>/<timestamp>.json fayllarini o'qib:
 *  - loyihalar reytingi (performance score)
 *  - har loyiha tarixiy trend grafigi (inline SVG)
 *  - regression flag
 *  - drill-down per project (findings ro'yxati)
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { logger } from '../utils/logger.js';

/**
 * @param {Object} opts - { historyDir, outputDir }
 */
export async function generateDashboard({ historyDir, outputDir }) {
  const history = resolve(historyDir);
  const output = resolve(outputDir);

  if (!existsSync(history)) {
    throw new Error(`Tarix papkasi topilmadi: ${history}\n  Avval \`perf-check scan\` ishlatib snapshot'lar yarating.`);
  }

  mkdirSync(output, { recursive: true });

  const projects = loadProjects(history);
  if (projects.length === 0) {
    throw new Error(`Tarixda hech qanday loyiha topilmadi. \`perf-check scan\` ishlatdingizmi?`);
  }

  const html = renderDashboard(projects);
  const outPath = join(output, 'dashboard.html');
  writeFileSync(outPath, html, 'utf8');
  logger.success(`Dashboard yaratildi: ${outPath}`);
  logger.info(`   ${projects.length} ta loyiha, ${projects.reduce((s, p) => s + p.snapshots.length, 0)} ta snapshot`);
  return outPath;
}

function loadProjects(historyDir) {
  const out = [];
  const entries = readdirSync(historyDir);
  for (const name of entries) {
    const projDir = join(historyDir, name);
    let stat;
    try { stat = statSync(projDir); } catch { continue; }
    if (!stat.isDirectory()) continue;
    const snapshots = readdirSync(projDir)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        try {
          return JSON.parse(readFileSync(join(projDir, f), 'utf8'));
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    if (snapshots.length === 0) continue;
    out.push({ name, snapshots, latest: snapshots[snapshots.length - 1] });
  }
  // Reyting: lighthouse score'siz oxiriga, score bo'yicha kamayadigan tartibda
  out.sort((a, b) => {
    const sA = a.latest.metrics.lighthouseScore ?? -1;
    const sB = b.latest.metrics.lighthouseScore ?? -1;
    if (sA === sB) return (b.latest.totals.critical || 0) - (a.latest.totals.critical || 0);
    return sB - sA;
  });
  return out;
}

function renderDashboard(projects) {
  const summary = {
    totalProjects: projects.length,
    totalCritical: projects.reduce((s, p) => s + (p.latest.totals.critical || 0), 0),
    totalWarning: projects.reduce((s, p) => s + (p.latest.totals.warning || 0), 0),
    regressions: projects.filter(p => hasRegression(p.snapshots)).length,
  };

  const cards = projects.map(p => renderProjectCard(p)).join('\n');

  return `<!DOCTYPE html>
<html lang="uz">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Performance Dashboard — Qatlam 4</title>
<style>${dashboardCSS()}</style>
</head>
<body>
  <header class="topbar">
    <div class="topbar-inner">
      <h1>⚡ Performance Dashboard</h1>
      <p>${summary.totalProjects} ta loyiha • Yangilangan: ${new Date().toLocaleString('uz-UZ')}</p>
    </div>
  </header>

  <main class="container">
    <section class="kpi-grid">
      <div class="kpi"><div class="kpi-num">${summary.totalProjects}</div><div class="kpi-lbl">Loyihalar</div></div>
      <div class="kpi"><div class="kpi-num red">${summary.totalCritical}</div><div class="kpi-lbl">Critical findings</div></div>
      <div class="kpi"><div class="kpi-num yellow">${summary.totalWarning}</div><div class="kpi-lbl">Warning findings</div></div>
      <div class="kpi"><div class="kpi-num ${summary.regressions > 0 ? 'red' : 'green'}">${summary.regressions}</div><div class="kpi-lbl">Regressionlar</div></div>
    </section>

    <h2>Loyihalar reytingi (Lighthouse score bo'yicha)</h2>
    <div class="projects">
      ${cards}
    </div>
  </main>

  <script>${dashboardJS()}</script>
</body>
</html>`;
}

function renderProjectCard(p) {
  const latest = p.latest;
  const score = latest.metrics.lighthouseScore;
  const scoreClass = score == null ? 'na' : score >= 90 ? 'good' : score >= 50 ? 'avg' : 'bad';
  const scoreText = score == null ? 'N/A' : String(score);
  const regression = hasRegression(p.snapshots);
  const totals = latest.totals;

  const trendSeries = {
    score: p.snapshots.map(s => ({ x: s.timestamp, y: s.metrics.lighthouseScore })),
    LCP: p.snapshots.map(s => ({ x: s.timestamp, y: s.metrics.LCP })),
    critical: p.snapshots.map(s => ({ x: s.timestamp, y: s.totals.critical })),
  };

  const trendsSvg = renderTrends(trendSeries);
  const findingsTable = renderFindingsTable(latest.findings || []);

  return `
  <div class="project-card${regression ? ' regression' : ''}" data-project="${escapeAttr(p.name)}">
    <header class="proj-header">
      <div>
        <h3>${escapeHTML(p.name)}</h3>
        <p class="proj-meta">
          ${latest.framework?.framework || '?'} / ${latest.framework?.bundler || '?'} •
          ${p.snapshots.length} ta snapshot •
          oxirgi: ${new Date(latest.timestamp).toLocaleString('uz-UZ')}
          ${regression ? '<span class="regression-badge">⚠ REGRESSION</span>' : ''}
        </p>
      </div>
      <div class="score-circle score-${scoreClass}">${scoreText}</div>
    </header>

    <div class="proj-metrics">
      <div class="metric"><span class="m-lbl">LCP</span><span class="m-val">${fmtMs(latest.metrics.LCP)}</span></div>
      <div class="metric"><span class="m-lbl">CLS</span><span class="m-val">${fmtNum(latest.metrics.CLS)}</span></div>
      <div class="metric"><span class="m-lbl">INP</span><span class="m-val">${fmtMs(latest.metrics.INP)}</span></div>
      <div class="metric"><span class="m-lbl">FCP</span><span class="m-val">${fmtMs(latest.metrics.FCP)}</span></div>
      <div class="metric"><span class="m-lbl">Bundle JS</span><span class="m-val">${fmtKB(latest.metrics.bundleJSKB)}</span></div>
      <div class="metric"><span class="m-lbl">Critical</span><span class="m-val red-text">${totals.critical}</span></div>
      <div class="metric"><span class="m-lbl">Warning</span><span class="m-val yellow-text">${totals.warning}</span></div>
    </div>

    ${trendsSvg}

    <details class="findings-details">
      <summary>📋 ${totals.findings} ta finding'ni ko'rsatish</summary>
      ${findingsTable}
    </details>
  </div>`;
}

// ─── Inline SVG trend grafigi ────────────────────────────────────────────────

function renderTrends(series) {
  const charts = [];
  if (series.score.some(p => p.y != null)) {
    charts.push(svgLineChart('Lighthouse score', series.score, '#10b981', 100));
  }
  if (series.LCP.some(p => p.y != null)) {
    charts.push(svgLineChart('LCP (ms)', series.LCP, '#6366f1'));
  }
  charts.push(svgLineChart('Critical findings', series.critical, '#dc2626'));
  if (charts.length === 0) return '';
  return `<div class="trends">${charts.join('')}</div>`;
}

function svgLineChart(title, points, color, yMax) {
  const w = 280, h = 80, pad = 8;
  const valid = points.filter(p => p.y != null && Number.isFinite(p.y));
  if (valid.length === 0) {
    return `<div class="chart"><div class="chart-title">${title}</div><div class="no-data">ma'lumot yo'q</div></div>`;
  }
  const ys = valid.map(p => p.y);
  const computedMax = Math.max(...ys) * 1.1 || 1;
  const max = yMax != null ? yMax : computedMax;
  const min = 0;
  const stepX = valid.length > 1 ? (w - pad * 2) / (valid.length - 1) : 0;
  const coords = valid.map((p, i) => {
    const x = pad + i * stepX;
    const y = h - pad - ((p.y - min) / (max - min)) * (h - pad * 2);
    return [x, y];
  });
  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c[0].toFixed(1)},${c[1].toFixed(1)}`).join(' ');
  const dots = coords.map(c => `<circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="2" fill="${color}"/>`).join('');
  const last = valid[valid.length - 1].y;

  return `
  <div class="chart">
    <div class="chart-title">${title} <span class="chart-last">${typeof last === 'number' ? last.toFixed?.(2).replace(/\.00$/, '') || last : last}</span></div>
    <svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
      <path d="${path}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      ${dots}
    </svg>
  </div>`;
}

function renderFindingsTable(findings) {
  if (!findings || findings.length === 0) {
    return '<p class="no-data">Topilma yo\'q ✅</p>';
  }
  const rows = findings.slice(0, 100).map(f => {
    const sevClass = f.severity === 'critical' ? 'sev-c' : f.severity === 'warning' ? 'sev-w' : 'sev-i';
    return `<tr class="${sevClass}">
      <td><span class="sev-pill ${sevClass}">${f.severity}</span></td>
      <td><code>${escapeHTML(f.rule || '')}</code></td>
      <td><code class="loc">${escapeHTML(f.file || '')}${f.line ? ':' + f.line : ''}</code></td>
      <td>${escapeHTML(f.message || '')}</td>
    </tr>`;
  }).join('');
  return `
  <table class="findings-table">
    <thead><tr><th>Severity</th><th>Rule</th><th>Joy</th><th>Xabar</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function hasRegression(snapshots) {
  if (snapshots.length < 2) return false;
  const cur = snapshots[snapshots.length - 1];
  const prev = snapshots[snapshots.length - 2];
  if ((cur.totals.critical ?? 0) > (prev.totals.critical ?? 0)) return true;
  if (cur.metrics.lighthouseScore != null && prev.metrics.lighthouseScore != null &&
      prev.metrics.lighthouseScore - cur.metrics.lighthouseScore >= 5) return true;
  if (cur.metrics.LCP != null && prev.metrics.LCP != null && prev.metrics.LCP > 0) {
    if ((cur.metrics.LCP - prev.metrics.LCP) / prev.metrics.LCP > 0.2) return true;
  }
  return false;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtMs(v) { if (v == null) return 'N/A'; return v >= 1000 ? (v / 1000).toFixed(2) + 's' : Math.round(v) + 'ms'; }
function fmtNum(v) { if (v == null) return 'N/A'; return v.toFixed?.(3) ?? String(v); }
function fmtKB(v) { if (v == null) return 'N/A'; return v >= 1024 ? (v / 1024).toFixed(1) + ' MB' : Math.round(v) + ' KB'; }
function escapeHTML(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function escapeAttr(s) { return escapeHTML(s).replace(/'/g, '&#39;'); }

// ─── Styling ─────────────────────────────────────────────────────────────────

function dashboardCSS() {
  return `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f1f5f9;color:#0f172a;min-height:100vh}
.topbar{background:linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#4c1d95 100%);color:#fff;padding:32px 0}
.topbar-inner{max-width:1280px;margin:0 auto;padding:0 32px}
.topbar h1{font-size:26px;font-weight:700;margin-bottom:6px}
.topbar p{opacity:.7;font-size:14px}
.container{max-width:1280px;margin:0 auto;padding:24px 32px}
.kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:28px}
.kpi{background:#fff;border-radius:14px;padding:20px;box-shadow:0 1px 4px rgba(0,0,0,.05);text-align:center}
.kpi-num{font-size:36px;font-weight:700;color:#0f172a}
.kpi-num.red{color:#dc2626}
.kpi-num.yellow{color:#d97706}
.kpi-num.green{color:#10b981}
.kpi-lbl{font-size:12px;color:#64748b;margin-top:6px;text-transform:uppercase;letter-spacing:.05em}
h2{font-size:18px;font-weight:700;margin:16px 0 16px;color:#0f172a}
.projects{display:grid;gap:20px}
.project-card{background:#fff;border-radius:14px;padding:24px;box-shadow:0 1px 4px rgba(0,0,0,.06);border-left:4px solid #e2e8f0;transition:transform .15s}
.project-card:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(0,0,0,.08)}
.project-card.regression{border-left-color:#dc2626;background:linear-gradient(to right,#fef2f2,#fff 80px)}
.proj-header{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:16px;flex-wrap:wrap}
.proj-header h3{font-size:18px;font-weight:700;margin-bottom:4px}
.proj-meta{font-size:12px;color:#64748b}
.regression-badge{background:#dc2626;color:#fff;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;margin-left:8px}
.score-circle{width:64px;height:64px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;color:#fff;flex-shrink:0}
.score-good{background:#10b981}
.score-avg{background:#d97706}
.score-bad{background:#dc2626}
.score-na{background:#94a3b8}
.proj-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;margin-bottom:16px}
.metric{background:#f8fafc;border-radius:10px;padding:10px;text-align:center}
.m-lbl{display:block;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px}
.m-val{display:block;font-size:16px;font-weight:600;color:#0f172a}
.red-text{color:#dc2626}
.yellow-text{color:#d97706}
.trends{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin-bottom:14px}
.chart{background:#fafafa;border-radius:10px;padding:10px}
.chart-title{font-size:12px;color:#64748b;font-weight:600;display:flex;justify-content:space-between;margin-bottom:4px}
.chart-last{color:#0f172a;font-size:13px}
.chart svg{display:block;width:100%;height:80px}
.no-data{font-size:12px;color:#94a3b8;padding:20px;text-align:center}
.findings-details{margin-top:8px}
.findings-details summary{cursor:pointer;padding:8px 12px;background:#f8fafc;border-radius:8px;font-size:13px;color:#475569;user-select:none}
.findings-details summary:hover{background:#f1f5f9}
.findings-table{width:100%;border-collapse:collapse;font-size:12px;margin-top:10px;table-layout:fixed}
.findings-table th{background:#f8fafc;padding:8px 10px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.04em}
.findings-table td{padding:8px 10px;border-bottom:1px solid #f1f5f9;vertical-align:top;word-wrap:break-word;overflow-wrap:anywhere}
.findings-table th:nth-child(1),.findings-table td:nth-child(1){width:80px}
.findings-table th:nth-child(2),.findings-table td:nth-child(2){width:160px}
.findings-table th:nth-child(3),.findings-table td:nth-child(3){width:220px}
.sev-pill{padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;color:#fff;text-transform:uppercase}
.sev-pill.sev-c{background:#dc2626}
.sev-pill.sev-w{background:#d97706}
.sev-pill.sev-i{background:#2563eb}
code{font-family:'Fira Code',Consolas,monospace;font-size:11px;background:#f3f4f6;padding:1px 5px;border-radius:3px;color:#7c3aed}
code.loc{color:#0891b2}
@media(max-width:640px){.container{padding:16px}.proj-metrics{grid-template-columns:repeat(2,1fr)}}
`;
}

function dashboardJS() {
  return `
// Reserved for future interactive filters
`;
}
