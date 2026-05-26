#!/usr/bin/env node
/**
 * perf-check CLI — 4-qatlamli performance audit tizimi.
 *
 * Qatlam 1: perf-check --project ./my-vue-app
 * Qatlam 2: perf-check runtime --url http://localhost:5173
 * Qatlam 3: perf-check ai --project ./my-vue-app
 * To'liq:    perf-check full --project ./my-vue-app --url http://localhost:5173
 * Qatlam 4: perf-check scan --file ./projects.config.js
 * Qatlam 4: perf-check dashboard --history ./.perf-history --output ./dashboard
 */
import { program } from 'commander';
import { loadProjectConfig } from '../src/config/loader.js';
import { runStaticAnalysis } from '../src/static/index.js';
import { generateReport } from '../src/reporters/index.js';
import { logger } from '../src/utils/logger.js';

program
  .name('perf-check')
  .description('Frontend performance analyzer (4 qatlam: static + runtime + AI + dashboard)')
  .version('2.0.0');

// ─── Qatlam 1 (default) ──────────────────────────────────────────────────────
const staticAction = async (opts) => {
  if (opts.verbose) logger.setVerbose(true);
  try {
    const config = await loadProjectConfig(opts);
    const results = await runStaticAnalysis(config);
    await generateReport(results, config);
    const c = results.findings.filter(f => f.severity === 'critical').length;
    if (c > 0) {
      logger.error(`${c} critical finding(s).`);
      process.exit(1);
    }
  } catch (err) {
    logger.error(err.message);
    process.exit(1);
  }
};

program
  .option('-p, --project <path>', 'Loyiha yo\'li', '.')
  .option('-c, --config <path>', 'Config fayl', './perf.config.js')
  .option('-l, --layer <layers>', 'lint,bundle,deps yoki all', 'all')
  .option('-r, --report', 'HTML hisobot', false)
  .option('-o, --output <path>', 'Hisobot papkasi', './perf-reports')
  .option('--format <fmt>', 'console,json,html,all', 'console')
  .option('--verbose', 'Batafsil log')
  .action(staticAction);

// ─── Qatlam 2 ─────────────────────────────────────────────────────────────────
program
  .command('runtime')
  .description('Qatlam 2: Playwright + CDP runtime analiz')
  .requiredOption('-u, --url <url>', 'Tekshiriladigan URL')
  .option('-s, --scenario <name>', 'desktop | mobile | slow', 'desktop')
  .option('--framework <fw>', 'vue | react', 'vue')
  .option('--runs <n>', 'Necha marta o\'lchash', '3')
  .option('--no-lighthouse', 'Lighthouse\'ni o\'chirish')
  .option('--output <path>', 'Hisobot papkasi', './perf-reports')
  .option('--format <fmt>', 'console,json,html,all', 'console')
  .option('--chrome-profile [name]', 'Chrome user profilingizdan login/localStorage olish (default profil)')
  .option('--user-data-dir <path>', 'Custom Chrome user data papkasi (login saqlanadi)')
  .option('--headed', 'Brauzerni ko\'rinadigan rejimda ochish (debug uchun)')
  .option('--verbose', 'Batafsil log')
  .action(async (opts) => {
    if (opts.verbose) logger.setVerbose(true);
    try {
      const { runRuntimeAnalysis } = await import('../src/runtime/index.js');
      const { printRuntimeReport, saveRuntimeReport } = await import('../src/runtime/reporters/runtime-reporter.js');
      const results = await runRuntimeAnalysis({
        url: opts.url, scenario: opts.scenario,
        framework: opts.framework, runs: parseInt(opts.runs, 10),
        lighthouse: opts.lighthouse !== false,
        userDataDir: opts.userDataDir,
        chromeProfile: opts.chromeProfile,
        headed: opts.headed,
      });
      printRuntimeReport(results);
      if (opts.format !== 'console') await saveRuntimeReport(results, opts.output, opts.format);
      const c = results.findings.filter(f => f.severity === 'critical').length;
      if (c > 0) {
        logger.error(`${c} critical finding(s).`);
        process.exit(1);
      }
    } catch (err) {
      if (err.message?.includes('playwright')) {
        logger.error('Playwright yoki Chromium yo\'q.\n   Hal: npx playwright install chromium\n');
      } else {
        logger.error(err.message);
      }
      process.exit(1);
    }
  });

// ─── Qatlam 3 ─────────────────────────────────────────────────────────────────
program
  .command('ai')
  .description('Qatlam 3: AI grounded tahlil va fix tavsiyalar (Gemini/Claude)')
  .option('--project <path>', 'Loyiha yo\'li', '.')
  .option('--findings <path>', 'Qatlam 1/2 JSON hisobot yo\'li')
  .option('--max <n>', 'AI ga nechta finding yuborilsin', '20')
  .option('--output <path>', 'Hisobot papkasi', './perf-reports')
  .option('--format <fmt>', 'console,json,html,all', 'html')
  .option('--api-key <key>', 'API key (Gemini AIza... yoki Anthropic sk-ant-...)')
  .option('--verbose', 'Batafsil log')
  .action(async (opts) => {
    if (opts.verbose) logger.setVerbose(true);
    try {
      const { runAIAnalysis } = await import('../src/ai/index.js');
      const { readFileSync, existsSync } = await import('fs');
      const { resolve } = await import('path');

      const apiKey = opts.apiKey || process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY;
      let findings = [];

      if (opts.findings && existsSync(opts.findings)) {
        const raw = JSON.parse(readFileSync(opts.findings, 'utf8'));
        findings = raw.findings || raw.static?.findings || [];
        logger.info(`📂 ${findings.length} ta finding '${opts.findings}' dan yuklandi`);
      } else {
        logger.info('🔍 Qatlam 1 (statik analiz) ishlatilmoqda...');
        const config = await loadProjectConfig({ project: opts.project, layer: 'all', format: 'json' });
        const results = await runStaticAnalysis(config);
        findings = results.findings;
        logger.info(`   ${findings.length} ta finding topildi`);
      }

      await runAIAnalysis({
        findings,
        projectPath: resolve(opts.project),
        apiKey,
        maxFindings: parseInt(opts.max, 10),
        outputDir: opts.output,
        format: opts.format,
      });
    } catch (err) {
      logger.error('AI analiz xatosi:', err.message);
      process.exit(1);
    }
  });

// ─── To'liq pipeline ─────────────────────────────────────────────────────────
program
  .command('full')
  .description('Barcha qatlamlar: static + runtime + AI — yagona perf-report.json')
  .requiredOption('--project <path>', 'Loyiha yo\'li')
  .option('--url <url>', 'Runtime URL')
  .option('--framework <fw>', 'vue | react', 'vue')
  .option('--scenario <name>', 'desktop | mobile | slow', 'desktop')
  .option('--runs <n>', 'Runtime runs', '3')
  .option('--output <path>', 'Hisobot papkasi', './perf-reports')
  .option('--api-key <key>', 'AI API key')
  .option('--no-ai', 'AI qatlamini o\'tkazib yuborish')
  .option('--chrome-profile [name]', 'Chrome profilingizdan login olish')
  .option('--user-data-dir <path>', 'Custom Chrome user data papkasi')
  .option('--headed', 'Brauzerni ko\'rinadigan rejimda ochish')
  .option('--verbose', 'Batafsil log')
  .action(async (opts) => {
    if (opts.verbose) logger.setVerbose(true);
    const { resolve, join } = await import('path');
    const { mkdirSync, writeFileSync } = await import('fs');
    const apiKey = opts.apiKey || process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY;

    const unified = { meta: {}, static: null, runtime: null, ai: null };
    let allFindings = [];

    // Qatlam 1
    logger.info('\n━━━ QATLAM 1: Statik analiz ━━━');
    try {
      const config = await loadProjectConfig({ project: opts.project, layer: 'all', format: 'console' });
      const staticResults = await runStaticAnalysis(config);
      await generateReport(staticResults, { ...config, outputDir: opts.output, format: 'console' });
      unified.static = staticResults;
      unified.meta.project = config.projectPath;
      unified.meta.framework = config.framework;
      allFindings = allFindings.concat(staticResults.findings);
    } catch (err) {
      logger.error(`Qatlam 1 xato: ${err.message}`);
    }

    // Qatlam 2
    if (opts.url) {
      logger.info('\n━━━ QATLAM 2: Runtime analiz ━━━');
      try {
        const { runRuntimeAnalysis } = await import('../src/runtime/index.js');
        const { printRuntimeReport } = await import('../src/runtime/reporters/runtime-reporter.js');
        const runtimeResults = await runRuntimeAnalysis({
          url: opts.url, scenario: opts.scenario,
          framework: opts.framework, runs: parseInt(opts.runs, 10),
          userDataDir: opts.userDataDir,
          chromeProfile: opts.chromeProfile,
          headed: opts.headed,
        });
        printRuntimeReport(runtimeResults);
        unified.runtime = runtimeResults;
        allFindings = allFindings.concat(runtimeResults.findings);
      } catch (err) {
        logger.warn(`Runtime analiz o'tkazib yuborildi: ${err.message}`);
      }
    }

    // Qatlam 3
    if (opts.ai !== false && apiKey) {
      logger.info('\n━━━ QATLAM 3: AI tahlil ━━━');
      try {
        const { runAIAnalysis } = await import('../src/ai/index.js');
        const aiResult = await runAIAnalysis({
          findings: allFindings,
          projectPath: resolve(opts.project),
          apiKey,
          maxFindings: 20,
          outputDir: opts.output,
          format: 'console',
        });
        unified.ai = aiResult;
      } catch (err) {
        logger.warn(`AI tahlil xato: ${err.message}`);
      }
    } else if (opts.ai !== false && !apiKey) {
      logger.warn('GEMINI_API_KEY/ANTHROPIC_API_KEY topilmadi — AI qatlami o\'tkazib yuborildi.');
    }

    // Birlashtirilgan JSON
    mkdirSync(opts.output, { recursive: true });
    unified.meta.analyzedAt = new Date().toISOString();
    unified.meta.findings = {
      total: allFindings.length,
      critical: allFindings.filter(f => f.severity === 'critical').length,
      warning: allFindings.filter(f => f.severity === 'warning').length,
      info: allFindings.filter(f => f.severity === 'info').length,
    };
    unified.findings = allFindings;
    const outPath = join(opts.output, 'perf-report.json');
    writeFileSync(outPath, JSON.stringify(unified, null, 2), 'utf8');
    logger.success(`Birlashtirilgan hisobot: ${outPath}`);
    logger.info(`\n✅ To'liq analiz tugadi.`);

    if (unified.meta.findings.critical > 0) process.exit(1);
  });

// ─── Qatlam 4: scan (orchestrator) ───────────────────────────────────────────
program
  .command('scan')
  .description('Qatlam 4: 30+ loyiha uchun orchestrator + dashboard generatsiyasi')
  .requiredOption('--file <path>', 'projects.config.js fayli')
  .option('--dash-out <path>', 'Dashboard papkasi', './dashboard')
  .option('--history <path>', 'Tarixni saqlash papkasi', './.perf-history')
  .option('--no-dashboard', 'Faqat scan qil, dashboard yaratma')
  .option('--verbose', 'Batafsil log')
  .action(async (opts) => {
    if (opts.verbose) logger.setVerbose(true);
    try {
      const { runOrchestrator } = await import('../src/orchestrator/index.js');
      const results = await runOrchestrator({
        configPath: opts.file,
        historyDir: opts.history,
      });

      if (opts.dashboard !== false) {
        const { generateDashboard } = await import('../src/dashboard/index.js');
        await generateDashboard({
          historyDir: opts.history,
          outputDir: opts.dashOut,
        });
      }

      const regressions = results.filter(r => r.regression);
      if (regressions.length > 0) {
        logger.error(`${regressions.length} ta loyiha budget'dan oshdi (regression).`);
        process.exit(1);
      }
    } catch (err) {
      logger.error(err.message);
      process.exit(1);
    }
  });

// ─── Qatlam 4: dashboard ─────────────────────────────────────────────────────
program
  .command('dashboard')
  .description('Qatlam 4: statik HTML dashboard generatsiya qilish')
  .option('--history <path>', '.perf-history papkasi', './.perf-history')
  .option('--dash-out <path>', 'Dashboard papkasi', './dashboard')
  .option('--verbose', 'Batafsil log')
  .action(async (opts) => {
    if (opts.verbose) logger.setVerbose(true);
    try {
      const { generateDashboard } = await import('../src/dashboard/index.js');
      await generateDashboard({
        historyDir: opts.history,
        outputDir: opts.dashOut,
      });
    } catch (err) {
      logger.error(err.message);
      process.exit(1);
    }
  });

program.parse();
