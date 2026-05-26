/**
 * react/use-state-object-without-spread
 * Topadi: setXxx({ field: val }) — spread yo'q, boshqa maydonlar o'chirilishi mumkin.
 *
 * AST: CallExpression where callee is Identifier matching /^set[A-Z]/,
 * arguments[0] is ObjectExpression without SpreadElement.
 */
export default {
  id: 'react/use-state-object-without-spread',
  severity: 'warning',
  layer: 'lint',
  create(context) {
    return {
      CallExpression(path) {
        const node = path.node;
        const callee = node.callee;
        if (callee?.type !== 'Identifier') return;
        if (!/^set[A-Z]/.test(callee.name)) return;

        const arg = node.arguments?.[0];
        if (!arg || arg.type !== 'ObjectExpression') return;

        const hasSpread = arg.properties.some(p => p.type === 'SpreadElement');
        if (hasSpread) return;

        // setState({ a: 1 }) — at least 1 named prop
        if (arg.properties.length === 0) return;

        const line = node.loc?.start?.line || 1;
        const col = (node.loc?.start?.column ?? 0) + 1;
        context.report({
          line, col,
          message: `\`${callee.name}\`'da spread operator yo\'q — boshqa maydonlar o'chirilishi mumkin.`,
          fix: `\`${callee.name}(prev => ({ ...prev, field: val }))\` ishlating.`,
        });
      },
    };
  },
};
