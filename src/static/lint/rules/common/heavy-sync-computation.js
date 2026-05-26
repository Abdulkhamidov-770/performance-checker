/**
 * common/heavy-sync-computation
 * Topadi: for/forEach/map ichida JSON.parse yoki JSON.stringify — UI freeze xavfi.
 */
const LOOP_TYPES = new Set([
  'ForStatement', 'ForOfStatement', 'ForInStatement', 'WhileStatement', 'DoWhileStatement',
]);
const LOOP_CALLEES = new Set(['forEach', 'map', 'filter', 'reduce']);

export default {
  id: 'common/heavy-sync-computation',
  severity: 'warning',
  layer: 'lint',
  create(context) {
    const seenLines = new Set();
    return {
      CallExpression(path) {
        const node = path.node;
        if (node.callee?.type !== 'MemberExpression') return;
        if (node.callee.object?.name !== 'JSON') return;
        const method = node.callee.property?.name;
        if (method !== 'parse' && method !== 'stringify') return;

        if (!isInsideLoop(path)) return;
        const line = node.loc?.start?.line || 1;
        if (seenLines.has(line)) return;
        seenLines.add(line);
        const col = (node.loc?.start?.column ?? 0) + 1;
        context.report({
          line, col,
          message: `Loop ichida JSON.${method} — katta ma\'lumotlarda UI freeze bo'lishi mumkin.`,
          fix: 'Web Worker yoki bir martalik parse ishlatib, natijani cache qiling.',
        });
      },
    };
  },
};

function isInsideLoop(path) {
  let p = path.parentPath;
  while (p) {
    if (LOOP_TYPES.has(p.node?.type)) return true;
    if (p.node?.type === 'CallExpression') {
      const callee = p.node.callee;
      if (callee?.type === 'MemberExpression' && LOOP_CALLEES.has(callee.property?.name)) return true;
    }
    p = p.parentPath;
  }
  return false;
}
