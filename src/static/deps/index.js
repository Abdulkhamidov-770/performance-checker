/**
 * Dependency analiz qatlami — AST-based.
 * - AST orqali static import, dynamic import, require, re-export ni topadi
 * - Vue SFC: script va script setup blokini AST'da parse qiladi
 * - Circular dependency: oddiy DFS (perfekt emas, lekin regex'dan ancha yaxshi)
 */
import { existsSync, readFileSync } from 'fs';
import { join, relative, dirname, resolve } from 'path';
import { glob } from 'glob';
import { parseJS } from '../lint/parsers/js-parser.js';
import { parseVueSFC } from '../lint/parsers/vue-parser.js';
import { safeTraverse } from '../lint/parsers/js-parser.js';
import { logger } from '../../utils/logger.js';

const IMPLICIT_DEPS = new Set([
  'vite', 'webpack', 'rollup', '@vitejs/plugin-vue', '@vitejs/plugin-react',
  'eslint', 'prettier', 'husky', 'lint-staged', 'jest', 'vitest',
  'typescript', 'postcss', 'tailwindcss', 'autoprefixer',
  '@vue/cli-service', '@vue/cli', '@types/node',
]);

const IMPLICIT_PREFIXES = ['@types/', '@vue/', '@nuxt/', '@nuxtjs/', '@babel/', 'eslint-', 'prettier-', 'postcss-', 'rollup-plugin-', 'vite-plugin-'];

export async function runDepsAnalysis({ projectPath, framework }) {
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

  const sourceFiles = await glob('**/*.{js,ts,jsx,tsx,vue,mjs,cjs}', {
    cwd: projectPath,
    ignore: ['**/node_modules/**', '**/dist/**', '**/.nuxt/**', '**/.next/**', '**/coverage/**', '**/.output/**', '**/build/**'],
    absolute: true,
  });

  const importMap = {};
  const importsByFile = {};

  for (const file of sourceFiles) {
    let src;
    try { src = readFileSync(file, 'utf8'); } catch { continue; }

    const relFile = relative(projectPath, file);
    const fileImports = extractImports(src, relFile);

    for (const imp of fileImports) {
      if (imp.startsWith('.') || imp.startsWith('/') || imp.startsWith('~') || imp.startsWith('@/')) continue;
      const pkgName = imp.startsWith('@') ? imp.split('/').slice(0, 2).join('/') : imp.split('/')[0];
      importMap[pkgName] = (importMap[pkgName] || 0) + 1;
    }

    importsByFile[relFile] = fileImports;
  }

  // Unused production dependencies
  const declared = Object.keys(pkg.dependencies || {});
  const unused = declared.filter(dep => {
    if (IMPLICIT_DEPS.has(dep)) return false;
    if (IMPLICIT_PREFIXES.some(p => dep.startsWith(p))) return false;
    if (importMap[dep]) return false;
    // peer dependency'lar (masalan vue uchun @vue/runtime-dom)
    const short = dep.split('/').pop();
    if (importMap[short]) return false;
    // Vue SFC scoped — agar package vue plugin bo'lsa
    return true;
  });

  for (const dep of unused.slice(0, 20)) {
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

  // Deep relative imports
  for (const [file, imports] of Object.entries(importsByFile)) {
    for (const imp of imports) {
      if (/^\.\.(\/\.\.){2,}/.test(imp)) {
        findings.push({
          file, line: 1, col: 1,
          rule: 'deps/deep-relative-import',
          message: `Juda chuqur relative import: \`${imp}\``,
          severity: 'info',
          fix: 'Path alias sozlang: `@/` yoki `~/` bilan almashtiring (vite.config resolve.alias).',
        });
        break;
      }
    }
  }

  // Circular dependency — to'g'ri path resolution bilan
  const circular = detectCircular(importsByFile, projectPath);
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

  stats.totalSourceFiles = sourceFiles.length;
  stats.uniquePackagesUsed = Object.keys(importMap).length;
  stats.unusedProductionDeps = unused.length;
  stats.circularDepsFound = circular.length;

  return {
    findings: findings.map(f => ({ ...f, layer: 'deps' })),
    stats,
  };
}

/**
 * AST orqali importlarni topish. Static, dynamic (`import()`), require, va re-export.
 */
function extractImports(src, relFile) {
  const ext = relFile.split('.').pop();
  let imports = [];

  try {
    if (ext === 'vue') {
      const parsed = parseVueSFC(src);
      if (parsed.scriptAst) imports = imports.concat(astImports(parsed.scriptAst));
      if (parsed.scriptSetupAst) imports = imports.concat(astImports(parsed.scriptSetupAst));
    } else {
      const ast = parseJS(src, { typescript: ext === 'ts' || ext === 'tsx' });
      if (ast) imports = astImports(ast);
    }
  } catch (err) {
    logger.debug(`Imports extract xato (${relFile}): ${err.message}`);
  }

  return imports;
}

function astImports(ast) {
  const out = [];
  safeTraverse(ast, {
    ImportDeclaration(path) {
      const v = path.node.source?.value;
      if (typeof v === 'string') out.push(v);
    },
    ExportNamedDeclaration(path) {
      const v = path.node.source?.value;
      if (typeof v === 'string') out.push(v);
    },
    ExportAllDeclaration(path) {
      const v = path.node.source?.value;
      if (typeof v === 'string') out.push(v);
    },
    CallExpression(path) {
      const node = path.node;
      // dynamic import('...')
      if (node.callee?.type === 'Import') {
        const arg = node.arguments?.[0];
        if (arg?.type === 'StringLiteral') out.push(arg.value);
      }
      // require('...')
      if (node.callee?.type === 'Identifier' && node.callee.name === 'require') {
        const arg = node.arguments?.[0];
        if (arg?.type === 'StringLiteral') out.push(arg.value);
      }
    },
  });
  return out;
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

/**
 * Sodda circular detector: relative importlarni file system'ga resolve qilib graph quradi,
 * keyin DFS.
 */
function detectCircular(importsByFile, projectPath) {
  const graph = {};

  for (const [file, imports] of Object.entries(importsByFile)) {
    const fileDir = dirname(join(projectPath, file));
    const targets = [];
    for (const imp of imports) {
      if (!imp.startsWith('.')) continue;
      // Try to resolve relative path → file
      const resolved = resolveImport(fileDir, imp, projectPath);
      if (resolved && importsByFile[resolved]) targets.push(resolved);
    }
    graph[file] = targets;
  }

  const cycles = [];
  const visiting = new Set();
  const visited = new Set();

  function dfs(node, stack) {
    if (visiting.has(node)) {
      const start = stack.indexOf(node);
      if (start !== -1) cycles.push(stack.slice(start).concat(node));
      return;
    }
    if (visited.has(node)) return;
    visiting.add(node);
    stack.push(node);
    for (const t of graph[node] || []) dfs(t, stack);
    stack.pop();
    visiting.delete(node);
    visited.add(node);
  }

  for (const file of Object.keys(graph)) {
    if (!visited.has(file)) dfs(file, []);
    if (cycles.length >= 5) break;
  }

  return cycles;
}

function resolveImport(fromDir, importPath, projectPath) {
  const candidates = [
    importPath,
    importPath + '.js',
    importPath + '.ts',
    importPath + '.jsx',
    importPath + '.tsx',
    importPath + '.vue',
    importPath + '/index.js',
    importPath + '/index.ts',
  ];
  for (const c of candidates) {
    const abs = resolve(fromDir, c);
    if (existsSync(abs)) return relative(projectPath, abs).replace(/\\/g, '/');
  }
  return null;
}
