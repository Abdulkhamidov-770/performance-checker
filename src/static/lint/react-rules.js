/**
 * React JSX/TSX performance rules
 * Topilgan muammo: { line, col, rule, message, severity, fix }
 */

function finding(line, col, rule, message, severity, fix) {
  return { line, col, rule, message, severity, fix };
}

function searchLines(lines, pattern, callback) {
  const results = [];
  lines.forEach((line, i) => {
    const match = line.match(pattern);
    if (match) results.push(...(callback(match, i + 1, line) || []));
  });
  return results;
}

const reactRules = [

  // RULE 1: JSX ichida inline funksiya (re-render trigger)
  {
    id: 'react/no-inline-function-in-jsx',
    check(src, lines) {
      return searchLines(
        lines,
        /\bon\w+\s*=\s*\{\s*(function|\(.*?\)\s*=>)/,
        (match, lineNo, line) => [
          finding(lineNo, line.search(/\bon\w+/) + 1,
            'react/no-inline-function-in-jsx',
            'JSX event handler\'da inline funksiya — har render\'da yangi reference.',
            'warning',
            '`useCallback` bilan memoize qiling:\n`const handleClick = useCallback(() => { ... }, [deps])`'
          )
        ]
      );
    }
  },

  // RULE 2: JSX ichida inline object/array
  {
    id: 'react/no-inline-object-in-jsx',
    check(src, lines) {
      return searchLines(
        lines,
        /\w+\s*=\s*\{\s*\{[^}]*\}\s*\}|\bstyle\s*=\s*\{\s*\{/,
        (match, lineNo, line) => [
          finding(lineNo, 1,
            'react/no-inline-object-in-jsx',
            'JSX ichida inline object — har render\'da yangi reference, `memo` ishlamaydi.',
            'warning',
            'Komponent tashqarisida yoki `useMemo` bilan e\'lon qiling.'
          )
        ]
      );
    }
  },

  // RULE 3: useEffect dependensiyasiz (cheksiz loop xavfi)
  {
    id: 'react/use-effect-no-deps',
    check(src, lines) {
      return searchLines(
        lines,
        /useEffect\s*\(\s*(async\s*)?\(/,
        (match, lineNo, line) => {
          // Keyingi 5 qatorda ], [] bor-yo'qligini tekshir
          const nextLines = lines.slice(lineNo, lineNo + 5).join('\n');
          if (!/,\s*\[/.test(nextLines)) {
            return [finding(lineNo, 1,
              'react/use-effect-no-deps',
              '`useEffect` dependency array yo\'q — har render\'da qayta ishlaydi.',
              'critical',
              'Dependency array qo\'shing: `useEffect(() => { ... }, [dep1, dep2])`'
            )];
          }
          return [];
        }
      );
    }
  },

  // RULE 4: React.memo yo'q katta komponentlarda
  {
    id: 'react/suggest-memo',
    check(src, lines) {
      const findings = [];
      // Export qilingan, 50+ qatorli funksional komponent
      const hasExport = /export\s+(default\s+)?function|export\s+(default\s+)?const\s+\w+\s*=/.test(src);
      const lineCount = lines.length;
      const hasMemo = /React\.memo|memo\(/.test(src);
      const hasPropsParam = /function\s+\w+\s*\(\s*\{[^}]+\}|=\s*\(\s*\{[^}]+\}\s*\)\s*=>/.test(src);

      if (hasExport && lineCount > 50 && !hasMemo && hasPropsParam) {
        findings.push(finding(1, 1,
          'react/suggest-memo',
          `Katta komponent (${lineCount} qator) React.memo bilan o'ralmagan.`,
          'info',
          '`export default React.memo(MyComponent)` bilan keraksiz re-render\'larni oldini oling.'
        ));
      }
      return findings;
    }
  },

  // RULE 5: Array index'ni key sifatida ishlatish
  {
    id: 'react/no-array-index-key',
    check(src, lines) {
      return searchLines(
        lines,
        /\.map\s*\(\s*\(\s*\w+\s*,\s*(\w+)\s*\).*key\s*=\s*\{\s*\1\s*\}/,
        (match, lineNo, line) => [
          finding(lineNo, 1,
            'react/no-array-index-key',
            `Array index \`${match[1]}\` ni key sifatida ishlatish — reorder\'da DOM muammosi.`,
            'warning',
            'Unique ID ishlating: `key={item.id}`'
          )
        ]
      );
    }
  },

  // RULE 6: Lazy import yo'q route komponentlar (React Router)
  {
    id: 'react/no-sync-route-import',
    check(src, lines) {
      const findings = [];
      const isRouterFile = /Route\s+path|createBrowserRouter|Switch.*Route/.test(src);
      if (!isRouterFile) return findings;

      lines.forEach((line, i) => {
        if (/^\s*import\s+\w+\s+from\s+['"][./]*(pages|views|screens)/.test(line)) {
          findings.push(finding(i + 1, 1,
            'react/no-sync-route-import',
            'Route komponenti static import — initial bundle kattalashadi.',
            'critical',
            '`React.lazy(() => import(\'./pages/MyPage\'))` bilan almashtiring.'
          ));
        }
      });
      return findings;
    }
  },

  // RULE 7: useMemo/useCallback bo'sh dependency array bilan (hamma vaqt qayta hisoblanadi)
  {
    id: 'react/memo-missing-deps',
    check(src, lines) {
      return searchLines(
        lines,
        /(useMemo|useCallback)\s*\([^,]+,\s*\[\s*\]\s*\)/,
        (match, lineNo) => {
          // [] bo'sh emas, lekin dep ko'rinib turibdi — warning
          return [];
        }
      );
    }
  },

  // RULE 8: useState ichida object (partial update xavfi)
  {
    id: 'react/use-state-object-without-spread',
    check(src, lines) {
      const findings = [];
      lines.forEach((line, i) => {
        // setState({ field: val }) — spread yo'q
        if (/set\w+\(\s*\{[^.]+:[^}]+\}\s*\)/.test(line) && !line.includes('...')) {
          findings.push(finding(i + 1, 1,
            'react/use-state-object-without-spread',
            'setState\'da spread operator yo\'q — boshqa maydonlar o\'chirilishi mumkin.',
            'warning',
            '`setState(prev => ({ ...prev, field: val }))` ishlating.'
          ));
        }
      });
      return findings;
    }
  },

];

export function analyzeReactFile(src, relFile) {
  const lines = src.split('\n');
  const findings = [];

  for (const rule of reactRules) {
    try {
      const ruleFindings = rule.check(src, lines) || [];
      for (const f of ruleFindings) {
        findings.push({ file: relFile, ...f });
      }
    } catch {}
  }

  return findings;
}
