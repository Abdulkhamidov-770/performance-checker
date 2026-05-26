/**
 * react/no-sync-route-import
 * Topadi: router fayllarida `import X from './pages/X'` — React.lazy kerak.
 */
const ROUTE_DIRS = /(pages|views|screens|layouts)\//;

export default {
  id: 'react/no-sync-route-import',
  severity: 'critical',
  layer: 'lint',
  create(context) {
    const src = context.getSource();
    const isRouter =
      /createBrowserRouter\s*\(/.test(src) ||
      /createHashRouter\s*\(/.test(src) ||
      /<Route\s+path/.test(src) ||
      /\brouter[\s\S]{0,80}routes\s*[:=]\s*\[/.test(src);
    if (!isRouter) return {};

    return {
      ImportDeclaration(path) {
        const node = path.node;
        const source = node.source?.value;
        if (!source || !ROUTE_DIRS.test(source)) return;
        if (!node.specifiers?.length) return;
        // Faqat default va named — React.lazy emas
        const line = node.loc?.start?.line || 1;
        const col = (node.loc?.start?.column ?? 0) + 1;
        context.report({
          line, col,
          message: `Route komponenti static import (\`${source}\`) — initial bundle kattalashadi.`,
          fix: `\`React.lazy(() => import('${source}'))\` bilan almashtiring.`,
        });
      },
    };
  },
};
