/**
 * react/use-effect-no-deps
 * Topadi: useEffect(() => {...}) — dependency array yo'q.
 */
export default {
  id: 'react/use-effect-no-deps',
  severity: 'critical',
  layer: 'lint',
  create(context) {
    return {
      CallExpression(path) {
        const node = path.node;
        const callee = node.callee;
        const name = callee?.type === 'Identifier' ? callee.name :
                     callee?.type === 'MemberExpression' ? callee.property?.name : null;
        if (name !== 'useEffect' && name !== 'useLayoutEffect') return;

        const args = node.arguments;
        if (!args || args.length < 1) return;
        // Faqat 1 ta argument — deps yo'q
        if (args.length === 1) {
          const line = node.loc?.start?.line || 1;
          const col = (node.loc?.start?.column ?? 0) + 1;
          context.report({
            line, col,
            message: `\`${name}\` dependency array yo\'q — har render\'da qayta ishlaydi.`,
            fix: `Dependency array qo'shing: \`${name}(() => { ... }, [dep1, dep2])\``,
          });
        }
      },
    };
  },
};
