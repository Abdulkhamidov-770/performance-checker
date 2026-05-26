/**
 * Grounded prompt builder
 *
 * "Grounding" = AI ga xom kod emas, aniq topilma + kontekst berish.
 * Bu hallucination'ni deyarli nolga tushiradi.
 *
 * Prompt strukturasi:
 *   1. Rol: sen performance ekspertisan
 *   2. Topilma: aniq rule + fayl + qator + muammo tavsifi
 *   3. Kod konteksti: muammo atrofidagi qatorlar
 *   4. Vazifa: JSON qaytarish (fix_code + explanation + impact + priority)
 *   5. Cheklov: faqat KOD ga asoslan, taxmin qilma
 */

// Rule'lar uchun qo'shimcha kontekst (AI ga yordam beradi)
const RULE_CONTEXT = {
  'vue/v-for-no-key': {
    concept: 'Vue v-for direktivasida :key bo\'lmasa, DOM diffing algoritmi elementlarni noto\'g\'ri qayta ishlatadi. Bu re-render sekinlashishiga va UI xatolariga olib keladi.',
    example_bad: 'v-for="item in items"',
    example_good: 'v-for="item in items" :key="item.id"',
  },
  'vue/no-v-if-v-for-same-element': {
    concept: 'v-for va v-if bir elementda bo\'lsa, Vue avval v-for ni ishlatadi, keyin har bir element uchun v-if tekshiradi. Bu har render\'da butun list iterate qilinishiga sabab bo\'ladi.',
    example_bad: '<div v-for="item in items" v-if="item.active">',
    example_good: 'Computed property bilan filter: <div v-for="item in activeItems">',
  },
  'vue/no-side-effect-in-computed': {
    concept: 'Computed property\'lar pure function bo\'lishi kerak. Side effect (this.x = val, API call) computed\'da bo\'lsa, Vue\'ning reaktivlik tizimi infinite loop\'ga tushishi mumkin.',
    example_bad: 'computed: { myVal() { this.other = true; return this.x; } }',
    example_good: 'Side effect\'larni watch yoki methods\'ga ko\'chiring.',
  },
  'vue/no-sync-route-import': {
    concept: 'Static import qilingan route komponentlar initial bundle\'ga kiradi. Lazy load bilan faqat kerakli route\'da yuklanadi, initial bundle kichrayadi.',
    example_bad: "import Dashboard from './views/Dashboard.vue'",
    example_good: "component: () => import('./views/Dashboard.vue')",
  },
  'react/use-effect-no-deps': {
    concept: 'Dependency array yo\'q useEffect har render\'da qayta ishlaydi. Bu performance muammosi va cheksiz loop xavfini yaratadi.',
    example_bad: 'useEffect(() => { fetchData(); })',
    example_good: 'useEffect(() => { fetchData(); }, [userId])',
  },
  'react/no-sync-route-import': {
    concept: 'Route komponentlarni React.lazy bilan yuklamaslik initial bundle\'ni kattalashtiradi.',
    example_bad: "import Dashboard from './pages/Dashboard'",
    example_good: "const Dashboard = React.lazy(() => import('./pages/Dashboard'))",
  },
  'common/await-in-loop': {
    concept: 'Loop ichida await ketma-ket N ta so\'rov yuboradi (N*latency vaqt ketadi). Promise.all bilan parallel yuborsa, faqat max(latency) vaqt ketadi.',
    example_bad: 'for (const id of ids) { await fetchItem(id); }',
    example_good: 'const results = await Promise.all(ids.map(id => fetchItem(id)));',
  },
  'common/uncleared-timer': {
    concept: 'setInterval/setTimeout component unmount bo\'lgandan keyin ham ishlashda davom etadi. Bu memory leak va xato state update\'larga olib keladi.',
    example_bad: 'mounted() { setInterval(() => this.tick(), 1000); }',
    example_good: 'mounted() { this.timer = setInterval(...); } beforeUnmount() { clearInterval(this.timer); }',
  },
  'bundle/heavy-package': {
    concept: 'Og\'ir kutubxonalar bundle hajmini oshiradi va initial load vaqtini uzaytiradi. Alternativlarni ishlatish yoki tree-shaking yoqish yordam beradi.',
  },
  'runtime/lcp-critical': {
    concept: 'LCP (Largest Contentful Paint) sahifadagi eng katta elementning ko\'rinish vaqtini o\'lchaydi. 2.5s dan oshsa, foydalanuvchi tajribasi yomonlashadi.',
  },
  'runtime/excessive-renders': {
    concept: 'Komponent juda ko\'p marta re-render bo\'lyapti. Bu props o\'zgarishi, parent re-render yoki state management muammosi bo\'lishi mumkin.',
  },
  'runtime/long-tasks': {
    concept: 'Long Task (>50ms) main thread\'ni bloklab, foydalanuvchi interaktivligini to\'xtatadi. Bu INP va TBT ko\'rsatkichlarini yomonlashtiradi.',
  },
};

/**
 * Barcha findinglarni bitta promptda batch qiladi.
 * Rate limit muammosini hal qiladi — 1 ta so'rov, N ta natija.
 */
export function buildBatchPrompt(items) {
  const findingsList = items.map((item, i) => {
    const { finding, context } = item;
    const ruleCtx = RULE_CONTEXT[finding.rule] || {};
    const codeSnippet = context?.extractedLines
      ? `Kod:\n\`\`\`\n${context.extractedLines.slice(0, 300)}\n\`\`\``
      : '(kod mavjud emas — runtime metrika)';

    return `### Finding ${i + 1}
Rule: ${finding.rule}
Jiddiylik: ${finding.severity}
Fayl: ${finding.file || 'N/A'}${finding.line ? `:${finding.line}` : ''}
Muammo: ${finding.message}
${ruleCtx.concept ? `Kontekst: ${ruleCtx.concept}` : ''}
${codeSnippet}`;
  }).join('\n\n');

  return `Sen senior frontend performance muhandisisan.
Quyida ${items.length} ta aniq finding bor. Har biri uchun tahlil ber.

${findingsList}

## Vazifa
Yuqoridagi har bir finding uchun JSON array qaytargin. Array uzunligi ${items.length} bo'lsin.
Har element:
{
  "explanation": "Muammoni o'zbek tilida 2-3 jumlada tushuntir",
  "root_cause": "Asosiy sabab 1 jumlada",
  "fix_code": "To'g'ri kod misoli. Newline uchun \\n ishlatit",
  "fix_explanation": "Fix nima qilishini tushuntir",
  "performance_impact": "O'lchanadigan natija (masalan: bundle -50KB, LCP -200ms)",
  "priority": 1,
  "priority_reason": "Nima uchun bu prioritet",
  "related_files": []
}

priority: 1 (critical, darhol) dan 5 (info) gacha.
MUHIM: Faqat JSON array qaytargin. Markdown yoki izoh qo'shma.`;
}

export function buildGroundedPrompt(finding, context) {
  const ruleCtx = RULE_CONTEXT[finding.rule] || {};
  const isRuntime = finding.layer === 'runtime' || !context?.exists;

  const codeSection = context?.extractedLines
    ? `\n## Muammo joylashgan kod (${context.file}${finding.line ? `:${finding.line}` : ''})\n` +
      '```' + (context.language || '') + '\n' +
      context.extractedLines + '\n```\n' +
      `(>>> belgisi muammo qatorini ko\'rsatadi)\n`
    : '';

  const ruleContextSection = ruleCtx.concept
    ? `\n## Muammo haqida kontekst\n${ruleCtx.concept}\n`
    : '';

  const examplesSection = ruleCtx.example_bad
    ? `\n## Noto\'g\'ri pattern\n\`\`\`\n${ruleCtx.example_bad}\n\`\`\`\n` +
      `## To\'g\'ri pattern\n\`\`\`\n${ruleCtx.example_good}\n\`\`\`\n`
    : '';

  const prompt = `Sen senior frontend performance muhandisisan. Sana aniq topilma berilgan, UNI KOD ASOSIDA tahlil qil.

## Topilma
- Rule: ${finding.rule}
- Jiddiylik: ${finding.severity}
- Fayl: ${finding.file || 'N/A (runtime metrika)'}${finding.line ? `:${finding.line}` : ''}
- Muammo: ${finding.message}
- Dastlabki tavsiya: ${finding.fix || 'yo\'q'}
${ruleContextSection}${codeSection}${examplesSection}
## Vazifang
Yuqoridagi KOD ASOSIDA (taxmin qilmasdan) quyidagi JSON formatda javob ber:

{
  "explanation": "Muammoni o'zbek tilida 2-3 jumlada tushuntir. Kod qatorlariga aniq murojaat qil.",
  "root_cause": "Muammoning asosiy sababi 1 jumlada",
  "fix_code": "To'g'ri kod misoli (agar fayl kontekst bo'lsa, o'sha faylga mos). String ichida newline uchun \\n ishlatit.",
  "fix_explanation": "Fix nima qilishini va nima uchun ishlashini tushuntir",
  "performance_impact": "Bu tuzatish qanday o'lchanadigan natija beradi (masalan: LCP -200ms, bundle -50KB)",
  "priority": 1,
  "priority_reason": "Nima uchun bu prioritet (1=eng muhim, 5=kam muhim)",
  "related_files": ["agar boshqa fayllarni ham o'zgartirish kerak bo'lsa, ro'yxat"]
}

MUHIM QOIDALAR:
- Faqat JSON qaytarish. Hech qanday markdown, izoh yoki tushuntirish qo'shma.
- Faqat KOD DA KO'RINGAN narsani aytish. Ko'rinmagan narsani taxmin qilma.
- fix_code da asl kod strukturasini saqlash (Vue SFC bo'lsa, template/script blokini saqlash).
- priority: 1 (critical, darhol tuzat) dan 5 (info, vaqt topilganda) gacha.`;

  return prompt;
}
