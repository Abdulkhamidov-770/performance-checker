/**
 * Vue SFC performance rules — regex-based AST approximation
 * Har bir rule: { id, check(src, lines) => findings[] }
 *
 * Topilgan muammo: { line, col, rule, message, severity, fix }
 * severity: 'critical' | 'warning' | 'info'
 */

// ─── Yordamchi funksiyalar ────────────────────────────────────────────────────

function finding(line, col, rule, message, severity, fix) {
  return { line, col, rule, message, severity, fix };
}

function searchLines(lines, pattern, callback) {
  const results = [];
  lines.forEach((line, i) => {
    const match = line.match(pattern);
    if (match) {
      results.push(...(callback(match, i + 1, line) || []));
    }
  });
  return results;
}

function extractBlock(src, startTag, endTag) {
  const start = src.indexOf(startTag);
  const end = src.lastIndexOf(endTag);
  if (start === -1 || end === -1) return '';
  return src.slice(start + startTag.length, end);
}

function lineNumber(src, index) {
  return src.slice(0, index).split('\n').length;
}

// ─── Vue rules ───────────────────────────────────────────────────────────────

const vueRules = [

  // RULE 1: v-for without :key
  {
    id: 'vue/v-for-no-key',
    check(src, lines, fileSrc) {
      const findings = [];
      lines.forEach((line, i) => {
        if (line.includes('v-for') && !line.includes(':key') && !line.includes('v-bind:key')) {
          // keyni keyingi 2 qatorda tekshir
          const nextLines = lines.slice(i + 1, i + 3).join(' ');
          if (!nextLines.includes(':key')) {
            findings.push(finding(
              i + 1, line.indexOf('v-for') + 1,
              'vue/v-for-no-key',
              '`v-for` da `:key` yo\'q — DOM diffing sekinlashadi.',
              'critical',
              '`:key` attribut qo\'shing: `v-for="item in list" :key="item.id"`'
            ));
          }
        }
      });
      return findings;
    }
  },

  // RULE 2: v-if va v-for bir elementda
  {
    id: 'vue/no-v-if-v-for-same-element',
    check(src, lines) {
      return searchLines(lines, /v-for.+v-if|v-if.+v-for/, (match, lineNo, line) => [
        finding(lineNo, 1,
          'vue/no-v-if-v-for-same-element',
          '`v-for` va `v-if` bir elementda — har render\'da butun list filter qilinadi.',
          'critical',
          '`v-if`ni parent elementga ko\'chiring yoki computed property bilan filter qiling.'
        )
      ]);
    }
  },

  // RULE 3: Inline object/array literal v-bind ichida (re-render trigger)
  {
    id: 'vue/no-inline-object-in-template',
    check(src, lines) {
      const findings = [];
      const templateBlock = extractBlock(src, '<template>', '</template>');
      if (!templateBlock) return findings;
      const templateLines = templateBlock.split('\n');

      templateLines.forEach((line, i) => {
        // :prop="{ ... }" yoki :prop="[ ... ]"
        if (/:[\w-]+="\s*\{[^}]+\}"/.test(line) || /:[\w-]+="\s*\[[^\]]+\]"/.test(line)) {
          findings.push(finding(
            i + 1, 1,
            'vue/no-inline-object-in-template',
            'Template ichida inline object/array — har render\'da yangi reference yaratiladi.',
            'warning',
            'Computed property yoki `data()` ga ko\'chiring.'
          ));
        }
      });
      return findings;
    }
  },

  // RULE 4: v-once yo'qligi statik kontent uchun (katta komponentlar)
  {
    id: 'vue/suggest-v-once',
    check(src, lines) {
      // Static, o'zgarmaydigan ko'rinadigan bloklarni tekshir
      const templateBlock = extractBlock(src, '<template>', '</template>');
      if (!templateBlock) return [];
      // Agar {{ }} yo'q va hech qanday directive yo'q lekin katta blok bo'lsa
      const findings = [];
      const bigStaticPattern = /<(section|article|footer|header|aside)[^>]*>[\s\S]{300,}<\/(section|article|footer|header|aside)>/g;
      let match;
      while ((match = bigStaticPattern.exec(templateBlock)) !== null) {
        const hasBinding = /v-|{{/.test(match[0]);
        if (!hasBinding) {
          const ln = lineNumber(templateBlock, match.index);
          findings.push(finding(
            ln, 1,
            'vue/suggest-v-once',
            `<${match[1]}> bloki statik ko'rinadi — \`v-once\` bilan bir marta render qiling.`,
            'info',
            '`v-once` directivesini qo\'shing: <' + match[1] + ' v-once>'
          ));
        }
      }
      return findings;
    }
  },

  // RULE 5: watch ichida immediate + deep (katta data'da ishlash xavfli)
  {
    id: 'vue/watch-deep-immediate',
    check(src, lines) {
      const findings = [];
      let inWatch = false;
      let watchDepth = 0;
      let hasDeep = false;
      let hasImmediate = false;
      let watchStart = 0;
      const scriptBlock = extractBlock(src, '<script', '</script>');
      const scriptLines = scriptBlock.split('\n');

      scriptLines.forEach((line, i) => {
        if (/watch\s*:/.test(line) || /watch\s*\(/.test(line)) {
          inWatch = true;
          watchStart = i + 1;
        }
        if (inWatch) {
          if (line.includes('deep: true')) hasDeep = true;
          if (line.includes('immediate: true')) hasImmediate = true;
          if (line.includes('{')) watchDepth++;
          if (line.includes('}')) watchDepth--;
          if (watchDepth < 0) { inWatch = false; watchDepth = 0; hasDeep = false; hasImmediate = false; }
          if (hasDeep && hasImmediate) {
            findings.push(finding(
              watchStart, 1,
              'vue/watch-deep-immediate',
              '`deep: true` + `immediate: true` birga — katta obyektlarda sekin.',
              'warning',
              'Faqat kerakli maydonlarni watch qiling yoki computed property ishlating.'
            ));
            hasDeep = false; hasImmediate = false;
          }
        }
      });
      return findings;
    }
  },

  // RULE 6: Lazy load qilinmagan route komponentlar
  {
    id: 'vue/no-sync-route-import',
    check(src, lines) {
      const findings = [];
      // Router fayllarini aniqlash (router.js yoki index.js ichida routes array)
      const isRouterFile = /routes\s*[=:]\s*\[/.test(src) || /createRouter/.test(src);
      if (!isRouterFile) return findings;

      lines.forEach((line, i) => {
        // import X from './views/X' (static import, routes ichida)
        if (/^\s*import\s+\w+\s+from\s+['"][./]*(views|pages|screens)/.test(line)) {
          findings.push(finding(
            i + 1, 1,
            'vue/no-sync-route-import',
            'Route komponenti static import — lazy load qilinmagan, initial bundle kattalashadi.',
            'critical',
            'Dynamic import bilan almashtiring:\n`component: () => import(\'./views/MyView.vue\')`'
          ));
        }
      });
      return findings;
    }
  },

  // RULE 7: $emit dan ko'p marta chaqirilishi (loop ichida emit)
  {
    id: 'vue/no-emit-in-loop',
    check(src, lines) {
      const findings = [];
      let inLoop = false;
      let loopDepth = 0;

      lines.forEach((line, i) => {
        if (/\b(for|while|forEach|map|filter|reduce)\b.*\(/.test(line)) {
          inLoop = true;
          loopDepth = 0;
        }
        if (inLoop) {
          loopDepth += (line.match(/\{/g) || []).length;
          loopDepth -= (line.match(/\}/g) || []).length;
          if (inLoop && /\$emit\(|emit\(/.test(line)) {
            findings.push(finding(
              i + 1, line.indexOf('emit') + 1,
              'vue/no-emit-in-loop',
              'Loop ichida `$emit` — parent ko\'p marta re-render bo\'lishi mumkin.',
              'warning',
              'Loop natijalarini yig\'ib, loopdan keyin bitta emit qiling.'
            ));
          }
          if (loopDepth <= 0) inLoop = false;
        }
      });
      return findings;
    }
  },

  // RULE 8: v-show vs v-if (tez-tez toggle bo'ladigan elementlarda v-if ishlatish)
  {
    id: 'vue/prefer-v-show-for-toggle',
    check(src, lines) {
      const findings = [];
      // v-if ichida toggle yoki isVisible, isOpen, show, visible pattern
      searchLines(lines, /v-if="(is[A-Z]\w*(Open|Visible|Show|Active|Toggle)|show\w*|visible\w*|open\w*)"/,
        (match, lineNo, line) => {
          findings.push(finding(
            lineNo, line.indexOf('v-if') + 1,
            'vue/prefer-v-show-for-toggle',
            `\`v-if="${match[1]}"\` — tez-tez toggle bo\'ladigan element uchun \`v-show\` tezroq.`,
            'info',
            '`v-show` DOM elementni saqlaydi, faqat `display` o\'zgartiradi. Mount/unmount yo\'q.'
          ));
        }
      );
      return findings;
    }
  },

  // RULE 9: computed property ichida side effect (yozish operatsiyasi)
  {
    id: 'vue/no-side-effect-in-computed',
    check(src, lines) {
      const findings = [];
      let inComputed = false;
      let depth = 0;
      let computedPropStart = 0;

      const scriptBlock = extractBlock(src, '<script', '</script>');
      const scriptLines = scriptBlock.split('\n');

      scriptLines.forEach((line, i) => {
        if (/computed\s*[:{(]/.test(line)) { inComputed = true; depth = 0; }
        if (inComputed) {
          depth += (line.match(/\{/g) || []).length;
          depth -= (line.match(/\}/g) || []).length;
          // Side effect belgilari
          if (/\bthis\.\w+\s*=(?!=)/.test(line) || /\$store\.commit|dispatch|axios\.|fetch\(/.test(line)) {
            findings.push(finding(
              i + 1, 1,
              'vue/no-side-effect-in-computed',
              'Computed property ichida side effect — cache buziladi, cheksiz loop xavfi.',
              'critical',
              'Side effect\'larni `watch` yoki `methods` ga ko\'chiring.'
            ));
          }
          if (depth <= 0 && inComputed) { inComputed = false; }
        }
      });
      return findings;
    }
  },

  // RULE 10: Template ichida murakkab ifodalar (computed property kerak)
  {
    id: 'vue/no-complex-expression-in-template',
    check(src, lines) {
      const findings = [];
      const templateBlock = extractBlock(src, '<template>', '</template>');
      if (!templateBlock) return findings;
      const templateLines = templateBlock.split('\n');

      templateLines.forEach((line, i) => {
        // {{ }} ichida ternary + method chaqiruvi yoki uzun ifoda
        const matches = line.match(/\{\{([^}]+)\}\}/g);
        if (!matches) return;
        for (const m of matches) {
          const expr = m.slice(2, -2).trim();
          // Murakkablik: ternary + method yoki 50+ char
          if ((expr.includes('?') && expr.includes('.')) || expr.length > 60) {
            findings.push(finding(
              i + 1, line.indexOf(m) + 1,
              'vue/no-complex-expression-in-template',
              `Template ifodasi murakkab (\`${expr.slice(0, 40)}...\`) — har render\'da qayta hisoblanadi.`,
              'warning',
              'Computed property ga ko\'chiring: `computed: { myValue() { return ... } }`'
            ));
          }
        }
      });
      return findings;
    }
  },

];

// ─── Asosiy funksiya ──────────────────────────────────────────────────────────

export function analyzeVueFile(src, relFile) {
  const lines = src.split('\n');
  const findings = [];

  for (const rule of vueRules) {
    try {
      const ruleFindings = rule.check(src, lines, src) || [];
      for (const f of ruleFindings) {
        findings.push({ file: relFile, ...f });
      }
    } catch (err) {
      // Rule xatosi butun analiz'ni to'xtatmasin
    }
  }

  return findings;
}
