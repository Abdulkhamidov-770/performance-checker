/**
 * vue/v-for-no-key
 * Topadi: <el v-for="x in xs"> bo'lib, ammo :key dir bo'lmagan element.
 */
export default {
  id: 'vue/v-for-no-key',
  severity: 'critical',
  layer: 'lint',
  create(context) {
    return {
      TemplateElement(node, templateOffset) {
        if (!node.props) return;
        const vFor = node.props.find(p => p.type === 7 && p.name === 'for');
        if (!vFor) return;

        const hasKey = node.props.some(p => p.type === 7 && p.name === 'bind' && p.arg?.content === 'key');
        if (hasKey) return;

        // Template komponentlari (<template v-for=...>) atrofidagi child'da key bo'lishi mumkin
        const line = (templateOffset || 0) + (vFor.loc?.start?.line || node.loc?.start?.line || 1);
        const col = (vFor.loc?.start?.column ?? 0) + 1;

        context.report({
          line, col,
          message: '`v-for` da `:key` yo\'q — DOM diffing sekinlashadi.',
          fix: '`:key` attribut qo\'shing: `v-for="item in list" :key="item.id"`',
        });
      },
    };
  },
};
