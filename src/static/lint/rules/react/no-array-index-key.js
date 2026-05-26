/**
 * react/no-array-index-key
 * Topadi: items.map((x, i) => <El key={i} />) — array index'ni key sifatida.
 *
 * AST: CallExpression callee.property.name === 'map', arrow's 2nd param `idx`,
 * arrow body bo'sh element bo'lib, `key={idx}` attribute mavjud.
 */
export default {
  id: 'react/no-array-index-key',
  severity: 'warning',
  layer: 'lint',
  create(context) {
    return {
      CallExpression(path) {
        const node = path.node;
        const callee = node.callee;
        if (callee?.type !== 'MemberExpression') return;
        if (callee.property?.name !== 'map') return;
        const arg = node.arguments?.[0];
        if (!arg) return;
        if (arg.type !== 'ArrowFunctionExpression' && arg.type !== 'FunctionExpression') return;
        const params = arg.params || [];
        if (params.length < 2) return;
        const idxParam = params[1];
        const idxName = idxParam?.type === 'Identifier' ? idxParam.name : null;
        if (!idxName) return;

        // Body ichida key={idxName} bor JSX elementi qidiraman
        const finding = findKeyIndexUsage(arg.body, idxName);
        if (!finding) return;

        const line = finding.loc?.start?.line || node.loc?.start?.line || 1;
        const col = (finding.loc?.start?.column ?? 0) + 1;
        context.report({
          line, col,
          message: `Array index \`${idxName}\` ni key sifatida ishlatish — reorder'da DOM muammosi.`,
          fix: 'Unique ID ishlating: `key={item.id}`',
        });
      },
    };
  },
};

function findKeyIndexUsage(node, idxName) {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const found = findKeyIndexUsage(n, idxName);
      if (found) return found;
    }
    return null;
  }
  if (node.type === 'JSXAttribute' && node.name?.name === 'key') {
    const expr = node.value?.expression;
    if (expr?.type === 'Identifier' && expr.name === idxName) return node;
  }
  for (const key in node) {
    if (key === 'loc' || key === 'leadingComments' || key === 'trailingComments' || key === 'extra') continue;
    const child = node[key];
    if (child && typeof child === 'object') {
      const found = findKeyIndexUsage(child, idxName);
      if (found) return found;
    }
  }
  return null;
}
