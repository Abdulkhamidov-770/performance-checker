/**
 * Common JS/TS analyzer — AST-based.
 */
import { parseJS } from './parsers/js-parser.js';
import { runJSRules } from './rules/rule-runner.js';
import { COMMON_RULES } from './rules/index.js';
import { logger } from '../../utils/logger.js';

export function analyzeCommonFile(src, relFile, framework) {
  const isTs = /\.tsx?$/.test(relFile);
  const ast = parseJS(src, { typescript: isTs });
  if (!ast) {
    logger.debug(`Common parse xato (${relFile})`);
    return [];
  }
  return runJSRules(COMMON_RULES, ast, relFile, src, framework?.framework || 'unknown');
}
