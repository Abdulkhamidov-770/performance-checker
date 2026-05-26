/**
 * JS/TS/JSX uchun AST parser wrapper.
 * @babel/parser + @babel/traverse atrofida xavfsiz wrapper.
 */
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';

const traverse = traverseModule.default || traverseModule;

const BASE_PLUGINS = [
  'jsx',
  'asyncGenerators',
  'classProperties',
  'classPrivateProperties',
  'classPrivateMethods',
  'decorators-legacy',
  'doExpressions',
  'dynamicImport',
  'exportDefaultFrom',
  'exportNamespaceFrom',
  'functionBind',
  'functionSent',
  'importMeta',
  'logicalAssignment',
  'nullishCoalescingOperator',
  'numericSeparator',
  'objectRestSpread',
  'optionalCatchBinding',
  'optionalChaining',
  'topLevelAwait',
  'throwExpressions',
];

/**
 * @param {string} src
 * @param {Object} opts - { typescript?: boolean, sourceType?: 'module' | 'script' }
 * @returns {Object|null} AST node or null on parse failure
 */
export function parseJS(src, opts = {}) {
  const plugins = [...BASE_PLUGINS];
  if (opts.typescript) plugins.push('typescript');

  try {
    return parse(src, {
      sourceType: opts.sourceType || 'module',
      allowReturnOutsideFunction: true,
      allowAwaitOutsideFunction: true,
      errorRecovery: true,
      plugins,
      tokens: false,
      ranges: false,
    });
  } catch (err) {
    return null;
  }
}

/**
 * Traverse helper — har bir visitor uchun xato'larni tutadi.
 * @param {Object} ast
 * @param {Object} visitors
 */
export function safeTraverse(ast, visitors) {
  if (!ast) return;
  try {
    traverse(ast, visitors);
  } catch {
    // visitor xatosi butun analiz'ni to'xtatmasin
  }
}

/**
 * Node loc'dan { line, col } chiqarish.
 */
export function nodeLoc(node) {
  if (!node?.loc?.start) return { line: 1, col: 1 };
  return {
    line: node.loc.start.line,
    col: (node.loc.start.column ?? 0) + 1,
  };
}
