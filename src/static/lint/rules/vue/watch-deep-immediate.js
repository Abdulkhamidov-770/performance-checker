/**
 * vue/watch-deep-immediate
 * Topadi: watch: { x: { handler, deep: true, immediate: true } } — katta obyektlarda sekin.
 */
export default {
  id: 'vue/watch-deep-immediate',
  severity: 'warning',
  layer: 'lint',
  create(context) {
    return {
      ObjectProperty(path, offset) {
        const node = path.node;
        if (node.key?.name !== 'watch') return;
        const value = node.value;
        if (!value || value.type !== 'ObjectExpression') return;

        for (const watchProp of value.properties) {
          if (watchProp.type !== 'ObjectProperty') continue;
          const cfg = watchProp.value;
          if (!cfg || cfg.type !== 'ObjectExpression') continue;
          let deep = false, immediate = false;
          for (const p of cfg.properties) {
            if (p.type !== 'ObjectProperty') continue;
            const name = p.key?.name;
            if (name === 'deep' && p.value?.value === true) deep = true;
            if (name === 'immediate' && p.value?.value === true) immediate = true;
          }
          if (deep && immediate) {
            const line = (offset || 0) + (watchProp.loc?.start?.line || 1);
            const col = (watchProp.loc?.start?.column ?? 0) + 1;
            const name = watchProp.key?.name || watchProp.key?.value || 'watch';
            context.report({
              line, col,
              message: `\`${name}\` watch'ida \`deep: true\` + \`immediate: true\` birga — katta obyektlarda sekin.`,
              fix: 'Faqat kerakli maydonlarni watch qiling yoki computed property ishlating.',
            });
          }
        }
      },
    };
  },
};
