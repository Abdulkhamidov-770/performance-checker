/**
 * common/await-in-loop
 * Topadi: for/while ichida await (N+1 muammo).
 *
 * `.forEach()` async callback ichidagi await — tutilmaydi (forEach awaitable emas).
 */
const LOOP_TYPES = new Set([
  'ForStatement', 'ForOfStatement', 'ForInStatement', 'WhileStatement', 'DoWhileStatement',
]);

export default {
  id: 'common/await-in-loop',
  severity: 'warning',
  layer: 'lint',
  create(context) {
    return {
      AwaitExpression(path) {
        const node = path.node;
        let p = path.parentPath;
        while (p) {
          // Hozirgi async function bo'lsa — chegara
          if (p.node?.type === 'FunctionDeclaration' ||
              p.node?.type === 'FunctionExpression' ||
              p.node?.type === 'ArrowFunctionExpression') {
            // Lekin loop ichida joylashgan func body bo'lsa, awaitable emas (forEach callback) — to'xtaymiz
            const grandParent = p.parentPath;
            if (grandParent?.node?.type === 'CallExpression') {
              return; // forEach/map ichidagi async callback
            }
            return; // boshqa funktsiyaga to'g'ri keldi — loop emas
          }
          if (LOOP_TYPES.has(p.node?.type)) {
            const line = node.loc?.start?.line || 1;
            const col = (node.loc?.start?.column ?? 0) + 1;
            context.report({
              line, col,
              message: 'Loop ichida `await` — N ta so\'rov ketma-ket, parallel emas.',
              fix: '`Promise.all()` bilan parallel ishlating:\n`await Promise.all(items.map(item => fetch(item)))`',
            });
            return;
          }
          p = p.parentPath;
        }
      },
    };
  },
};
