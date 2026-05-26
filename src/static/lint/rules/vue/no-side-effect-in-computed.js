/**
 * vue/no-side-effect-in-computed
 * Topadi: computed property ichida side effect (this.x = ..., commit, dispatch, axios, fetch).
 *
 * AST yondashuvi: Options API'da `computed: { foo() { ... } }` yoki `computed: { foo: () => ... }`
 * ichida AssignmentExpression (this.x = y), CallExpression (axios yoki fetch chaqiruvi).
 */
const SIDE_EFFECT_CALLEES = new Set(['fetch']);
const SIDE_EFFECT_MEMBER_OBJECTS = new Set(['axios', '$store']);

export default {
  id: 'vue/no-side-effect-in-computed',
  severity: 'critical',
  layer: 'lint',
  create(context) {
    return {
      ObjectProperty(path, offset) {
        const node = path.node;
        // Looking for `computed: { ... }` property
        if (node.key?.name !== 'computed') return;
        const value = node.value;
        if (!value || (value.type !== 'ObjectExpression')) return;

        // For each computed prop, traverse its body
        for (const prop of value.properties) {
          const fn =
            prop.type === 'ObjectMethod' ? prop :
            (prop.type === 'ObjectProperty' &&
              (prop.value?.type === 'FunctionExpression' || prop.value?.type === 'ArrowFunctionExpression'))
              ? prop.value
              : null;
          if (!fn) continue;
          const name = prop.key?.name || prop.key?.value || 'computed';
          walkBody(fn.body, (sideNode) => {
            const line = (offset || 0) + (sideNode.loc?.start?.line || 1);
            const col = (sideNode.loc?.start?.column ?? 0) + 1;
            context.report({
              line, col,
              message: `Computed property \`${name}\` ichida side effect — cache buziladi, cheksiz loop xavfi.`,
              fix: 'Side effect\'larni `watch` yoki `methods` ga ko\'chiring.',
            });
          });
        }
      },
    };
  },
};

function walkBody(body, report) {
  if (!body) return;
  walk(body, report);
}

function walk(node, report) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const n of node) walk(n, report);
    return;
  }
  // ThisExpression assignment: `this.x = y`
  if (node.type === 'AssignmentExpression') {
    const left = node.left;
    if (left?.type === 'MemberExpression' && left.object?.type === 'ThisExpression') {
      report(node);
    }
  }
  // axios.get(...), fetch(...), this.$store.commit/dispatch
  if (node.type === 'CallExpression') {
    const callee = node.callee;
    if (callee?.type === 'Identifier' && SIDE_EFFECT_CALLEES.has(callee.name)) {
      report(node);
    }
    if (callee?.type === 'MemberExpression') {
      const obj = callee.object;
      if (obj?.type === 'Identifier' && SIDE_EFFECT_MEMBER_OBJECTS.has(obj.name)) {
        report(node);
      }
      // this.$store.commit / dispatch
      if (obj?.type === 'MemberExpression' &&
          obj.object?.type === 'ThisExpression' &&
          obj.property?.name === '$store') {
        report(node);
      }
    }
  }
  for (const key in node) {
    if (key === 'loc' || key === 'leadingComments' || key === 'trailingComments' || key === 'innerComments' || key === 'extra') continue;
    const child = node[key];
    if (child && typeof child === 'object') walk(child, report);
  }
}
