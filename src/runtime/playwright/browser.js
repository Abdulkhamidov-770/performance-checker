/**
 * Browser manager — Playwright + CDP session boshqaruvi.
 *
 * 2 rejim:
 *  - Default: alohida headless Chromium (login yo'q, toza profil)
 *  - Persistent: foydalanuvchining haqiqiy Chrome profili (login, localStorage, oidc saqlanadi)
 *    options.userDataDir berilsa, persistent rejim ishlaydi.
 */
import { chromium } from 'playwright';
import { existsSync, mkdtempSync, mkdirSync, copyFileSync, readdirSync, statSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

export async function createBrowserSession(scenario = {}, options = {}) {
  const { userDataDir, headless = true, chromeProfile } = options;

  // Persistent rejim — sizning haqiqiy Chrome profilingiz
  if (userDataDir || chromeProfile) {
    return await createPersistentSession(scenario, { userDataDir, headless, chromeProfile });
  }

  // Default rejim — toza profil
  const browser = await chromium.launch({
    headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-web-security',
      '--ignore-certificate-errors',
      '--allow-insecure-localhost',
      '--enable-precise-memory-info',
    ],
  });

  const context = await browser.newContext({
    viewport: scenario.viewport || { width: 1280, height: 800 },
    userAgent: scenario.userAgent || undefined,
    ignoreHTTPSErrors: true,
    bypassCSP: true,
  });

  await context.route('**/*', route => {
    route.continue({
      headers: {
        ...route.request().headers(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
    });
  });

  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push(err.message));

  return { browser, context, page, cdp, consoleErrors, persistent: false };
}

/**
 * Persistent context — Chrome profilingizdan localStorage, cookies, oidc ni o'qiydi.
 * Chrome'ning haqiqiy user data papkasini KOPIYA qiladi (asl profilni buzmaslik uchun).
 */
async function createPersistentSession(scenario, { userDataDir, headless, chromeProfile }) {
  let dataDir = userDataDir;

  // chromeProfile berilsa, Chrome'ning standart papkasini topib, KOPIYA qilamiz
  if (chromeProfile && !dataDir) {
    const sourceDir = findChromeUserDataDir();
    if (!sourceDir) {
      throw new Error(
        'Chrome user data topilmadi.\n  Iltimos --user-data-dir bilan to\'g\'ridan-to\'g\'ri yo\'l bering.'
      );
    }
    const profileName = chromeProfile === true ? 'Default' : chromeProfile;
    const sourceProfile = join(sourceDir, profileName);
    if (!existsSync(sourceProfile)) {
      throw new Error(
        `Chrome profili topilmadi: ${sourceProfile}\n  Mavjud profillarni Chrome'da ko'ring: chrome://version/`
      );
    }

    // Kopiya yaratamiz (Chrome ochiq bo'lsa lock muammosini oldini olish uchun).
    // Bizga ASOSAN kerak: Local Storage, IndexedDB, Preferences.
    // Cookies/Session Storage band bo'lsa skip — login OIDC tokenlari localStorage'da.
    const tmpDir = mkdtempSync(join(tmpdir(), 'perf-chrome-profile-'));
    const targetProfile = join(tmpDir, 'Default');

    // Lock yoki band bo'lgan fayllar uchun blacklist
    const SKIP_PATTERNS = [
      /Singleton/,
      /\.lock$/i,
      /lockfile/i,
      /[\\/]Cookies(-journal)?$/i,
      /[\\/]History(-journal)?$/i,
      /[\\/]Visited Links$/i,
      /[\\/]Top Sites(-journal)?$/i,
      /[\\/]Network Action Predictor(-journal)?$/i,
      /[\\/]Network[\\/]Cookies(-journal)?$/i,
      /[\\/]Network[\\/]Network Persistent State$/i,
      /[\\/]Network[\\/]Reporting and NEL$/i,
      /[\\/]Network[\\/]Trust Tokens(-journal)?$/i,
      /[\\/]Sessions[\\/]/i,
      /[\\/]Service Worker[\\/]CacheStorage[\\/]/i,
      /[\\/]GPUCache[\\/]/i,
      /[\\/]Code Cache[\\/]/i,
      /[\\/]optimization_guide_model_store[\\/]/i,
      /[\\/]segmentation_platform[\\/]/i,
    ];

    // Manual recursive copy — har bir band fayl o'tkazib yuboriladi (Chrome ochiq bo'lsa ham ishlaydi)
    const { skipped, errors } = copyRecursive(sourceProfile, targetProfile, SKIP_PATTERNS);
    if (errors > 50 && skipped < 5) {
      throw new Error(
        `Chrome profili nusxalanmadi: juda ko'p band fayl (${errors} ta).\n` +
        `  Maslahat: Chrome'ni to'liq yoping (taskkill /F /IM chrome.exe /T) va qayta urining.`
      );
    }
    dataDir = tmpDir;
  }

  const context = await chromium.launchPersistentContext(dataDir, {
    headless,
    viewport: scenario.viewport || { width: 1280, height: 800 },
    userAgent: scenario.userAgent || undefined,
    ignoreHTTPSErrors: true,
    bypassCSP: true,
    args: [
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--ignore-certificate-errors',
      '--allow-insecure-localhost',
      '--enable-precise-memory-info',
    ],
  });

  // Cache o'chirish (har run uchun toza o'lchov)
  await context.route('**/*', route => {
    route.continue({
      headers: {
        ...route.request().headers(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
    });
  });

  const page = context.pages()[0] || await context.newPage();
  const cdp = await context.newCDPSession(page);

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push(err.message));

  return { browser: null, context, page, cdp, consoleErrors, persistent: true };
}

/**
 * Recursive copy — band/lock fayllarni o'tkazib yuboradi.
 * @returns {{ copied: number, skipped: number, errors: number }}
 */
function copyRecursive(source, target, skipPatterns) {
  const stats = { copied: 0, skipped: 0, errors: 0 };
  walk(source, target);
  return stats;

  function walk(srcDir, tgtDir) {
    let entries;
    try {
      entries = readdirSync(srcDir);
    } catch {
      stats.errors++;
      return;
    }

    try {
      mkdirSync(tgtDir, { recursive: true });
    } catch {
      stats.errors++;
      return;
    }

    for (const name of entries) {
      const srcPath = join(srcDir, name);
      const tgtPath = join(tgtDir, name);
      const norm = srcPath.replace(/\\/g, '/');

      // Skip pattern tekshiruvi
      let skip = false;
      for (const pat of skipPatterns) {
        if (pat.test(norm)) { skip = true; break; }
      }
      if (skip) { stats.skipped++; continue; }

      let st;
      try { st = statSync(srcPath); } catch { stats.errors++; continue; }

      if (st.isDirectory()) {
        walk(srcPath, tgtPath);
      } else if (st.isFile()) {
        try {
          copyFileSync(srcPath, tgtPath);
          stats.copied++;
        } catch (err) {
          // Band yoki lock'langan fayllar — o'tkazib yuboramiz
          stats.skipped++;
        }
      }
    }
  }
}

function findChromeUserDataDir() {
  const candidates = [
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'User Data'),
    process.env.HOME && join(process.env.HOME, 'AppData', 'Local', 'Google', 'Chrome', 'User Data'),
    process.env.HOME && join(process.env.HOME, 'Library', 'Application Support', 'Google', 'Chrome'),
    process.env.HOME && join(process.env.HOME, '.config', 'google-chrome'),
  ].filter(Boolean);
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

export async function closeBrowser({ browser, context, persistent } = {}) {
  try {
    if (persistent && context) {
      await context.close();
    } else if (browser) {
      await browser.close();
    }
  } catch {}
}
