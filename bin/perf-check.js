#!/usr/bin/env node
/**
 * perf-check CLI — Qatlam 1 (Static Analysis) entry point
 * Usage: perf-check --project ./my-vue-app [--layer lint|bundle|deps|all] [--report]
 */
import { program } from 'commander';
import { runStaticAnalysis } from '../src/static/index.js';
import { loadProjectConfig } from '../src/config/loader.js';
import { generateReport } from '../src/reporters/index.js';

program
  .name('perf-check')
  .description('Static performance analysis for Vue/React projects')
  .version('1.0.0')
  .option('-p, --project <path>', 'Path to the frontend project', '.')
  .option('-c, --config <path>', 'Path to projects config file', './perf.config.js')
  .option('-l, --layer <layers>', 'Layers to run: lint,bundle,deps or all', 'all')
  .option('-r, --report', 'Generate HTML report', false)
  .option('-o, --output <path>', 'Output directory for reports', './perf-reports')
  .option('--budget <path>', 'Path to performance budget file')
  .option('--format <fmt>', 'Output format: console,json,html', 'console');

program.parse();
const opts = program.opts();

async function main() {
  const config = await loadProjectConfig(opts);
  const results = await runStaticAnalysis(config);

  if (opts.report || opts.format !== 'console') {
    await generateReport(results, config);
  }

  // Exit with non-zero if critical findings found
  const criticalCount = results.findings.filter(f => f.severity === 'critical').length;
  if (criticalCount > 0) {
    console.error(`\n⛔  ${criticalCount} critical finding(s). Fix before merging.`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('perf-check error:', err.message);
  process.exit(1);
});
