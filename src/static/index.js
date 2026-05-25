/**
 * Qatlam 1 — Statik analiz orchestrator'i
 * 3 ta sub-analyzer'ni ishlatadi: lint, bundle, deps
 * Har biri normalized findings qaytaradi: { file, line, rule, message, severity, fix }
 */
import { runLintAnalysis } from './lint/index.js';
import { runBundleAnalysis } from './bundle/index.js';
import { runDepsAnalysis } from './deps/index.js';
import { isVue, isReact } from '../utils/detect.js';

/**
 * @param {Object} config - loadProjectConfig dan kelgan config
 * @returns {Object} { findings[], summary, meta }
 */
export async function runStaticAnalysis(config) {
  const { projectPath, framework, layers, budget } = config;

  const meta = {
    projectPath,
    framework,
    analyzedAt: new Date().toISOString(),
    layers,
  };

  let allFindings = [];
  const layerResults = {};

  if (layers.includes('lint')) {
    console.log('\n🔍  Lint analiz...');
    const lintResult = await runLintAnalysis({ projectPath, framework });
    allFindings = allFindings.concat(lintResult.findings);
    layerResults.lint = lintResult;
  }

  if (layers.includes('bundle')) {
    console.log('\n📦  Bundle analiz...');
    const bundleResult = await runBundleAnalysis({ projectPath, framework, budget });
    allFindings = allFindings.concat(bundleResult.findings);
    layerResults.bundle = bundleResult;
  }

  if (layers.includes('deps')) {
    console.log('\n🔗  Dependency analiz...');
    const depsResult = await runDepsAnalysis({ projectPath, framework });
    allFindings = allFindings.concat(depsResult.findings);
    layerResults.deps = depsResult;
  }

  // Findings'ni jiddiylik bo'yicha tartiblash
  allFindings.sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 };
    return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
  });

  const summary = buildSummary(allFindings, budget);

  return {
    findings: allFindings,
    summary,
    layerResults,
    meta,
  };
}

function buildSummary(findings, budget) {
  const bySeverity = { critical: 0, warning: 0, info: 0 };
  const byLayer = {};
  const byFile = {};

  for (const f of findings) {
    bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
    byLayer[f.layer] = (byLayer[f.layer] || 0) + 1;
    if (f.file) {
      byFile[f.file] = (byFile[f.file] || 0) + 1;
    }
  }

  // Eng ko'p muammo bo'lgan fayllar (top 10)
  const hotspots = Object.entries(byFile)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([file, count]) => ({ file, count }));

  const passed = bySeverity.critical === 0 &&
    bySeverity.warning <= budget.findings.warning;

  return {
    total: findings.length,
    bySeverity,
    byLayer,
    hotspots,
    passed,
    budgetStatus: {
      critical: { limit: budget.findings.critical, actual: bySeverity.critical, ok: bySeverity.critical <= budget.findings.critical },
      warning: { limit: budget.findings.warning, actual: bySeverity.warning, ok: bySeverity.warning <= budget.findings.warning },
    },
  };
}
