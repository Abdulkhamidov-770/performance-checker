/**
 * Umumiy JS/TS performance rules — Vue ham React ham uchun
 */

function finding(line, col, rule, message, severity, fix) {
  return { line, col, rule, message, severity, fix };
}

const commonRules = [

  // RULE 1: console.log production kodda
  {
    id: 'common/no-console-in-prod',
    check(src, lines) {
      const findings = [];
      lines.forEach((line, i) => {
        if (/console\.(log|warn|error|info|debug)\(/.test(line) && !line.trim().startsWith('//')) {
          findings.push(finding(i + 1, line.search(/console/) + 1,
            'common/no-console-in-prod',
            'console.log production kodda — bundle\'dan chiqarish kerak.',
            'info',
            'Vite: `drop: [\'console\']` yoki terser `drop_console: true` ishlatting.'
          ));
        }
      });
      return findings;
    }
  },

  // RULE 2: Butun kutubxona import (tree-shaking o'chib qoladi)
  {
    id: 'common/no-full-library-import',
    check(src, lines) {
      const findings = [];
      const dangerousImports = {
        'lodash': 'import { debounce } from \'lodash-es\' yoki `import debounce from \'lodash/debounce\'`',
        'moment': '`dayjs` yoki `date-fns` bilan almashtiring (9x kichik)',
        'rxjs': 'import { of } from \'rxjs\' — kerakli operator\'larni alohida import qiling',
        'antd': 'import { Button } from \'antd\' — komponentlarni alohida import qiling',
        'element-ui': '`element-plus` bilan almashtiring va tree-shaking yoqing',
        'vuetify': 'komponentlarni alohida import qiling',
      };

      lines.forEach((line, i) => {
        for (const [lib, fix] of Object.entries(dangerousImports)) {
          if (new RegExp(`import\\s+(\\*\\s+as\\s+\\w+|\\w+)\\s+from\\s+['"]${lib}['"]`).test(line)) {
            findings.push(finding(i + 1, 1,
              'common/no-full-library-import',
              `\`${lib}\` to'liq import — tree-shaking ishlamaydi, bundle kattalashadi.`,
              'warning',
              fix
            ));
          }
        }
      });
      return findings;
    }
  },

  // RULE 3: Synchronous heavy computation main thread'da
  {
    id: 'common/heavy-sync-computation',
    check(src, lines) {
      const findings = [];
      lines.forEach((line, i) => {
        if (/\bJSON\.parse\(|JSON\.stringify\(/.test(line)) {
          const prevLines = lines.slice(Math.max(0, i - 3), i).join('\n');
          // Loop ichida JSON parse/stringify
          if (/for|while|forEach|map/.test(prevLines)) {
            findings.push(finding(i + 1, 1,
              'common/heavy-sync-computation',
              'Loop ichida JSON.parse/stringify — katta ma\'lumotlarda UI freeze bo\'lishi mumkin.',
              'warning',
              'Web Worker yoki bir martalik parse ishlatib, natijani cache qiling.'
            ));
          }
        }
      });
      return findings;
    }
  },

  // RULE 4: setTimeout/setInterval tozalanmagan (memory leak)
  {
    id: 'common/uncleared-timer',
    check(src, lines) {
      const findings = [];
      const timerLines = [];
      const clearLines = [];

      lines.forEach((line, i) => {
        if (/\bsetTimeout\b|\bsetInterval\b/.test(line)) timerLines.push(i + 1);
        if (/\bclearTimeout\b|\bclearInterval\b/.test(line)) clearLines.push(i + 1);
      });

      // Timer bor lekin clear yo'q
      if (timerLines.length > 0 && clearLines.length === 0) {
        for (const ln of timerLines) {
          findings.push(finding(ln, 1,
            'common/uncleared-timer',
            'setTimeout/setInterval tozalanmagan — memory leak xavfi.',
            'warning',
            'onUnmounted (Vue) yoki useEffect cleanup (React) da clearTimeout/clearInterval chaqiring.'
          ));
        }
      }
      return findings;
    }
  },

  // RULE 5: await loop ichida (N+1 muammo)
  {
    id: 'common/await-in-loop',
    check(src, lines) {
      const findings = [];
      let inLoop = false;
      let depth = 0;

      lines.forEach((line, i) => {
        if (/\b(for\s+\(|for\s+of|for\s+in|while\s*\(|forEach\s*\()/.test(line)) {
          inLoop = true;
          depth = 0;
        }
        if (inLoop) {
          depth += (line.match(/\{/g) || []).length;
          depth -= (line.match(/\}/g) || []).length;

          if (/\bawait\b/.test(line)) {
            findings.push(finding(i + 1, line.indexOf('await') + 1,
              'common/await-in-loop',
              'Loop ichida `await` — N ta so\'rov ketma-ket, parallel emas.',
              'warning',
              '`Promise.all()` bilan parallel ishlating:\n`await Promise.all(items.map(item => fetch(item)))`'
            ));
          }
          if (depth <= 0) inLoop = false;
        }
      });
      return findings;
    }
  },

  // RULE 6: EventListener olib tashlanmagan (memory leak)
  {
    id: 'common/unremoved-event-listener',
    check(src, lines) {
      const findings = [];
      const addLines = [];
      const removeLines = [];

      lines.forEach((line, i) => {
        if (/addEventListener\(/.test(line)) addLines.push(i + 1);
        if (/removeEventListener\(/.test(line)) removeLines.push(i + 1);
      });

      if (addLines.length > 0 && removeLines.length === 0) {
        for (const ln of addLines) {
          findings.push(finding(ln, 1,
            'common/unremoved-event-listener',
            'addEventListener chaqirilgan lekin removeEventListener yo\'q — memory leak.',
            'warning',
            'onUnmounted/useEffect cleanup\'da removeEventListener chaqiring.'
          ));
        }
      }
      return findings;
    }
  },

];

export function analyzeCommonFile(src, relFile, framework) {
  const lines = src.split('\n');
  const findings = [];

  for (const rule of commonRules) {
    try {
      const ruleFindings = rule.check(src, lines, framework) || [];
      for (const f of ruleFindings) {
        findings.push({ file: relFile, ...f });
      }
    } catch {}
  }

  return findings;
}
