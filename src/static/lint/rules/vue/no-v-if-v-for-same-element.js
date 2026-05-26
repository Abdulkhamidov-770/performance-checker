/**
 * vue/no-v-if-v-for-same-element
 * Topadi: bir elementda v-for VA v-if birga ishlatilgan.
 */
export default {
  id: 'vue/no-v-if-v-for-same-element',
  severity: 'critical',
  layer: 'lint',
  create(context) {
    return {
      TemplateElement(node, templateOffset) {
        if (!node.props) return;
        const hasFor = node.props.some(p => p.type === 7 && p.name === 'for');
        const hasIf = node.props.some(p => p.type === 7 && (p.name === 'if' || p.name === 'else-if'));
        if (!hasFor || !hasIf) return;

        const line = (templateOffset || 0) + (node.loc?.start?.line || 1);
        const col = (node.loc?.start?.column ?? 0) + 1;

        context.report({
          line, col,
          message: '`v-for` va `v-if` bir elementda — har render\'da butun list filter qilinadi.',
          fix: '`v-if`ni parent elementga ko\'chiring yoki computed property bilan filter qiling.',
        });
      },
    };
  },
};
