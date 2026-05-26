/**
 * vue/no-sync-route-import
 * Topadi: router fayllarida `import X from './views/X.vue'` (static import) — lazy load kerak.
 *
 * Router fayli aniqlanishi: src yoki AST'da `createRouter` chaqiruvi yoki `routes` array.
 */
const ROUTE_DIRS = /(views|pages|screens|layouts)\//;

export default {
  id: 'vue/no-sync-route-import',
  severity: 'critical',
  layer: 'lint',
  create(context) {
    const src = context.getSource();
    const isRouterFile =
      /createRouter\s*\(/.test(src) ||
      /\brouter[\s\S]{0,80}routes\s*[:=]\s*\[/.test(src);
    if (!isRouterFile) return {};

    return {
      ImportDeclaration(path, offset) {
        const node = path.node;
        const source = node.source?.value;
        if (!source || !ROUTE_DIRS.test(source)) return;
        // import { x } from is fine; default/named static import of route component is the smell
        if (!node.specifiers?.length) return;
        const line = (offset || 0) + (node.loc?.start?.line || 1);
        const col = (node.loc?.start?.column ?? 0) + 1;
        context.report({
          line, col,
          message: `Route komponenti static import (\`${source}\`) — lazy load qilinmagan, initial bundle kattalashadi.`,
          fix: 'Dynamic import bilan almashtiring:\n`component: () => import(\'' + source + '\')`',
        });
      },
    };
  },
};
