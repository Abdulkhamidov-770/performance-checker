# ⚡ Performance Checker — 4 qatlamli audit tizimi

> Vue/React frontend loyihalar (30+) uchun avtomatlashtirilgan performance audit:
> AST asosida statik analiz, real brauzerda runtime o'lchov, AI grounded tavsiya, va
> tarixiy dashboard.

**Markaziy falsafa**: AI muammoni TOPMAYDI — uni deterministik Qatlam 1 va 2 topadi.
AI faqat tushuntiradi va fix tavsiya beradi (hallucination'dan saqlanish uchun).

---

## 🏗 Qatlamlar

| Qatlam | Nima qiladi | Texnologiya |
|---|---|---|
| **1 — Static** | Build qilmasdan, kodni AST orqali o'qib anti-pattern'larni `fayl:qator` darajasida topadi (lint + bundle + deps). | `@vue/compiler-sfc`, `@babel/parser`, `@babel/traverse` |
| **2 — Runtime** | Playwright + CDP orqali real brauzerda Web Vitals, Long Tasks, network, render counts, Lighthouse. | `playwright`, `web-vitals`, `lighthouse`, `chrome-launcher` |
| **3 — AI** | Qatlam 1+2 topilmalarini AST kontekst bilan boyitib, Gemini/Claude API ga yuboradi va grounded fix tavsiyalar oladi. | `gemini-2.0-flash` / `claude-sonnet-4` |
| **4 — Dashboard** | 30+ loyihani parallel skanlaydi, tarixiy snapshot saqlaydi, regression flag bilan statik HTML dashboard generatsiya qiladi. | `p-limit`, inline SVG |

---

## 📦 O'rnatish

```bash
npm install
npx playwright install chromium   # Qatlam 2 uchun
```

API key (Qatlam 3 uchun — ixtiyoriy):
```bash
# Google AI Studio (BEPUL)
set GEMINI_API_KEY=AIza...        # Windows
export GEMINI_API_KEY=AIza...     # Mac/Linux

# yoki Anthropic Claude
set ANTHROPIC_API_KEY=sk-ant-...
```

---

## 🚀 Foydalanish

### Qatlam 1 — Static
```bash
# Default: lint + bundle + deps
node bin/perf-check.js --project ./my-vue-app

# Faqat lint
node bin/perf-check.js --project ./my-vue-app --layer lint

# JSON + HTML hisobot
node bin/perf-check.js --project ./my-vue-app --format all --output ./reports
```

### Qatlam 2 — Runtime
```bash
node bin/perf-check.js runtime --url http://localhost:5173 --framework vue --runs 3
node bin/perf-check.js runtime --url http://localhost:5173 --scenario mobile
node bin/perf-check.js runtime --url http://localhost:5173 --no-lighthouse
```

### Qatlam 3 — AI
```bash
# Qatlam 1 ni avtomatik ishlatib AI ga yuboradi
node bin/perf-check.js ai --project ./my-vue-app

# Mavjud JSON hisobotdan
node bin/perf-check.js ai --findings ./reports/perf-report.json
```

### To'liq (1 + 2 + 3) — yagona perf-report.json
```bash
node bin/perf-check.js full --project ./my-app --url http://localhost:5173
```

Natija: `./perf-reports/perf-report.json` strukturasi:
```json
{
  "meta": { "project": "...", "framework": {...}, "analyzedAt": "...", "findings": {...} },
  "static": { "findings": [...], "summary": {...}, "layerResults": {...} },
  "runtime": { "findings": [...], "rawMetrics": {...}, "lighthouseResult": {...} },
  "ai": { "aiResults": [...], "summary": {...} },
  "findings": [...]
}
```

### Qatlam 4 — Dashboard (30+ loyiha)
1. `projects.config.js` yarat:
   ```js
   export default {
     concurrency: 4,
     historyDir: './.perf-history',
     projects: [
       { name: 'admin', path: './apps/admin' },
       { name: 'shop',  path: './apps/shop', url: 'http://localhost:5173', framework: 'vue' },
       { name: 'crm',   path: './apps/crm', url: 'http://localhost:3001', framework: 'react' },
     ],
   };
   ```
2. Skan + dashboard:
   ```bash
   node bin/perf-check.js scan --file ./projects.config.js --history ./.perf-history --dash-out ./dashboard
   ```
3. `./dashboard/dashboard.html` ni brauzerda oching.

Faqat dashboard (avval skan qilingan tarix asosida):
```bash
node bin/perf-check.js dashboard --history ./.perf-history --dash-out ./dashboard
```

---

## 📋 Statik analiz qoidalari (Qatlam 1)

### Vue (9 ta rule)
- `vue/v-for-no-key` — critical
- `vue/no-v-if-v-for-same-element` — critical
- `vue/no-side-effect-in-computed` — critical
- `vue/no-sync-route-import` — critical
- `vue/no-inline-object-in-template` — warning
- `vue/no-complex-expression-in-template` — warning
- `vue/no-emit-in-loop` — warning
- `vue/watch-deep-immediate` — warning
- `vue/prefer-v-show-for-toggle` — info

### React (6 ta rule)
- `react/use-effect-no-deps` — critical
- `react/no-sync-route-import` — critical
- `react/no-inline-function-in-jsx` — warning
- `react/no-inline-object-in-jsx` — warning
- `react/no-array-index-key` — warning
- `react/use-state-object-without-spread` — warning

### Common (6 ta rule)
- `common/await-in-loop` — warning
- `common/heavy-sync-computation` — warning
- `common/no-full-library-import` — warning
- `common/uncleared-timer` — warning
- `common/unremoved-event-listener` — warning
- `common/no-console-in-prod` — info

Hammasi **AST visitor pattern**ida (ESLint uslubida). Har rule alohida modul:
`src/static/lint/rules/<vue|react|common>/<rule-id>.js`.

---

## ⚙️ Konfiguratsiya

`perf.config.js` (loyihada):
```js
export default {
  project: '.',
  format: 'console',
  outputDir: './perf-reports',
  budget: {
    bundleSize: { totalJS: 500_000, totalCSS: 100_000 },
    findings: { critical: 0, warning: 10 },
    webVitals: { LCP: 2500, INP: 200, CLS: 0.1 },
  },
};
```

Validatsiya `zod` bilan amalga oshiriladi — noto'g'ri kalit (masalan `totalJs` o'rniga
`totalJS`) action-oriented xato xabariga olib keladi.

---

## 🧪 Testlar

Vitest (native ESM) bilan:
```bash
npm test                # bir martalik
npm run test:watch      # watch
npm run test:coverage   # coverage
```

93+ test:
- AST-based rule'lar (har rule uchun fixture'da unit test)
- AST aniqligi (regex topa olmaydigan misollar)
- AI client (provider detection, JSON parse, error handling — mock fetch bilan)
- Config schema (zod validatsiya)
- Aggregator, AST extractor, trimmed mean
- Orchestrator (parallel scan + history)
- Dashboard generation (snapshot → HTML)

---

## 🏛 Arxitektura

```
performance-checker/
├── bin/perf-check.js                  # CLI entry
├── src/
│   ├── config/
│   │   ├── loader.js                  # Config + default budget
│   │   └── schema.js                  # zod validatsiya
│   ├── constants.js                   # Markaziy budget va severity
│   ├── utils/
│   │   ├── detect.js                  # Framework/bundler aniqlash
│   │   └── logger.js                  # Markaziy logger (verbose)
│   ├── static/                        # QATLAM 1
│   │   ├── index.js
│   │   ├── lint/
│   │   │   ├── index.js
│   │   │   ├── vue-rules.js           # AST wrapper
│   │   │   ├── react-rules.js
│   │   │   ├── common-rules.js
│   │   │   ├── parsers/
│   │   │   │   ├── js-parser.js       # @babel/parser+traverse
│   │   │   │   └── vue-parser.js      # @vue/compiler-sfc + compiler-dom
│   │   │   └── rules/
│   │   │       ├── index.js           # Rule registry
│   │   │       ├── rule-runner.js     # ESLint-uslubidagi runner
│   │   │       ├── vue/               # Har rule alohida
│   │   │       ├── react/
│   │   │       └── common/
│   │   ├── bundle/index.js
│   │   └── deps/index.js              # AST-based imports
│   ├── runtime/                       # QATLAM 2
│   │   ├── index.js                   # Trimmed mean, render warning
│   │   ├── playwright/browser.js
│   │   ├── metrics/
│   │   │   ├── web-vitals.js          # npm web-vitals inject
│   │   │   └── lighthouse.js
│   │   ├── scenarios/index.js
│   │   └── reporters/
│   ├── ai/                            # QATLAM 3
│   │   ├── index.js
│   │   ├── aggregator.js
│   │   ├── extractors/ast-context.js
│   │   ├── prompts/{prompt-builder, claude-client}.js
│   │   └── reporters/ai-reporter.js
│   ├── orchestrator/index.js          # QATLAM 4 (parallel)
│   ├── dashboard/index.js             # QATLAM 4 (HTML)
│   └── reporters/index.js
└── tests/
    ├── fixtures/                      # vue-app, react-app, projects.config.js
    └── {static, ai, runtime, config, orchestrator, dashboard}/*.test.js
```

---

## 📊 Finding kontrakti

Hamma qatlamlardagi findings bitta normalized format:
```ts
{
  file: string | null;     // null = runtime metrika
  line: number;
  col: number;
  rule: string;            // "vue/v-for-no-key"
  message: string;
  severity: "critical" | "warning" | "info";
  fix: string | null;
  layer: "lint" | "bundle" | "deps" | "runtime" | "ai";
}
```

---

## 🔒 Sifat standartlari

- ESM (`"type": "module"`), CommonJS yo'q.
- Public funksiyalar JSDoc bilan.
- Action-oriented xato xabarlari (foydalanuvchiga "nima qilish kerakligi"ni aytadi).
- Markaziy konstantalar `src/constants.js` da.
- Markaziy logger (`--verbose` flag bilan boshqariladi).
- Conventional commits.
