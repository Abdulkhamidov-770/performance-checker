/**
 * Finding aggregator
 * Qatlam 1 + 2 topilmalarini birlashtiradi, prioritet beradi,
 * dublikatlarni olib tashlaydi, AI uchun eng muhimlarini tanlaydi
 */

const SEVERITY_SCORE = { critical: 100, warning: 50, info: 10 };

// Har bir rule'ning qo'shimcha og'irligi (muhimlik darajasi)
const RULE_WEIGHT = {
  // Qatlam 1 — eng muhim
  'vue/v-for-no-key': 30,
  'vue/no-v-if-v-for-same-element': 25,
  'vue/no-side-effect-in-computed': 40,
  'vue/no-sync-route-import': 35,
  'react/no-sync-route-import': 35,
  'react/use-effect-no-deps': 30,
  'bundle/js-size-over-budget': 40,
  'bundle/heavy-package': 20,
  'common/await-in-loop': 25,
  // Qatlam 2 — runtime muammolar
  'runtime/lcp-critical': 50,
  'runtime/tbt-high': 40,
  'runtime/excessive-renders': 35,
  'runtime/long-tasks': 30,
  'runtime/inp-critical': 45,
};

/**
 * @param {Array} findings - Qatlam 1 + 2 barcha findings
 * @param {number} max - AI ga yuborish uchun max son
 * @returns {Array} Prioritetlangan findings
 */
export function aggregateFindings(findings, max = 20) {
  // 1. Score hisoblash
  const scored = findings.map(f => ({
    ...f,
    _score: (SEVERITY_SCORE[f.severity] || 0) + (RULE_WEIGHT[f.rule] || 0),
  }));

  // 2. Dublikatlarni olib tashlash (bir xil rule + bir xil fayl)
  const seen = new Set();
  const unique = scored.filter(f => {
    const key = `${f.rule}::${f.file}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // 3. Score bo'yicha tartiblash
  unique.sort((a, b) => b._score - a._score);

  // 4. AI ga yuborish mumkin bo'lgan topilmalar:
  //    - Faylga ega (file-level) yoki runtime metrika
  //    - Score yuqori
  const eligible = unique.filter(f => {
    // Runtime findings — fayl yo'q, lekin muhim
    if (f.layer === 'runtime') return true;
    // Static findings — faqat faylga ega bo'lganlari
    return f.file && f.file !== 'package.json';
  });

  return eligible.slice(0, max);
}
