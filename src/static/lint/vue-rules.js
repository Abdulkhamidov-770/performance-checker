/**
 * Vue analyzer — AST-based.
 * - .vue fayllar: @vue/compiler-sfc + @vue/compiler-dom
 * - .js/.ts router fayllari: @babel/parser (Vue-specific router rule'lari)
 */
import { parseVueSFC } from './parsers/vue-parser.js';
import { parseJS } from './parsers/js-parser.js';
import { runVueRules, runJSRules } from './rules/rule-runner.js';
import { VUE_RULES, VUE_SCRIPT_RULES } from './rules/index.js';
import { logger } from '../../utils/logger.js';

export function analyzeVueFile(src, relFile) {
  const isSFC = relFile.endsWith('.vue');

  if (isSFC) {
    let parsed;
    try {
      parsed = parseVueSFC(src);
    } catch (err) {
      logger.debug(`Vue parse xato (${relFile}): ${err.message}`);
      return [];
    }
    const vueFindings = runVueRules(VUE_RULES, parsed, relFile, src);
    const scriptFindings = runVueRules(VUE_SCRIPT_RULES, parsed, relFile, src);
    return [...vueFindings, ...scriptFindings];
  }

  // .js / .ts file (router, store, etc.) — Vue-specific script rules
  const isTs = /\.tsx?$/.test(relFile);
  const ast = parseJS(src, { typescript: isTs });
  if (!ast) return [];
  return runJSRules(VUE_RULES, ast, relFile, src, 'vue');
}
