/**
 * Dependency analiz qatlami
 * - Ishlatilmayotgan import'larni topadi
 * - Circular dependency potentsialini aniqlaydi
 * - Import pattern'larni tekshiradi
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { glob } from 'glob';

export async function runDepsAnalysis({ projectPath, framework }) {
  const findings = [];
  const stats = {};

  // 1. package.json dan boshlaymiz
  const pkgPath = join(projectPath, 'package.json');
  if (!existsSync(pkgPath)) {
    return { findings, stats: { error: 'package.json topilmadi' } };
  }

  let pkg = {};
  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  } catch {
    return { findings, stats };
  }

  // 2. Import pattern analizi — barcha source fayllar
  const sourceFiles = await glob('**/*.{js,ts,jsx,tsx,vue}', {
    cwd: projectPath,
    ignore: ['**/node_modules/**', '**/dist/**', '**/.nuxt/**', '**/.next/**', '**/coverage/**'],
    absolute: true,
  });

  const importMap = {}; // { package: count }
  const circularCandidates = [];
  const importsByFile = {}; // { file: [imports] }

  for (const file of sourceFiles) {
    let src = '';
    try { src = readFileSync(file, 'utf8'); } catch { continue; }

    const relFile = file.replace(projectPath + '/', '');
    const fileImports = [];

    // Import'larni parse qilish
    const importPattern = /import\s+(?:{[^}]+}|\*\s+as\s+\w+|\w+)?\s*(?:,\s*(?:{[^}]+}|\w+))?\s*from\s*['"]([^'"]+)['"]/g;
    const requirePattern = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

    let match;
    while ((match = importPattern.exec(src)) !== null) {
      const dep = match[1];
      fileImports.push(dep);

      // External package (node_modules)
      if (!dep.startsWith('.') && !dep.startsWith('@/') && !dep.startsWith('~')) {
        const pkgName = dep.startsWith('@') ? dep.split('/').slice(0, 2).join('/') : dep.split('/')[0];
        importMap[pkgName] = (importMap[pkgName] || 0) + 1;
      }
    }

    importsByFile[relFile] = fileImports;
  }

  // 3. package.json'da bor lekin kodda ishlatilmagan dependency'lar
  const allDeclared = Object.keys({
    ...pkg.dependencies,
    ...(pkg.devDependencies || {}),
  });

  // Framework va build tool'lar — ular kod ichida import qilinmaydi
  const IMPLICIT_DEPS = new Set([
    'vite', 'webpack', 'rollup', '@vitejs/plugin-vue', '@vitejs/plugin-react',
    'eslint', 'prettier', 'husky', 'lint-staged', 'jest', 'vitest',
    'typescript', '@types/', 'postcss', 'tailwindcss', 'autoprefixer',
    'vue-cli-service', '@vue/cli',
  ]);

  const unusedDeps = allDeclared.filter(dep => {
    if (IMPLICIT_DEPS.has(dep) || [...IMPLICIT_DEPS].some(p => dep.startsWith(p))) return false;
    if (!importMap[dep]) {
      // @scope/package — boshqa nom bilan import qilinishi mumkin
      const shortName = dep.split('/').pop();
      if (importMap[shortName]) return false;
      return true;
    }
    return false;
  });

  // Faqat dependencies'dagi (devDependencies emas) unused'larni report qil
  const unusedProdDeps = unusedDeps.filter(dep => pkg.dependencies?.[dep]);
  for (const dep of unusedProdDeps.slice(0, 10)) { // Top 10
    findings.push({
      file: 'package.json',
      line: findLine(pkgPath, dep),
      col: 1,
      rule: 'deps/unused-dependency',
      message: `\`${dep}\` — production dependency, lekin kodda ishlatilmayapti.`,
      severity: 'info',
      fix: `\`npm uninstall ${dep}\` yoki devDependencies'ga ko'chiring.`,
    });
  }

  // 4. Circular dependency detection (shallow)
  const relativeImports = {};
  for (const [file, imports] of Object.entries(importsByFile)) {
    relativeImports[file] = imports.filter(i => i.startsWith('.'));
  }

  const circular = findCircularImports(relativeImports, projectPath);
  for (const cycle of circular.slice(0, 5)) {
    findings.push({
      file: cycle[0],
      line: 1,
      col: 1,
      rule: 'deps/circular-dependency',
      message: `Circular dependency: ${cycle.join(' → ')}`,
      severity: 'warning',
      fix: 'Umumiy modulni alohida fayl/folder\'ga chiqaring (e.g., shared/, utils/).',
    });
  }

  // 5. Alias import o'rniga relative deep import
  for (const [file, imports] of Object.entries(importsByFile)) {
    for (const imp of imports) {
      if (/^\.\.(\/\.\.){2,}/.test(imp)) { // 3+ darajali ../../../
        findings.push({
          file,
          line: 1,
          col: 1,
          rule: 'deps/deep-relative-import',
          message: `Juda chuqur relative import: \`${imp}\``,
          severity: 'info',
          fix: 'Path alias sozlang: `@/` yoki `~/` bilan almashtiring (vite.config resolve.alias).',
        });
        break;
      }
    }
  }

  stats.totalSourceFiles = sourceFiles.length;
  stats.uniquePackagesUsed = Object.keys(importMap).length;
  stats.unusedProductionDeps = unusedProdDeps.length;
  stats.circularDepsFound = circular.length;

  return {
    findings: findings.map(f => ({ ...f, layer: 'deps' })),
    stats,
  };
}

function findLine(pkgPath, depName) {
  try {
    const lines = readFileSync(pkgPath, 'utf8').split('\n');
    const idx = lines.findIndex(l => l.includes(`"${depName}"`));
    return idx !== -1 ? idx + 1 : 1;
  } catch {
    return 1;
  }
}

function findCircularImports(relativeImports, projectPath) {
  // Soddalashtirilgan DFS circular detection
  const visited = new Set();
  const cycles = [];

  function dfs(node, path, inStack) {
    if (inStack.has(node)) {
      const cycleStart = path.indexOf(node);
      if (cycleStart !== -1) {
        cycles.push(path.slice(cycleStart).concat(node));
      }
      return;
    }
    if (visited.has(node)) return;
    visited.add(node);
    inStack.add(node);

    const imports = relativeImports[node] || [];
    for (const imp of imports) {
      // Relative path'ni fayl nomiga aylantirish (soddalashtirilgan)
      const normalized = imp.replace(/^\.\//, '').replace(/^\.\.\//, '');
      const candidates = Object.keys(relativeImports).filter(k =>
        k.includes(normalized) && k !== node
      );
      for (const c of candidates.slice(0, 1)) {
        dfs(c, [...path, node], new Set(inStack));
      }
    }
    inStack.delete(node);
  }

  for (const file of Object.keys(relativeImports).slice(0, 50)) {
    if (!visited.has(file)) dfs(file, [], new Set());
    if (cycles.length >= 5) break;
  }

  return cycles;
}
