/**
 * vue/prefer-v-show-for-toggle
 * Topadi: v-if="isOpen|isVisible|isMenuOpen|show|visible" — tez-tez toggle bo'ladigan element.
 */
const TOGGLE_PATTERN = /^(is[A-Z]\w*(Open|Visible|Show|Active|Toggle|Hidden)|show\w*|visible\w*|open\w*|hidden\w*|active\w*|expanded\w*|collapsed\w*)$/;

export default {
  id: 'vue/prefer-v-show-for-toggle',
  severity: 'info',
  layer: 'lint',
  create(context) {
    return {
      TemplateElement(node, templateOffset) {
        if (!node.props) return;
        const vIf = node.props.find(p => p.type === 7 && p.name === 'if');
        if (!vIf) return;
        const exp = vIf.exp?.content?.trim();
        if (!exp) return;

        // Negation ham — !isOpen
        const cleaned = exp.replace(/^!/, '').trim();
        if (!TOGGLE_PATTERN.test(cleaned)) return;

        const line = (templateOffset || 0) + (vIf.loc?.start?.line || node.loc?.start?.line || 1);
        const col = (vIf.loc?.start?.column ?? 0) + 1;
        context.report({
          line, col,
          message: `\`v-if="${exp}"\` — tez-tez toggle bo'ladigan element uchun \`v-show\` tezroq.`,
          fix: '`v-show` DOM elementni saqlaydi, faqat `display` o\'zgartiradi. Mount/unmount yo\'q.',
        });
      },
    };
  },
};
