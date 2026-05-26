Tizim qanday ishlaydi (3 xil tahlil)
Bu tizim 3 xil yo'l bilan loyihani tekshiradi — sizning haqiqiy savolingiz aynan shu joyda:

1. Qatlam 1 (Static) — kodni o'qiydi, ishga tushirmaydi
Bu authorization talab qilmaydi. Ishlash usuli:

Tizim sizning loyiha fayllaringizni glob orqali topadi (*.vue, *.jsx, *.js, package.json)
Har bir faylni readFileSync bilan o'qib, AST'ga parse qiladi
AST visitor'lar orqali muammoli pattern'larni topadi (masalan v-for :keysiz)
Login, brauzer, server — hech narsa kerak emas. Faqat fayllar kerak.
Bu ESLint qanday ishlasa, shunday — kodni o'qish, ishga tushirmaslik.

2. Qatlam 2 (Runtime) — brauzerda loyihani ochib o'lchaydi
Bu yerda loyiha local'da ishga tushgan bo'lishi kerak (npm run dev).

Tizim Playwright (headless Chromium) ishga tushiradi
Sizning http://localhost:5173 URL'ingizni ochadi
Web Vitals (LCP, CLS, INP), Long Tasks, network, Lighthouse o'lchaydi
Authorization muammosi: bu yerda haqli savol bor. Hozircha tizim faqat ommaviy sahifalarni (login talab qilmaydigan) o'lchaydi. Agar loyiha login ortida bo'lsa, hozircha avtomatik kira olmaydi — bu kelajakdagi yaxshilanish.

3. Qatlam 3 (AI) — Qatlam 1+2 natijalarini AI ga yuboradi
AI kodni o'zi tekshirmaydi. Faqat topilgan muammoning kod bo'lagini olib, "buni qanday tuzatish kerak" deb so'raydi. Bu uchun GEMINI_API_KEY kerak.

Sizning amaliy qadamlaringiz
Bu tizimni test qilish uchun 3 stsenariy bor — birortasini tanlang:

Stsenariy A — Eng oson: faqat statik tahlil (build kerak emas, server kerak emas)
Sizda bo'lishi kerak: oddiy Vue yoki React loyiha papkasi (masalan C:\MyComp\react-projects\my-vue-app).


cd c:\MyComp\react-projects\performance-checker

# Loyiha statik tahlili — kod o'qiladi, ishga tushirilmaydi
node bin/perf-check.js --project c:\MyComp\react-projects\my-vue-app
Natija: terminal'da fayl:qator darajasida ro'yxat. Faqat shu — login yo'q, server yo'q, hech narsa.

Stsenariy B — Runtime tahlil ham qo'shiladi (loyihani local'da ishga tushiramiz)
Bir terminal'da loyihani ishga tushiring:

cd c:\MyComp\react-projects\my-vue-app
npm run dev
# Vite chiqaradi: "Local: http://localhost:5173/"
Boshqa terminal'da tahlil qiling:

cd c:\MyComp\react-projects\performance-checker
node bin/perf-check.js full --project c:\MyComp\react-projects\my-vue-app --url http://localhost:5173
Tizim avtomatik:

Static tahlil qiladi (kod o'qiydi)
Playwright ochib http://localhost:5173 ga kiradi (login yo'q sahifa)
LCP, bundle hajm, Long Task'larni o'lchaydi
./perf-reports/perf-report.json ga yagona hisobot yozadi
Stsenariy C — 30+ loyiha (dashboard'ni ko'rish)
Loyihalar ro'yxati yarating — c:\MyComp\react-projects\performance-checker\my-projects.config.js:

export default {
  concurrency: 3,
  historyDir: './.perf-history',
  projects: [
    { name: 'app-1', path: 'c:\\MyComp\\react-projects\\app-1' },
    { name: 'app-2', path: 'c:\\MyComp\\react-projects\\app-2' },
    { name: 'app-3', path: 'c:\\MyComp\\react-projects\\app-3' },
  ],
};
Ishga tushiring:

node bin/perf-check.js scan --file ./my-projects.config.js
./dashboard/dashboard.html ni brauzerda oching — barcha loyihalar reytingi, tarixiy trend va regression flag.
Authorization haqida — to'g'ri savol
Sizning shubhangiz haqli. Qisqacha:

Qatlam 1: hech qachon kerak emas — faqat kod o'qiladi
Qatlam 2: hozircha ommaviy sahifa kerak (login yo'q yoki dev modda mock data bilan)
Agar siz login-protected sahifani o'lchashni xohlasangiz — bu hozircha qo'llanmaydi, lekin qo'shish oson (Playwright page.fill() + page.click() bilan login formani avtomatik to'ldirish — keyingi yaxshilash)
Qaysi stsenariyni hozir sinab ko'rmoqchisiz?
Menga ayting:

Sizda nechta loyiha bor va qaerda joylashgan?
Stsenariy A (oson — faqat static) ni boshlaymizmi, yoki B (server bilan)?
Yo'lni ko'rsataman.

