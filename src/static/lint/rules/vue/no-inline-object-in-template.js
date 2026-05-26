/**
 * vue/no-inline-object-in-template
 * Topadi: :prop="{...}" yoki :prop="[...]" — har render'da yangi reference.
 */
export default {
  id: 'vue/no-inline-object-in-template',
  severity: 'warning',
  layer: 'lint',
  create(context) {
    return {
      TemplateElement(node, templateOffset) {
        if (!node.props) return;
        for (const p of node.props) {
          if (p.type !== 7 || p.name !== 'bind') continue;
          const exp = p.exp?.content?.trim();
          if (!exp) continue;
          // Inline object/array literal — { ... } yoki [ ... ]
          if ((exp.startsWith('{') && exp.endsWith('}')) ||
              (exp.startsWith('[') && exp.endsWith(']'))) {
            const line = (templateOffset || 0) + (p.loc?.start?.line || node.loc?.start?.line || 1);
            const col = (p.loc?.start?.column ?? 0) + 1;
            context.report({
              line, col,
              message: 'Template ichida inline object/array — har render\'da yangi reference yaratiladi.',
              fix: 'Computed property yoki `data()` ga ko\'chiring.',
            });
          }
        }
      },
    };
  },
};
