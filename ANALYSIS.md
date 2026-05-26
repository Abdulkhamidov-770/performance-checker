# ANALYSIS — Joriy holat va kamchiliklar

> CLAUDE_CODE_TASK.md asosida tayyorlangan auditi. Kod o'qib chiqilgan, har bir Qatlam tahlil qilingan.

## 1. Joriy arxitektura xulosasi

Mavjud kod 3 ta qatlamdan iborat:

| Qatlam | Fayl(lar) | Holat |
|---|---|---|
| 1 — Static | `src/static/{lint,bundle,deps}/` | **Ishlaydi, lekin regex-based — false positive/negative xavfi yuqori** |
| 2 — Runtime | `src/runtime/` | **Ishlaydi, lekin Web Vitals va render counting beqaror** |
| 3 — AI | `src/ai/` | **Yaxshi tuzilgan — grounded prompt + multi-provider** |
| 4 — Dashboard | — | **Yo'q (yangi yoziladi)** |

Hamma `findings` bitta normalized format'da: `{ file, line, col, rule, message, severity, fix, layer }` — bu **kontrakt** saqlanadi.

---

## 2. Tasdiqlangan kamchiliklar (vazifa bo'yicha)

### 2.1 Regex-based "AST" (eng katta muammo)

**Fayllar**: `src/static/lint/vue-rules.js`, `react-rules.js`, `common-rules.js`

**Aniq misollar**:

1. **`vue/v-for-no-key`** (vue-rules.js:42): Faqat qator ichida `v-for` va `:key` qidiradi. Multi-line v-for'ni topa olmaydi:
   ```vue
   <div
     v-for="item in items"
     :key="item.id"  ← keyingi qatorda, lekin pattern ishlaydi (2 qator window)
   >
   ```
   Lekin 3 qator narida bo'lsa — false positive.

2. **`vue/no-side-effect-in-computed`** (vue-rules.js:253): `this.x =` ni qator ichida qidiradi. Quyidagi holatlarda **noto'g'ri**:
   - Comment ichida `this.x = 1` bo'lsa — yolg'on alarm
   - String literal ichida `"this.x = 1"` bo'lsa — yolg'on alarm
   - Computed ichida nested funksiya bo'lsa (return statement'dan keyingi pure assignment) — false negative

3. **`react/no-inline-function-in-jsx`** (react-rules.js:26): `\bon\w+\s*=\s*\{\s*(function|\(.*?\)\s*=>)` regex'i:
   - String literal ichida `onclick="() => ..."` (HTML) ni false positive deb belgilaydi
   - JSX `onSubmit={handleSubmit}` (memoize qilingan funksiya) ni topmaydi
   - Multi-line arrow funksiyalarni topmaydi

4. **`vue/no-emit-in-loop`** (vue-rules.js:201): `for|while|forEach|map|filter|reduce` ni qator ichida qidiradi. `map(item => emit())` arrow shaklini birinchi qatorda topmaydi.

5. **`extractBlock`** (vue-rules.js:26): `indexOf('<template>')` + `lastIndexOf('</template>')` — multi-block SFC (`<template lang="pug">` yoki nested template) bilan ishlamaydi. Atribut bilan kelganda `<template lang="html">` ni topmaydi.

**Hal**: `@vue/compiler-sfc.parse` + `@babel/parser` + `@babel/traverse` bilan AST visitor pattern'iga ko'chirish. Har bir rule alohida fayl + ESLint uslubidagi `{ id, severity, create(context) }` interfeysiga ega bo'ladi.

### 2.2 Deps analizi false positive (deps/index.js)

1. **`unused-dependency`** (deps/index.js:79): Faqat `import ... from 'pkg'` regex'iga tayanadi. **Topa olmaydi**:
   - `await import('pkg')` (dynamic import)
   - `require('pkg')` ham qisman tushadi, lekin re-export'lar (`export * from 'pkg'`) ham mavjud
   - Plugin-style import (Vite plugin'lar `vite.config.js` da, bunda import yo'q lekin ishlatiladi)
   - Conditional import (`if (cond) require('pkg')`)

2. **Circular dependency** (deps/index.js:162): `findCircularImports` — naive DFS, lekin:
   - Path resolution **noto'g'ri**: `imp.replace(/^\.\//, '').replace(/^\.\.\//, '')` — bu fayl tizimida haqiqiy yo'l emas
   - `candidates.filter(k => k.includes(normalized))` — `Button.vue` qidirilsa, `OldButton.vue` ham mos tushadi
   - Faqat birinchi 50 ta faylni skanlaydi (line 193) — to'liq emas

**Hal**: `dependency-cruiser` integratsiyasi yoki Babel/SFC AST orqali to'g'ri import resolver.

### 2.3 Runtime metrikalar beqaror

1. **Web Vitals** (runtime/metrics/web-vitals.js): Faylda `WEB_VITALS_CDN` deb e'lon qilingan **lekin hech qachon ishlatilmagan**. Hozir `setTimeout(2000)` bilan kutib, PerformanceObserver natijasini olishga harakat qilinadi. Bu LCP yakuniy qiymatini olishni kafolatlamaydi (LCP bir necha marta o'zgarishi mumkin, faqat foydalanuvchi interaksiyasidan keyin yakuniylashadi).

2. **`web-vitals.js` ishlatilmaydi**: `runtime/index.js` faylda `collectVitalsFromPage` o'zining inline implementatsiyasi bor. Va u faqat `getEntriesByType` ishlatadi — bu mavjud entry'larni qaytaradi, lekin INP uchun yetarli emas.

3. **Render counts** (renders.js): Devtools hook'larga tayanadi (`__VUE_DEVTOOLS_GLOBAL_HOOK__`, `__REACT_DEVTOOLS_GLOBAL_HOOK__`). **Production build'da ishlamaydi** (devtools hook yo'q). Hozir hech qanday warning chiqarmaydi — natija `{}` bo'ladi, foydalanuvchi sezmaydi.

4. **Median** (index.js:287): Mavjud, lekin **trimmed mean yo'q**. Bitta outlier butun median'ni surishi mumkin (ayniqsa kichik N=3 da).

5. **Network duplication**: `network.js` va `index.js` ikkalasi ham `collectNetwork` ga o'xshash funksiya implement qiladi — bittasi ishlatiladi, ikkinchisi orphaned (dead code).

### 2.4 Umumiy muammolar

1. **Test umuman yo'q**. `package.json` da `jest` bor, lekin `tests/` papkasi yo'q.
2. **Silent catch'lar**:
   - `vue-rules.js:330`, `react-rules.js:194`, `common-rules.js:181` — `} catch {}` (rule xatosi yo'qoladi)
   - `web-vitals.js:71, 94, 117` — observer disconnect bilan natija jim yo'qoladi
   - `claude-client.js:121, 122, 123` — har 3 JSON parse urinish jim
3. **Konfiguratsiya validatsiyasi yo'q**: `perf.config.js` da `budget.bundleSize.totalJS` o'rniga `budget.bundleSize.totalJs` yozilsa — jim ishlamaydi.
4. **`full` komandasi**: `bin/perf-check.js:127-175` — static va runtime alohida JSON yozadi (`perf-report.json`, `runtime-report.json`). Birlashtirilgan natija yo'q.
5. **Orchestrator yo'q**: bitta loyiha uchun yozilgan. 30+ loyiha uchun looping mantiq'i yo'q.
6. **Dead code**: `ai/index.js` da katta commented-out blok (85-168), `claude-client.js` da (133-239), `runtime/metrics/web-vitals.js`, `network.js`, `renders.js` — `runtime/index.js` ularning **inline kopiyalari**dan foydalanadi. Demak `metrics/*.js` orphaned.
7. **`prompt-builder.js:43`** — kirill harf `ради` bor (typo): `kattalashtiradi` so'zining oxiri ruscha `ради` bilan yozilgan.
8. **`detect.js:80`**: `framework === 'nuxt'` faqat `isVue` qaytaradi, lekin Nuxt React-based ham bo'lishi mumkin (Nuxt 3 + Vue 3 default, lekin keyin).
9. **Logger yo'q**: console.log/warn/error har joyga sochilgan. `--verbose` flag yo'q.

### 2.5 Kichik kamchiliklar

- `static/index.js:9` — `import { isVue, isReact }` qilingan lekin **ishlatilmagan**.
- `static/lint/index.js:43` — `.next` bor lekin `.nuxt` ham bor; `dist`, `build`, `out`, `.output` (Nuxt 3) yo'q.
- `bundle/index.js:91`,`152` — `findDepLine(pkgPath, ...)` — bunda `pkgPath` `'package.json'` deb (relative) berilmoqda, lekin funksiya `readFileSync(pkgPath)` qiladi. Joriy `cwd` har xil bo'lsa — fail.
- `runtime/index.js:69` — `mergedBudget = { ...DEFAULT_BUDGET, ...budget }` — lekin `budget` opts'dan keladi, oddiy obj, deep merge yo'q.
- `package.json` da `chrome-launcher` yo'q, lekin `lighthouse.js` uni `require` qiladi. Lighthouse ishlatilganda crash.

---

## 3. Vazifalar bo'yicha plan

Tartib: **A → B → C → D → E** (har qadamdan keyin testlar yashil bo'ladi).

### A. Test infratuzilma
- **Test runner**: `vitest` (native ESM, tez, `package.json` allaqachon `"type": "module"`). Migration kichik.
- `tests/fixtures/` — Vue va React mini-loyihalar, har rule uchun 1+ misol.
- Har rule uchun unit test (fixture kod → kutilgan findings).
- `detect.js`, `aggregator.js`, `ast-context.js`, `claude-client.js parseJSONResponse` uchun unit test.
- `runStaticAnalysis` uchun integration test.
- Coverage maqsadi: Qatlam 1 da ≥80%, `claude-client` parse logikasida ≥95%.

### B. AST refactor (Qatlam 1)
- `@vue/compiler-sfc` (template + script AST), `@babel/parser` + `@babel/traverse` (JS/TS/JSX).
- Rule fayllarini bo'lish: `src/static/lint/rules/vue/<rule-id>.js`, `rules/react/<rule-id>.js`, `rules/common/<rule-id>.js`.
- Har bir rule ESLint-like interfeys: `{ id, severity, layer, create(context) }`.
- `context` — AST node'larga tashrif buyurish uchun helper'lar (`onVForDirective`, `onCallExpression`, ...).
- `line`/`col` AST `loc` dan olinadi, regex'dan emas.
- Avval yozilgan testlar **yashil qolishi shart** (test-driven refactor).

### C. Mustahkamlash (Qatlam 2 + 3)
- `web-vitals` npm paketi: page context'ga `addInitScript` bilan inject. `onLCP/onCLS/onINP` callback'lari oxirgi qiymatni `window.__PERF_VITALS__` ga yozadi.
- Render counting: warning + "experimental" flag. Production build'da `__VUE_DEVTOOLS_GLOBAL_HOOK__` yo'qligini detect qilib, foydalanuvchini ogohlantirish.
- Deps analizi: `dependency-cruiser` paketi yoki AST-based to'g'ri import detector.
- `src/utils/logger.js` — yagona logger (`debug`, `info`, `warn`, `error`). `--verbose` flag bilan debug yoqiladi.
- `zod` bilan `perf.config.js` schema validatsiyasi (action-oriented xato xabarlari).
- `full` komandasi yagona `perf-report.json` yozadi: `{ meta, static: {...}, runtime: {...}, ai: {...} }`.
- Median + trimmed mean (5%): outlier'larni tashlash.
- Dead code (commented-out bloklar, ishlatilmaydigan metrika fayllar) o'chiriladi.

### D. Orchestrator
- `src/orchestrator/index.js`: `projects.config.js` o'qiydi.
- `p-limit` bilan parallel ishlash (default concurrency: 4).
- Har loyiha: framework detect → static → (URL bo'lsa) runtime → JSON saqlash.
- Format: `.perf-history/<project>/<ISO-timestamp>.json`.

### E. Dashboard (Qatlam 4)
- `src/dashboard/index.js`: `.perf-history/` o'qib statik HTML generatsiya qiladi.
- Bitta `dashboard.html` (server kerak emas):
  - Loyiha reytingi (performance score'ga ko'ra).
  - Har loyiha — tarixiy trend grafik (inline SVG yoki `chart.js` inline).
  - Regression flag (oxirgi run > oldingi: qizil).
  - Drill-down: har loyiha findings ro'yxati.
- CLI: `perf-check dashboard --history ./.perf-history --output ./dashboard`.
- CLI: `perf-check scan --config ./projects.config.js` (orchestrator + dashboard birga).
- **Budget regression** detector: oldingi natija bilan solishtirib, agar oshgan bo'lsa `exit 1` (CI uchun).

---

## 4. Texnologiya tanlovlari

| Kerak | Tanlov | Sabab |
|---|---|---|
| Test runner | `vitest` | Native ESM, tez, kichik migration |
| Vue AST | `@vue/compiler-sfc` | Vue rasmiy parser |
| JS/TS/JSX AST | `@babel/parser` + `@babel/traverse` | Eng keng tarqalgan, batafsil hujjat |
| Deps analiz | `dependency-cruiser` | Yetuk, AST-based, configurable |
| Web Vitals | `web-vitals` (npm) | Google'ning rasmiy `onLCP/onINP/onCLS` library |
| Schema | `zod` | TS-friendly, action-oriented xato xabarlari |
| Concurrency | `p-limit` | Kichik, async limit uchun standart |
| Chart | inline SVG | Tashqi runtime dep'siz dashboard |

> Hammasi mavjud `package.json` ga qo'shiladi. `chrome-launcher` ham (Lighthouse uchun) qo'shiladi — hozir yo'q.

---

## 5. Sifat standartlari

- ESM saqlanadi (`"type": "module"`).
- Markaziy konstantalar `src/constants.js` da.
- Public funksiyalar JSDoc bilan.
- Action-oriented xato xabarlari.
- Conventional commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`).
- `npm test`, `npm run lint`, `npm run check`, `npm run scan` ishlaydi.
- README har Qatlam uchun yangilanadi.
