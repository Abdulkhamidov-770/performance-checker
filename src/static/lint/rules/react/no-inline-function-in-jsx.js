/**
 * react/no-inline-function-in-jsx
 * Topadi: <Btn onClick={() => ...}> yoki <Btn onChange={function(){}}> — inline function.
 *
 * AST: JSXAttribute where value is JSXExpressionContainer whose expression is
 * ArrowFunctionExpression or FunctionExpression, and attribute name starts with "on".
 */
export default {
  id: 'react/no-inline-function-in-jsx',
  severity: 'warning',
  layer: 'lint',
  create(context) {
    return {
      JSXAttribute(path) {
        const node = path.node;
        const name = node.name?.name;
        if (typeof name !== 'string' || !/^on[A-Z]/.test(name)) return;
        const v = node.value;
        if (!v || v.type !== 'JSXExpressionContainer') return;
        const expr = v.expression;
        if (!expr) return;
        if (expr.type !== 'ArrowFunctionExpression' && expr.type !== 'FunctionExpression') return;

        const line = node.loc?.start?.line || 1;
        const col = (node.loc?.start?.column ?? 0) + 1;
        context.report({
          line, col,
          message: `JSX \`${name}\`'da inline funksiya — har render'da yangi reference.`,
          fix: '`useCallback` bilan memoize qiling:\n`const handler = useCallback(() => { ... }, [deps])`',
        });
      },
    };
  },
};
