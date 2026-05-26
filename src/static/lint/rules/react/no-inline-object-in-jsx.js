/**
 * react/no-inline-object-in-jsx
 * Topadi: <C style={{...}}>, <C prop={{ ... }}>, <C arr={[...]}> — har render'da yangi reference.
 */
export default {
  id: 'react/no-inline-object-in-jsx',
  severity: 'warning',
  layer: 'lint',
  create(context) {
    return {
      JSXAttribute(path) {
        const node = path.node;
        const v = node.value;
        if (!v || v.type !== 'JSXExpressionContainer') return;
        const expr = v.expression;
        if (!expr) return;
        if (expr.type !== 'ObjectExpression' && expr.type !== 'ArrayExpression') return;

        const line = node.loc?.start?.line || 1;
        const col = (node.loc?.start?.column ?? 0) + 1;
        const name = node.name?.name || 'prop';
        context.report({
          line, col,
          message: `JSX \`${name}\`'da inline object/array — har render'da yangi reference, \`memo\` ishlamaydi.`,
          fix: 'Komponent tashqarisida yoki `useMemo` bilan e\'lon qiling.',
        });
      },
    };
  },
};
