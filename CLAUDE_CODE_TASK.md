# Performance Checker — Refactor + Test + Layer 4 (Claude Code uchun topshiriq)

Sen senior frontend platform muhandisisan. Quyidagi mavjud loyihani professional darajaga olib chiqishing kerak: avval mavjud 3 qatlamni test qilib, kamchiliklarini refactor qilasan, keyin Qatlam 4 (Dashboard) qo'shasan. Har bir o'zgarishdan keyin testlar yashil bo'lishi shart.

---

## 1. Loyiha konteksti

Bu — 30+ frontend loyiha (asosan Vue 3, ba'zilari React) uchun **avtomatlashtirilgan performance audit tizimi**. 4 qatlamli arxitektura:

- **Qatlam 1 (static)** — build qilmasdan, kodni o'qib anti-pattern'larni `fayl:qator` darajasida topadi (lint + bundle + deps).
- **Qatlam 2 (runtime)** — Playwright + CDP orqali real brauzerda Web Vitals, Long Tasks, network, render counts, Lighthouse o'lchaydi.
- **Qatlam 3 (AI)** — Qatlam 1+2 topilmalarini AST kontekst bilan boyitib, Gemini/Claude API ga yuboradi va grounded fix tavsiyalar oladi.
- **Qatlam 4 (dashboard)** — HALI YO'Q, sen qurasan.

Texnologiya: Node.js (ESM), `commander` (CLI), `glob`, `playwright`, `lighthouse`. AI: Google Gemini (`gemini-2.0-flash`) yoki Anthropic Claude. Test: `jest` (o'rnatilgan, lekin testlar yozilmagan).

Markaziy falsafa: **AI muammoni TOPMAYDI** — uni deterministik Qatlam 1/2 topadi, AI faqat tushuntiradi va fix beradi (hallucination'dan saqlanish uchun). Bu prinsipni buzma.

---

## 2. Joriy fayl strukturasi

```
performance-checker/
├── bin/perf-check.js                      # CLI: default(static), runtime, ai, full
├── src/
│   ├── config/loader.js                   # config + default budget
│   ├── utils/detect.js                    # framework/bundler aniqlash
│   ├── static/                            # QATLAM 1
│   │   ├── index.js                       # orchestrator
│   │   ├── lint/{index,vue-rules,react-rules,common-rules}.js
│   │   ├── bundle/index.js
│   │   └── deps/index.js
│   ├── runtime/                           # QATLAM 2
│   │   ├── index.js
│   │   ├── playwright/browser.js
│   │   ├── metrics/{web-vitals,traces,network,renders,lighthouse}.js
│   │   ├── scenarios/index.js
│   │   └── reporters/{findings-builder,runtime-reporter}.js
│   ├── ai/                                # QATLAM 3
│   │   ├── index.js
│   │   ├── aggregator.js
│   │   ├── extractors/ast-context.js
│   │   ├── prompts/{prompt-builder,claude-client}.js
│   │   └── reporters/ai-reporter.js
│   └── reporters/index.js                 # Qatlam 1 reporter
└── .github/workflows/perf-check.yml
```

Hamma finding'lar bitta normalized formatda: `{ file, line, col, rule, message, severity, fix, layer }`. Bu kontraktni saqla.

---

## 3. MA'LUM KAMCHILIKLAR (refactor qilinishi kerak)

Men halol bo'laman — bu kod tez prototip sifatida yozilgan. Quyidagi kamchiliklar bor, ularni professional darajada hal qil:

### 3.1 Eng katta muammo: regex-based "AST"
`src/static/lint/{vue-rules,react-rules,common-rules}.js` — bu fayllar **AST emas, regex va satrma-satr** ishlaydi. Bu noto'g'ri (false positive/negative ko'p). Ularni **haqiqiy parserlar** bilan qayta yoz:
- Vue SFC uchun: `@vue/compiler-sfc` (`parse` + `compileTemplate`) — template AST va script AST oladi.
- JS/TS/JSX uchun: `@babel/parser` + `@babel/traverse` yoki `@typescript-eslint/typescript-estree`.
- Har bir rule'ni AST visitor sifatida qayta yoz. `line`/`col` ni AST node'ning `loc` dan ol (regex bilan emas).
- Misol: `vue/no-side-effect-in-computed` hozir satr ichida `this.x =` qidiradi — bu xato. AST'da computed property'ning return statement'idan oldingi assignment'larni topish kerak.

### 3.2 Deps analizi false positive beradi
`src/static/deps/index.js`:
- `unused-dependency` — import'ni faqat regex bilan topadi, dinamik import va re-export'larni o'tkazib yuboradi. `knip` yoki `dependency-cruiser` kabi yondashuvni ko'r.
- Circular dependency detector juda sodda (shallow DFS, path resolution noto'g'ri). To'g'ri module resolution bilan qayta yoz yoki `dependency-cruiser` integratsiya qil.

### 3.3 Runtime o'lchovlari beqaror
`src/runtime/metrics/`:
- `web-vitals.js` — qattiq `setTimeout(2000)` bilan kutadi. Bu beqaror. `web-vitals` npm kutubxonasini sahifaga inject qilib, `onLCP/onCLS/onINP` callback'lari orqali ol.
- `renders.js` — devtools hook'larga tayanadi, ular ishlamasligi mumkin. Vue uchun `app.config.performance` + production build'da ishlamasligini hisobga ol. React uchun Profiler API'ni ko'r. Agar ishonchli bo'lmasa, bu metrikani "experimental" deb belgila.
- Median hisoblash bor, lekin outlier'larni tashlash (trimmed mean) yo'q.

### 3.4 Umumiy muammolar
- **Test umuman yo'q.** Bu eng katta qarz.
- Xato handling joy-joyda `catch {}` (silent) — bu debug'ni qiyinlashtiradi. Markazlashtirilgan logger qo'sh (masalan `--verbose` flag bilan).
- Konfiguratsiya validatsiyasi yo'q (`perf.config.js` noto'g'ri bo'lsa, tushunarsiz xato).
- `bin/perf-check.js` da `full` komandasi findings'larni JSON'ga yozadi, lekin runtime findings static report'ga qo'shilmaydi (ikki alohida JSON). Birlashtirilgan natija yo'q.
- 30+ loyihani parallel ishlatadigan **orchestrator yo'q** (hozir bitta loyiha). Bu Qatlam 4 uchun kerak.

---

## 4. BAJARILADIGAN VAZIFALAR (tartib bilan)

### Vazifa A — Test infratuzilmasi (avval shu)
1. `jest` ni ESM bilan ishlashga sozla (yoki `vitest` ga o'tkaz — bu ESM uchun yengilroq, sen qaror qil va sababini ayt).
2. `tests/fixtures/` da ataylab muammoli mini Vue va React loyihalar yarat (har bir rule uchun kamida 1 ta misol).
3. Har bir Qatlam 1 rule uchun unit test yoz: muammoli kod → kutilgan finding (rule, line, severity).
4. `detect.js`, `aggregator.js`, `ast-context.js`, `claude-client.js` (parse qismi, mock fetch bilan) uchun unit testlar.
5. Qatlam 1 uchun integration test: fixture loyiha → to'liq findings array.
6. Maqsad: kamida 80% coverage Qatlam 1 da, claude-client parse logikasida 100%.

### Vazifa B — Qatlam 1 ni AST ga ko'chir (3.1)
1. `@vue/compiler-sfc` va `@babel/parser`/`@babel/traverse` qo'sh.
2. `vue-rules.js`, `react-rules.js`, `common-rules.js` ni AST visitor pattern'ga qayta yoz.
3. Har bir rule'ni alohida fayl/modul qil (`rules/vue/no-v-for-without-key.js` kabi), har biri `{ id, severity, create(context) }` interfeysiga ega bo'lsin (ESLint uslubida).
4. Mavjud testlar yashil qolishini ta'minla (test-driven refactor).
5. `line`/`col` aniqligini test bilan tasdiqla.

### Vazifa C — Qatlam 2 va 3 ni mustahkamla (3.2, 3.3, 3.4)
1. `web-vitals` kutubxonasini to'g'ri inject qil (CDN emas, bundle qilingan).
2. Render counting'ni ishonchli qil yoki "experimental" deb belgila + warning chiqar.
3. Deps analizini `dependency-cruiser` bilan almashtir yoki sezilarli yaxshila.
4. Markaziy logger + `--verbose` flag.
5. `perf.config.js` uchun schema validatsiya (`zod` ishlatishing mumkin).
6. `full` komandasi yagona birlashtirilgan JSON chiqarsin: `{ static, runtime, ai, meta }`.

### Vazifa D — Orchestrator (30+ loyiha)
1. `src/orchestrator/index.js` yarat: `projects.config.js` dagi loyihalar ro'yxatini o'qiydi.
2. Har bir loyiha uchun: framework aniqlash → Qatlam 1 → (URL bo'lsa) Qatlam 2 → natijani saqlash.
3. Parallel ishlash (concurrency limit bilan, masalan `p-limit` yoki o'zing yoz, default 4 ta parallel).
4. Har bir loyiha natijasini `.perf-history/<project>/<timestamp>.json` ga yoz.

### Vazifa E — QATLAM 4: Dashboard
Bu yangi qatlam. Talablar:
1. **Tarixiy saqlash**: har run natijasi `.perf-history/` da JSON sifatida (D vazifasidan keladi). SQLite ham qo'shsa bo'ladi (`better-sqlite3`), lekin boshlanish uchun JSON yetarli.
2. **Statik HTML dashboard generatori** (`src/dashboard/index.js`):
   - Barcha loyihalar reytingi (eng yomon performance score → eng yaxshi).
   - Har loyiha uchun tarixiy trend grafigi (score, bundle size, LCP vaqt bo'yicha). Chart.js yoki sof SVG ishlatish mumkin, lekin tashqi runtime dependency'siz, bitta HTML faylga inline qil.
   - "Regression" belgisi: agar oxirgi run oldingisidan yomonroq bo'lsa, qizil flag.
   - Har loyiha → drill-down: o'sha loyihaning barcha findings'lari (Qatlam 1+2+3).
   - Hammasi bitta `dashboard.html` ga (yoki bir nechta sahifa) — server kerak emas, fayl sifatida ochilsin.
3. **CLI komandasi**: `perf-check dashboard --history ./.perf-history --output ./dashboard` va `perf-check scan --config ./projects.config.js` (orchestrator + dashboard birga).
4. **Performance budget regression**: oldingi natija bilan solishtirib, budget oshganini aniqlasin va exit code 1 qaytarsin (CI uchun).

---

## 5. SIFAT STANDARTLARI

- **ESM** saqlanadi (`"type": "module"`). CommonJS aralashtirma.
- Har bir public funksiyada JSDoc (`@param`, `@returns`).
- Markaziy konstantalar (budget, thresholds) bitta joyda, sehrli raqamlar tarqalmasin.
- Xato xabarlari **harakatga yo'naltiruvchi** bo'lsin (nima qilish kerakligini aytsin).
- README'ni yangilab boravar (har qatlam + Qatlam 4 + dashboard).
- Linter qo'sh (`eslint` + `eslint-config-prettier`), `npm run lint` ishlasin.
- `npm test`, `npm run lint`, `npm run check` (Qatlam 1), `npm run scan` (to'liq) skriptlari ishlasin.
- Commit'larni mantiqiy bo'l (har vazifa alohida commit), conventional commits formatida.

---

## 6. ISH TARTIBI (muhim)

1. Avval butun kodni o'qib chiq, `ANALYSIS.md` da joriy holat va aniqlangan kamchiliklarni yoz (yuqoridagi ro'yxatni tasdiqlab yoki kengaytirib).
2. Vazifa A (testlar) — refactor'dan OLDIN, hozirgi xatti-harakatni "qotirib" qo'yish uchun (characterization tests).
3. Keyin B → C → D → E tartibida. Har qadamdan keyin `npm test` yashil.
4. Har bir qatlamni fixture loyihada real ishlatib ko'r va natijani ko'rsat.
5. Oxirida: to'liq `npm run scan` ni 2-3 ta fixture loyihada ishlatib, `dashboard.html` ni generatsiya qilib ko'rsat.

Boshlashdan oldin menga qisqa reja taqdim et (qaysi tartibda, qaysi kutubxonalarni qo'shasan, jest yoki vitest tanlovingni asosla), keyin tasdiqlasam, boshla.

---

## 7. Mavjud CLI (buzilmasligi kerak)

```bash
node bin/perf-check.js --project ./app                 # Qatlam 1
node bin/perf-check.js runtime --url http://localhost:5173 --framework vue
node bin/perf-check.js ai --project ./app --format html
node bin/perf-check.js full --project ./app --url http://localhost:5173
```

AI provider: `GEMINI_API_KEY` (AIza...) yoki `ANTHROPIC_API_KEY` (sk-ant-...) — `src/ai/prompts/claude-client.js` da avtomatik aniqlanadi. Buni saqla.
