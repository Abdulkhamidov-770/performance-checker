/**
 * common/no-full-library-import
 * Topadi: `import _ from 'lodash'` yoki `import * as moment from 'moment'`.
 */
const HEAVY = {
  'lodash': 'import { debounce } from \'lodash-es\' yoki `import debounce from \'lodash/debounce\'`',
  'moment': '`dayjs` yoki `date-fns` bilan almashtiring (9x kichik)',
  'rxjs': 'import { of } from \'rxjs\' — kerakli operator\'larni alohida import qiling',
  'antd': 'import { Button } from \'antd\' — komponentlarni alohida import qiling',
  'element-ui': '`element-plus` bilan almashtiring va tree-shaking yoqing',
  'vuetify': 'komponentlarni alohida import qiling',
};

export default {
  id: 'common/no-full-library-import',
  severity: 'warning',
  layer: 'lint',
  create(context) {
    return {
      ImportDeclaration(path) {
        const node = path.node;
        const source = node.source?.value;
        if (!source || !(source in HEAVY)) return;
        // Default import: `import _ from 'lodash'`
        // Namespace: `import * as _ from 'lodash'`
        const hasDefault = node.specifiers?.some(s => s.type === 'ImportDefaultSpecifier');
        const hasNamespace = node.specifiers?.some(s => s.type === 'ImportNamespaceSpecifier');
        // Faqat default va namespace muammoli; named import OK
        if (!hasDefault && !hasNamespace) return;

        const line = node.loc?.start?.line || 1;
        const col = (node.loc?.start?.column ?? 0) + 1;
        context.report({
          line, col,
          message: `\`${source}\` to'liq import — tree-shaking ishlamaydi, bundle kattalashadi.`,
          fix: HEAVY[source],
        });
      },
    };
  },
};
