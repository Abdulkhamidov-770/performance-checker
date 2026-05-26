/**
 * common/uncleared-timer
 * Topadi: setTimeout/setInterval chaqirilgan, lekin clearTimeout/clearInterval umumdan yo'q.
 *
 * Fayl darajasi: setTimeout/setInterval bor, clear yo'q — har bir timer uchun warning.
 */
export default {
  id: 'common/uncleared-timer',
  severity: 'warning',
  layer: 'lint',
  create(context) {
    const timers = [];
    let hasClear = false;
    return {
      CallExpression(path) {
        const node = path.node;
        const name = getFuncName(node.callee);
        if (name === 'setTimeout' || name === 'setInterval') {
          timers.push(node);
        }
        if (name === 'clearTimeout' || name === 'clearInterval') {
          hasClear = true;
        }
      },
      Program: {
        exit() {
          if (hasClear) return;
          for (const t of timers) {
            const line = t.loc?.start?.line || 1;
            const col = (t.loc?.start?.column ?? 0) + 1;
            context.report({
              line, col,
              message: 'setTimeout/setInterval tozalanmagan — memory leak xavfi.',
              fix: 'onUnmounted (Vue) yoki useEffect cleanup (React) da clearTimeout/clearInterval chaqiring.',
            });
          }
        },
      },
    };
  },
};

function getFuncName(callee) {
  if (callee?.type === 'Identifier') return callee.name;
  if (callee?.type === 'MemberExpression') return callee.property?.name;
  return null;
}
