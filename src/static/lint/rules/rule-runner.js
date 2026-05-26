/**
 * Rule runner — ESLint uslubidagi rule API.
 *
 * Har bir rule:
 *   export default {
 *     id: 'vue/v-for-no-key',
 *     severity: 'critical',
 *     layer: 'lint',
 *     create(context) {
 *       return { TemplateElement(node, templateOffset) { ... context.report({...}) } };
 *     }
 *   }
 *
 * context:
 *   - report({ line, col, message, fix, severity? }) — finding qo'shadi
 *   - getSource() — fayl matni
 *   - getFile() — fayl yo'li
 *   - parsed — { templateAst, scriptAst, scriptSetupAst, scriptOffset, scriptSetupOffset, templateOffset }
 *              yoki { ast, framework } JS uchun
 */
import { logger } from '../../../utils/logger.js';
import { safeTraverse } from '../parsers/js-parser.js';

const TEMPLATE_VISITOR_KEYS = new Set(['TemplateElement', 'Interpolation', 'TemplateRoot', 'SFC']);

export function runVueRules(rules, parsed, relFile, src) {
  const findings = [];

  for (const rule of rules) {
    const ctx = createContext({ file: relFile, src, parsed, rule, collect: findings });

    let visitors;
    try {
      visitors = rule.create(ctx);
    } catch (err) {
      logger.debug(`Rule ${rule.id} create() xato: ${err.message}`);
      continue;
    }
    if (!visitors) continue;

    // SFC umumiy visitor
    try {
      if (visitors.SFC) visitors.SFC(parsed);
    } catch (err) {
      logger.debug(`Rule ${rule.id} SFC() xato: ${err.message}`);
    }

    // Template visitors
    if (parsed.templateAst && (visitors.TemplateElement || visitors.Interpolation || visitors.TemplateRoot)) {
      try {
        if (visitors.TemplateRoot) visitors.TemplateRoot(parsed.templateAst);
        walkVueTemplate(parsed.templateAst, parsed.templateOffset || 0, visitors);
      } catch (err) {
        logger.debug(`Rule ${rule.id} template visitor xato: ${err.message}`);
      }
    }

    // Script (Options API) visitors
    if (parsed.scriptAst) {
      runScriptVisitors(visitors, parsed.scriptAst, parsed.scriptOffset || 0, ctx, rule);
    }

    // Script setup visitors
    if (parsed.scriptSetupAst) {
      runScriptVisitors(visitors, parsed.scriptSetupAst, parsed.scriptSetupOffset || 0, ctx, rule);
    }
  }

  return findings;
}

export function runJSRules(rules, ast, relFile, src, framework) {
  const findings = [];

  for (const rule of rules) {
    const ctx = createContext({
      file: relFile,
      src,
      parsed: { ast, framework },
      rule,
      collect: findings,
    });

    let visitors;
    try {
      visitors = rule.create(ctx);
    } catch (err) {
      logger.debug(`Rule ${rule.id} create() xato: ${err.message}`);
      continue;
    }
    if (!visitors || !ast) continue;

    try {
      safeTraverse(ast, withSFCLineOffset(visitors, 0));
    } catch (err) {
      logger.debug(`Rule ${rule.id} traverse xato: ${err.message}`);
    }
  }

  return findings;
}

function createContext({ file, src, parsed, rule, collect }) {
  return {
    file,
    getSource: () => src,
    getFile: () => file,
    parsed,
    report({ line, col, message, fix, severity }) {
      collect.push({
        file,
        line: Math.max(1, line ?? 1),
        col: Math.max(1, col ?? 1),
        rule: rule.id,
        message,
        severity: severity || rule.severity,
        fix: fix || null,
        layer: rule.layer || 'lint',
      });
    },
  };
}

function runScriptVisitors(visitors, ast, lineOffset, ctx, rule) {
  const scriptVisitors = wrapVisitors(visitors, lineOffset, (k) => !TEMPLATE_VISITOR_KEYS.has(k));
  safeTraverse(ast, scriptVisitors);
}

function withSFCLineOffset(visitors, offset) {
  return wrapVisitors(visitors, offset, () => true);
}

function wrapVisitors(visitors, offset, accept) {
  const wrapped = {};
  for (const [key, value] of Object.entries(visitors)) {
    if (!accept(key)) continue;
    if (typeof value === 'function') {
      wrapped[key] = wrapFn(value, offset);
    } else if (value && typeof value === 'object') {
      // Babel'da Foo: { enter, exit } shaklini qo'llaydi
      const nested = {};
      if (typeof value.enter === 'function') nested.enter = wrapFn(value.enter, offset);
      if (typeof value.exit === 'function') nested.exit = wrapFn(value.exit, offset);
      if (Object.keys(nested).length) wrapped[key] = nested;
    }
  }
  return wrapped;
}

function wrapFn(fn, offset) {
  return (path) => {
    if (path?.node?.loc?.start && offset) {
      path.node.__sfcLine = path.node.loc.start.line + offset;
    }
    fn(path, offset);
  };
}

function walkVueTemplate(node, templateOffset, visitors) {
  if (!node) return;
  if (node.type === 1 /* ELEMENT */) {
    if (visitors.TemplateElement) visitors.TemplateElement(node, templateOffset);
  }
  if (node.type === 5 /* INTERPOLATION */) {
    if (visitors.Interpolation) visitors.Interpolation(node, templateOffset);
  }
  if (node.children) {
    for (const child of node.children) walkVueTemplate(child, templateOffset, visitors);
  }
}
