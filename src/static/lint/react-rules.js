/**
 * React JSX/TSX analyzer — AST-based (regex emas).
 * @babel/parser + @babel/traverse.
 */
import { parseJS } from './parsers/js-parser.js';
import { runJSRules } from './rules/rule-runner.js';
import { REACT_RULES, COMMON_RULES } from './rules/index.js';
import { logger } from '../../utils/logger.js';

export function analyzeReactFile(src, relFile) {
  const isTs = /\.tsx?$/.test(relFile);
  const ast = parseJS(src, { typescript: isTs });
  if (!ast) {
    logger.debug(`React parse xato (${relFile})`);
    return [];
  }

  const reactFindings = runJSRules(REACT_RULES, ast, relFile, src, 'react');
  const commonFindings = runJSRules(COMMON_RULES, ast, relFile, src, 'react');

  return [...reactFindings, ...commonFindings];
}
