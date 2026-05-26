/**
 * vue/no-complex-expression-in-template
 * Topadi: {{ ... }} yoki :prop="..." ichida murakkab ifoda (ternary + chain access yoki 60+ char).
 */
export default {
  id: 'vue/no-complex-expression-in-template',
  severity: 'warning',
  layer: 'lint',
  create(context) {
    return {
      Interpolation(node, templateOffset) {
        const exp = node.content?.content?.trim();
        if (!exp) return;
        const complex =
          (exp.includes('?') && exp.includes('.')) ||
          exp.length > 60;
        if (!complex) return;
        const line = (templateOffset || 0) + (node.loc?.start?.line || 1);
        const col = (node.loc?.start?.column ?? 0) + 1;
        context.report({
          line, col,
          message: `Template ifodasi murakkab (\`${exp.slice(0, 40)}...\`) — har render\'da qayta hisoblanadi.`,
          fix: 'Computed property ga ko\'chiring: `computed: { myValue() { return ... } }`',
        });
      },
    };
  },
};
