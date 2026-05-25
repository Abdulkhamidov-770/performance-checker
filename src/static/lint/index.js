/**
 * Lint analiz qatlami
 * Vue va React fayllarni AST orqali o'qib, performance anti-pattern'larni topadi.
 * Har bir topilma: { file, line, col, rule, message, severity, fix, layer:'lint' }
 */
import { glob } from 'glob';
import { readFileSync } from 'fs';
import { relative } from 'path';
import { isVue, isReact } from '../../utils/detect.js';
import { analyzeVueFile } from './vue-rules.js';
import { analyzeReactFile } from './react-rules.js';
import { analyzeCommonFile } from './common-rules.js';

export async function runLintAnalysis({ projectPath, framework }) {
  const findings = [];
  const stats = { filesScanned: 0, vueFiles: 0, jsxFiles: 0, jsFiles: 0 };

  // Vue SFC fayllar
  if (isVue(framework.framework)) {
    const vueFiles = await glob('**/*.vue', {
      cwd: projectPath,
      ignore: ['**/node_modules/**', '**/dist/**', '**/.nuxt/**', '**/coverage/**'],
      absolute: true,
    });
    stats.vueFiles = vueFiles.length;

    for (const file of vueFiles) {
      const src = safeRead(file);
      if (!src) continue;
      const relFile = relative(projectPath, file);
      const fileFindings = analyzeVueFile(src, relFile);
      findings.push(...fileFindings);
      stats.filesScanned++;
    }
  }

  // React JSX/TSX fayllar
  if (isReact(framework.framework)) {
    const jsxFiles = await glob('**/*.{jsx,tsx}', {
      cwd: projectPath,
      ignore: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/coverage/**'],
      absolute: true,
    });
    stats.jsxFiles = jsxFiles.length;

    for (const file of jsxFiles) {
      const src = safeRead(file);
      if (!src) continue;
      const relFile = relative(projectPath, file);
      const fileFindings = analyzeReactFile(src, relFile);
      findings.push(...fileFindings);
      stats.filesScanned++;
    }
  }

  // Umumiy JS/TS fayllar (ham Vue ham React uchun)
  const jsFiles = await glob('**/*.{js,ts,mjs}', {
    cwd: projectPath,
    ignore: [
      '**/node_modules/**', '**/dist/**', '**/coverage/**',
      '**/*.config.*', '**/*.test.*', '**/*.spec.*',
    ],
    absolute: true,
  });
  stats.jsFiles = jsFiles.length;

  for (const file of jsFiles) {
    const src = safeRead(file);
    if (!src) continue;
    const relFile = relative(projectPath, file);
    const fileFindings = analyzeCommonFile(src, relFile, framework);
    findings.push(...fileFindings);
    stats.filesScanned++;
  }

  return {
    findings: findings.map(f => ({ ...f, layer: 'lint' })),
    stats,
  };
}

function safeRead(file) {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}
