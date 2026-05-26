/**
 * common/unremoved-event-listener
 * Topadi: addEventListener bor, removeEventListener yo'q.
 */
export default {
  id: 'common/unremoved-event-listener',
  severity: 'warning',
  layer: 'lint',
  create(context) {
    const adds = [];
    let hasRemove = false;
    return {
      CallExpression(path) {
        const node = path.node;
        const name = node.callee?.type === 'MemberExpression' ? node.callee.property?.name : null;
        if (name === 'addEventListener') adds.push(node);
        if (name === 'removeEventListener') hasRemove = true;
      },
      Program: {
        exit() {
          if (hasRemove) return;
          for (const a of adds) {
            const line = a.loc?.start?.line || 1;
            const col = (a.loc?.start?.column ?? 0) + 1;
            context.report({
              line, col,
              message: 'addEventListener chaqirilgan lekin removeEventListener yo\'q — memory leak.',
              fix: 'onUnmounted/useEffect cleanup\'da removeEventListener chaqiring.',
            });
          }
        },
      },
    };
  },
};
