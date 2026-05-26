/**
 * vue/no-emit-in-loop
 * Topadi: for/while/forEach/map ichida this.$emit(...) yoki emit(...).
 *
 * AST: CallExpression where callee identifier is "emit" or "$emit",
 * va u loop node ichida joylashgan (parent chain).
 */
const LOOP_TYPES = new Set([
  'ForStatement', 'ForOfStatement', 'ForInStatement', 'WhileStatement', 'DoWhileStatement',
]);
const LOOP_CALLEES = new Set(['forEach', 'map', 'filter', 'reduce']);

export default {
  id: 'vue/no-emit-in-loop',
  severity: 'warning',
  layer: 'lint',
  create(context) {
    return {
      CallExpression(path, offset) {
        const node = path.node;
        // emit() yoki this.$emit()
        let isEmit = false;
        if (node.callee?.type === 'Identifier' && node.callee.name === 'emit') isEmit = true;
        if (node.callee?.type === 'MemberExpression' &&
            node.callee.object?.type === 'ThisExpression' &&
            node.callee.property?.name === '$emit') isEmit = true;
        if (!isEmit) return;

        if (!isInsideLoop(path)) return;

        const line = (offset || 0) + (node.loc?.start?.line || 1);
        const col = (node.loc?.start?.column ?? 0) + 1;
        context.report({
          line, col,
          message: 'Loop ichida `$emit` — parent ko\'p marta re-render bo\'lishi mumkin.',
          fix: 'Loop natijalarini yig\'ib, loopdan keyin bitta emit qiling.',
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
