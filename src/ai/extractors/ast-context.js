/**
 * AST kontekst ekstraktor
 *
 * Finding'dagi fayl va qatorni ochib, faqat tegishli kod qismini chiqaradi.
 * Bu AI ga butun faylni emas, faqat muammo atrofidagi kontekstni beradi.
 * Natija: aniq, hallucination-proof javob.
 */
import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';

const CONTEXT_LINES_BEFORE = 15;  // muammo qatoridan oldin
const CONTEXT_LINES_AFTER = 15;   // muammo qatoridan keyin
const MAX_CONTEXT_LINES = 80;     // maksimal kontekst hajmi

/**
 * @param {Object} finding - { file, line, rule, message, severity }
 * @param {string} projectPath - Loyiha root
 * @returns {Object} { file, fullPath, extractedLines, totalLines, exists }
 */
export async function extractFileContext(finding, projectPath) {
  // Runtime findings — fayl yo'q, metrika-based
  if (!finding.file || finding.layer === 'runtime') {
    return {
      file: null,
      fullPath: null,
      extractedLines: null,
      totalLines: null,
      exists: false,
      isRuntime: true,
    };
  }

  const fullPath = resolve(join(projectPath, finding.file));

  if (!existsSync(fullPath)) {
    return {
      file: finding.file,
      fullPath,
      extractedLines: null,
      totalLines: null,
      exists: false,
    };
  }

  let src = '';
  try {
    src = readFileSync(fullPath, 'utf8');
  } catch {
    return { file: finding.file, fullPath, extractedLines: null, totalLines: null, exists: false };
  }

  const lines = src.split('\n');
  const totalLines = lines.length;
  const errorLine = finding.line || 1;

  // Finding atrofidagi qatorlarni chiqarish
  let startLine = Math.max(1, errorLine - CONTEXT_LINES_BEFORE);
  let endLine = Math.min(totalLines, errorLine + CONTEXT_LINES_AFTER);

  // Vue SFC uchun — tegishli blokni topamiz (<template>, <script>, <style>)
  if (finding.file.endsWith('.vue')) {
    const blockRange = findVueBlock(lines, errorLine);
    if (blockRange) {
      startLine = Math.max(1, blockRange.start);
      endLine = Math.min(totalLines, blockRange.end);
    }
  }

  // Agar kontekst juda katta bo'lsa, qisqartir
  if (endLine - startLine > MAX_CONTEXT_LINES) {
    startLine = Math.max(1, errorLine - 20);
    endLine = Math.min(totalLines, errorLine + 20);
  }

  // Qatorlarni raqamlar bilan formatlash
  const extractedLines = lines
    .slice(startLine - 1, endLine)
    .map((line, i) => {
      const lineNo = startLine + i;
      const marker = lineNo === errorLine ? '>>>' : '   ';
      return `${marker} ${String(lineNo).padStart(4)}: ${line}`;
    })
    .join('\n');

  return {
    file: finding.file,
    fullPath,
    extractedLines,
    startLine,
    endLine,
    errorLine,
    totalLines,
    exists: true,
    language: detectLanguage(finding.file),
  };
}

// Vue SFC blok chegaralarini topish
function findVueBlock(lines, errorLine) {
  const blocks = [];
  let currentBlock = null;

  lines.forEach((line, i) => {
    const lineNo = i + 1;
    if (/^<(template|script|style)/.test(line.trim())) {
      currentBlock = { start: lineNo, type: line.trim().match(/<(\w+)/)?.[1] };
    } else if (/^<\/(template|script|style)>/.test(line.trim()) && currentBlock) {
      blocks.push({ ...currentBlock, end: lineNo });
      currentBlock = null;
    }
  });

  // errorLine qaysi blokda ekanini topish
  return blocks.find(b => errorLine >= b.start && errorLine <= b.end) || null;
}

function detectLanguage(file) {
  if (file.endsWith('.vue')) return 'vue';
  if (file.endsWith('.tsx') || file.endsWith('.jsx')) return 'jsx';
  if (file.endsWith('.ts')) return 'typescript';
  if (file.endsWith('.js')) return 'javascript';
  if (file.endsWith('.css')) return 'css';
  return 'javascript';
}
