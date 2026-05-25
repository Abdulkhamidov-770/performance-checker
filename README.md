# ⚡ Performance Checker

> Vue/React frontend loyihalari uchun avtomatlashtirilgan **statik performance analizchi** (Qatlam 1).
> Har bir muammoni aniq **fayl:qator** darajasida ko'rsatadi.

---

## 🏗 Arxitektura

```
performance-checker/
├── bin/
│   └── perf-check.js          # CLI entry point
├── src/
│   ├── config/
│   │   └── loader.js          # Config yuklash + default budget
│   ├── utils/
│   │   └── detect.js          # Framework/bundler avtomatik aniqlash
│   ├── static/
│   │   ├── index.js           # Statik analiz orchestrator'i
│   │   ├── lint/
│   │   │   ├── index.js       # Lint qatlami runner'i
│   │   │   ├── vue-rules.js   # 10 ta Vue performance rule
│   │   │   ├── react-rules.js # 8 ta React performance rule
│   │   │   └── common-rules.js # 6 ta umumiy JS/TS rule
│   │   ├── bundle/
│   │   │   └── index.js       # Bundle analiz (og'ir dep, dist hajm)
│   │   └── deps/
│   │       └── index.js       # Dependency analiz (unused, circular)
│   └── reporters/
│       └── index.js           # Console + JSON + HTML reporter
├── .github/
│   └── workflows/
│       └── perf-check.yml     # GitHub Actions CI workflow
└── perf.config.example.js     # Namuna konfiguratsiya
```

---

## 🚀 O'rnatish

```bash
# Global o'rnatish
npm install -g performance-checker

# Yoki loyiha devDependency sifatida
npm install --save-dev performance-checker
```

---

## ⚙️ Ishlatish

### Asosiy buyruqlar

```bash
# Barcha qatlamlar (lint + bundle + deps)
perf-check --project ./my-vue-app

# Faqat lint analiz
perf-check --project ./my-app --layer lint

# Faqat bundle analiz
perf-check --project ./my-app --layer bundle

# HTML + JSON hisobot yaratish
perf-check --project ./my-app --report --format html

# O'z konfiguratsiyangiz bilan
perf-check --config ./perf.config.js
```

### Ko'p loyiha uchun (bash skript)

```bash
# projects.txt — har qatorda loyiha yo'li
cat projects.txt | xargs -I{} perf-check --project {} --format json
```

---

## ⚙️ Konfiguratsiya

`perf.config.example.js`ni nusxalab, `perf.config.js` yarating:

```js
export default {
  project: '.',
  layers: ['lint', 'bundle', 'deps'],
  format: 'console',           // 'json' | 'html' | 'all'
  outputDir: './perf-reports',
  budget: {
    bundleSize: {
      totalJS: 500 * 1024,     // 500KB
      totalCSS: 100 * 1024,    // 100KB
    },
    findings: {
      critical: 0,             // CI bloklanadi
      warning: 15,
    },
  },
};
```

---

## 📋 Topilgan muammo turlari

### Vue rules (vue-rules.js)
| Rule ID | Tavsif | Jiddiylik |
|---------|--------|-----------|
| `vue/v-for-no-key` | `v-for` da `:key` yo'q | critical |
| `vue/no-v-if-v-for-same-element` | `v-if` + `v-for` bir elementda | critical |
| `vue/no-sync-route-import` | Route'lar lazy load qilinmagan | critical |
| `vue/no-side-effect-in-computed` | Computed'da side effect | critical |
| `vue/no-inline-object-in-template` | Template'da inline object | warning |
| `vue/watch-deep-immediate` | `deep` + `immediate` birga | warning |
| `vue/no-emit-in-loop` | Loop ichida `$emit` | warning |
| `vue/no-complex-expression-in-template` | Murakkab template ifoda | warning |
| `vue/prefer-v-show-for-toggle` | Toggle uchun `v-if` | info |
| `vue/suggest-v-once` | Statik blokda `v-once` yo'q | info |

### React rules (react-rules.js)
| Rule ID | Tavsif | Jiddiylik |
|---------|--------|-----------|
| `react/no-sync-route-import` | Route'lar lazy load qilinmagan | critical |
| `react/use-effect-no-deps` | `useEffect` dependency array yo'q | critical |
| `react/no-inline-function-in-jsx` | JSX'da inline funksiya | warning |
| `react/no-inline-object-in-jsx` | JSX'da inline object | warning |
| `react/no-array-index-key` | Array index'ni key sifatida | warning |
| `react/use-state-object-without-spread` | setState'da spread yo'q | warning |
| `react/suggest-memo` | Katta komponentda `memo` yo'q | info |

### Bundle rules (bundle/index.js)
| Rule ID | Tavsif | Jiddiylik |
|---------|--------|-----------|
| `bundle/js-size-over-budget` | JS hajmi budget'dan oshdi | critical |
| `bundle/heavy-package` | Og'ir kutubxona (moment, lodash...) | critical/warning |
| `bundle/no-manual-chunks` | Vendor splitting yo'q | info |
| `bundle/sourcemap-in-prod` | Production'da sourcemap | warning |
| `bundle/duplicate-packages` | Bir xil maqsadli dep'lar | warning |
| `bundle/large-chunk` | 500KB+ yagona chunk | warning |

### Deps rules (deps/index.js)
| Rule ID | Tavsif | Jiddiylik |
|---------|--------|-----------|
| `deps/unused-dependency` | Kodda ishlatilmagan dep | info |
| `deps/circular-dependency` | Circular import | warning |
| `deps/deep-relative-import` | 3+ darajali `../../../` | info |

### Common rules (common-rules.js)
| Rule ID | Tavsif | Jiddiylik |
|---------|--------|-----------|
| `common/await-in-loop` | Loop ichida await (N+1) | warning |
| `common/no-full-library-import` | Butun kutubxona import | warning |
| `common/uncleared-timer` | Tozalanmagan setTimeout | warning |
| `common/unremoved-event-listener` | Olib tashlanmagan EventListener | warning |
| `common/heavy-sync-computation` | Loop ichida JSON.parse | warning |
| `common/no-console-in-prod` | Production'da console.log | info |

---

## 📊 Natija formati (JSON)

```json
{
  "findings": [
    {
      "file": "src/components/ProductList.vue",
      "line": 23,
      "col": 5,
      "rule": "vue/v-for-no-key",
      "message": "`v-for` da `:key` yo'q — DOM diffing sekinlashadi.",
      "severity": "critical",
      "fix": "`:key` attribut qo'shing: `v-for=\"item in list\" :key=\"item.id\"`",
      "layer": "lint"
    }
  ],
  "summary": {
    "total": 12,
    "bySeverity": { "critical": 2, "warning": 7, "info": 3 },
    "byLayer": { "lint": 6, "bundle": 4, "deps": 2 },
    "hotspots": [
      { "file": "src/views/Dashboard.vue", "count": 4 }
    ],
    "passed": false
  }
}
```

---

## 🔄 CI/CD integratsiyasi

`.github/workflows/perf-check.yml` allaqachon sozlangan. U:
- Har PR da statik analiz ishlatadi
- Critical topilmalar bo'lsa pipeline'ni bloklaydi
- Natijalarni PR kommentiga yozadi
- HTML/JSON hisobotlarni artifact sifatida saqlaydi

---

## 🗺 Keyingi bosqichlar (Roadmap)

- **Qatlam 2**: Playwright + CDP — runtime profiling, Web Vitals, render counts
- **Qatlam 3**: AI — grounded fix tavsiyalar (Claude API)
- **Qatlam 4**: Dashboard — tarixiy trend, 30+ loyiha reytingi
