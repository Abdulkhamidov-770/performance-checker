/**
 * common/no-console-in-prod
 * Topadi: console.log/warn/error/info/debug chaqiruvlari.
 */
const METHODS = new Set(['log', 'warn', 'error', 'info', 'debug']);

export default {
  id: 'common/no-console-in-prod',
  severity: 'info',
  layer: 'lint',
  create(context) {
    return {
      CallExpression(path) {
        const node = path.node;
        const callee = node.callee;
        if (callee?.type !== 'MemberExpression') return;
        if (callee.object?.name !== 'console') return;
        if (!METHODS.has(callee.property?.name)) return;
        const line = node.loc?.start?.line || 1;
        const col = (node.loc?.start?.column ?? 0) + 1;
        context.report({
          line, col,
          message: `console.${callee.property.name} production kodda — bundle'dan chiqarish kerak.`,
          fix: 'Vite: `drop: [\'console\']` yoki terser `drop_console: true` ishlatting.',
        });
      },
    };
  },
};
