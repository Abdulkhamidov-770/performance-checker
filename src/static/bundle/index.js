/**
 * Bundle analiz qatlami
 * 1. package.json dan og'ir dependency'larni aniqlaydi
 * 2. dist/ papkasida build output mavjud bo'lsa, fayl o'lchamlarini tekshiradi
 * 3. Vite/webpack config'ni ko'rib optimization imkoniyatlarini topadi
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, extname } from 'path';
import { glob } from 'glob';

// MB o'lchamida ogir hisoblanadigan kutubxonalar va ularga alternativlar
const HEAVY_PACKAGES = {
  'moment': { size: '~329KB', alternative: 'dayjs (~2KB) yoki date-fns (~30KB tree-shakeable)', severity: 'critical' },
  'lodash': { size: '~71KB', alternative: 'lodash-es (tree-shakeable) yoki native ES2023 metodlar', severity: 'warning' },
  'jquery': { size: '~87KB', alternative: 'Vanilla JS DOM API (2024 da kerak emas)', severity: 'warning' },
  'axios': { size: '~13KB', alternative: 'Kichik loyihalar uchun native fetch() yetarli', severity: 'info' },
  'core-js': { size: '~400KB+', alternative: 'Faqat kerakli polyfill\'larni import qiling, browserslist sozlang', severity: 'warning' },
  'reflect-metadata': { size: '~50KB', alternative: 'Decorator\'lar uchun, production\'da kerak bo\'lmasligi mumkin', severity: 'info' },
  'chart.js': { size: '~200KB', alternative: 'Kichik chart uchun lightweight-charts yoki d3 (tree-shakeable)', severity: 'info' },
  'xlsx': { size: '~400KB', alternative: 'exceljs (tree-shakeable) yoki server-side export', severity: 'warning' },
  'highlight.js': { size: '~1MB+', alternative: 'Prism.js (lang\'larni alohida import qiling)', severity: 'warning' },
  'pdfmake': { size: '~1MB+', alternative: 'Server-side PDF generation', severity: 'warning' },
};

// Duplicate package detection uchun
const COMMON_DUPLICATES = [
  ['vue', 'vue2', 'vue3'],
  ['axios', 'node-fetch', 'got', 'superagent'],
  ['moment', 'dayjs', 'date-fns', 'luxon'],
  ['lodash', 'lodash-es', 'underscore'],
];

export async function runBundleAnalysis({ projectPath, framework, budget }) {
  const findings = [];
  const stats = {};

  const pkgPath = join(projectPath, 'package.json');
  if (!existsSync(pkgPath)) {
    return { findings, stats: { error: 'package.json topilmadi' } };
  }

  let pkg = {};
  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  } catch {
    return { findings, stats: { error: 'package.json o\'qilmadi' } };
  }

  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

  // 1. Og'ir kutubxonalar tekshiruvi
  for (const [name, info] of Object.entries(HEAVY_PACKAGES)) {
    if (allDeps[name]) {
      findings.push({
        file: 'package.json',
        line: findDepLine(pkgPath, name),
        col: 1,
        rule: 'bundle/heavy-package',
        message: `\`${name}\` (taxminan ${info.size}) — bundle'ni kattalashtiradi.`,
        severity: info.severity,
        fix: `Muqobil: ${info.alternative}`,
      });
    }
  }

  // 2. Bundler config tekshiruvi
  const viteConfigFindings = await checkViteConfig(projectPath, framework);
  findings.push(...viteConfigFindings);

  // 3. Build output tekshiruvi (dist/ mavjud bo'lsa)
  const distFindings = await checkDistOutput(projectPath, budget);
  findings.push(...distFindings);

  // 4. Duplicate qo'shimcha library detection
  const dupFindings = checkDuplicates(allDeps);
  findings.push(...dupFindings);

  // 5. devDependencies production'da ishlatilishini tekshirish
  const devInProdFindings = checkDevDepsInProd(pkg);
  findings.push(...devInProdFindings);

  stats.totalDependencies = Object.keys(pkg.dependencies || {}).length;
  stats.totalDevDependencies = Object.keys(pkg.devDependencies || {}).length;
  stats.heavyPackagesFound = findings.filter(f => f.rule === 'bundle/heavy-package').length;

  return { findings: findings.map(f => ({ ...f, layer: 'bundle' })), stats };
}

// ─── Helper funksiyalar ───────────────────────────────────────────────────────

function findDepLine(pkgPath, depName) {
  try {
    const lines = readFileSync(pkgPath, 'utf8').split('\n');
    const idx = lines.findIndex(l => l.includes(`"${depName}"`));
    return idx !== -1 ? idx + 1 : 1;
  } catch {
    return 1;
  }
}

async function checkViteConfig(projectPath, framework) {
  const findings = [];
  const configFiles = ['vite.config.js', 'vite.config.ts'];

  for (const fname of configFiles) {
    const cfgPath = join(projectPath, fname);
    if (!existsSync(cfgPath)) continue;

    const src = readFileSync(cfgPath, 'utf8');
    const lines = src.split('\n');

    lines.forEach((line, i) => {
      // sourcemap production'da (bundle kattalashadi)
      if (/sourcemap\s*:\s*true/.test(line) && !line.includes('//')) {
        findings.push({
          file: fname, line: i + 1, col: 1,
          rule: 'bundle/sourcemap-in-prod',
          message: '`sourcemap: true` — production bundle\'ni 2-3x kattalashtirishishi mumkin.',
          severity: 'warning',
          fix: '`sourcemap: process.env.NODE_ENV !== \'production\'` qiling.',
        });
      }

      // manualChunks yo'qligi (code splitting sozlanmagan)
      if (/build\s*:\s*\{/.test(line)) {
        const configBlock = src.slice(src.indexOf('build:'));
        if (!configBlock.includes('manualChunks') && !configBlock.includes('rollupOptions')) {
          findings.push({
            file: fname, line: i + 1, col: 1,
            rule: 'bundle/no-manual-chunks',
            message: 'Vite build\'da `manualChunks` sozlanmagan — vendor splitting yo\'q.',
            severity: 'info',
            fix: '`build.rollupOptions.output.manualChunks` bilan vendor va app chunk\'larini ajrating.',
          });
        }
      }
    });

    // terser minification tekshiruvi
    if (!src.includes('minify') && framework.bundler === 'vite') {
      findings.push({
        file: fname, line: 1, col: 1,
        rule: 'bundle/no-minification-config',
        message: 'Minification konfiguratsiyasi ko\'rsatilmagan.',
        severity: 'info',
        fix: '`build: { minify: \'terser\', terserOptions: { compress: { drop_console: true } } }`',
      });
    }
  }

  return findings;
}

async function checkDistOutput(projectPath, budget) {
  const findings = [];
  const distDirs = ['dist', 'build', '.nuxt/dist/client', '.next/static'];

  for (const distDir of distDirs) {
    const distPath = join(projectPath, distDir);
    if (!existsSync(distPath)) continue;

    let totalJsSize = 0;
    let totalCssSize = 0;
    let largestFiles = [];

    try {
      const jsFiles = await glob('**/*.js', { cwd: distPath, absolute: true });
      const cssFiles = await glob('**/*.css', { cwd: distPath, absolute: true });

      for (const f of jsFiles) {
        try {
          const size = statSync(f).size;
          totalJsSize += size;
          largestFiles.push({ file: relative(distPath, f), size, type: 'js' });
        } catch {}
      }

      for (const f of cssFiles) {
        try {
          const size = statSync(f).size;
          totalCssSize += size;
        } catch {}
      }

      largestFiles.sort((a, b) => b.size - a.size);

      // Budget tekshiruvi
      if (totalJsSize > budget.bundleSize.totalJS) {
        findings.push({
          file: distDir, line: 1, col: 1,
          rule: 'bundle/js-size-over-budget',
          message: `Umumiy JS hajmi ${formatSize(totalJsSize)} — budget ${formatSize(budget.bundleSize.totalJS)} dan oshdi.`,
          severity: 'critical',
          fix: 'Code splitting, lazy loading va tree-shaking ni tekshiring.',
        });
      }

      if (totalCssSize > budget.bundleSize.totalCSS) {
        findings.push({
          file: distDir, line: 1, col: 1,
          rule: 'bundle/css-size-over-budget',
          message: `Umumiy CSS hajmi ${formatSize(totalCssSize)} — budget ${formatSize(budget.bundleSize.totalCSS)} dan oshdi.`,
          severity: 'warning',
          fix: 'PurgeCSS yoki CSS-in-JS tree-shaking tekshiring.',
        });
      }

      // 500KB+ yagona JS fayl
      for (const { file, size } of largestFiles.slice(0, 5)) {
        if (size > 500 * 1024) {
          findings.push({
            file: `${distDir}/${file}`, line: 1, col: 1,
            rule: 'bundle/large-chunk',
            message: `${file} — ${formatSize(size)} (500KB limit)`,
            severity: 'warning',
            fix: 'Dynamic import bilan bu chunk\'ni bo\'ling.',
          });
        }
      }
    } catch {}
    break; // Birinchi topilgan dist papkasi yetarli
  }

  return findings;
}

function checkDuplicates(allDeps) {
  const findings = [];
  for (const group of COMMON_DUPLICATES) {
    const found = group.filter(p => allDeps[p]);
    if (found.length > 1) {
      findings.push({
        file: 'package.json', line: 1, col: 1,
        rule: 'bundle/duplicate-packages',
        message: `Bir xil maqsadli kutubxonalar: ${found.join(', ')} — bundle'da ikkalasi ham bo'lishi mumkin.`,
        severity: 'warning',
        fix: `Bittasini tanlab, boshqasini olib tashlang.`,
      });
    }
  }
  return findings;
}

function checkDevDepsInProd(pkg) {
  const findings = [];
  const prodDeps = pkg.dependencies || {};
  const devDeps = pkg.devDependencies || {};

  // Build tool'lar production dependency sifatida
  const buildToolsInProd = ['vite', 'webpack', 'rollup', 'babel', '@babel/core', 'typescript', 'eslint'];
  for (const tool of buildToolsInProd) {
    if (prodDeps[tool]) {
      findings.push({
        file: 'package.json', line: findDepLine('package.json', tool), col: 1,
        rule: 'bundle/build-tool-in-dependencies',
        message: `\`${tool}\` — devDependencies'da bo'lishi kerak, dependencies'da emas.`,
        severity: 'info',
        fix: '`npm install --save-dev ' + tool + '` bilan devDependencies\'ga ko\'chiring.',
      });
    }
  }
  return findings;
}

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${bytes}B`;
}
