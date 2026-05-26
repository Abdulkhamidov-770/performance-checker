/**
 * Test stsenariylari — throttle konfiguratsiyalari
 * Real foydalanuvchi sharoitlarini simulatsiya qiladi
 */

const SCENARIOS = {

  // Desktop — tez internet, zamonaviy kompyuter
  desktop: {
    label: 'Desktop (No throttle)',
    viewport: { width: 1280, height: 800 },
    cpuThrottling: 1,            // throttle yo'q
    network: null,               // throttle yo'q
    lighthouse: {
      formFactor: 'desktop',
      throttlingMethod: 'simulate',
      throttling: {
        rttMs: 40,
        throughputKbps: 10240,
        cpuSlowdownMultiplier: 1,
      },
      screenEmulation: {
        mobile: false,
        width: 1280,
        height: 800,
        deviceScaleFactor: 1,
        disabled: false,
      },
    },
  },

  // Mobile — o'rtacha telefon, 4G tarmoq
  mobile: {
    label: 'Mobile (4G, 4x CPU slowdown)',
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    cpuThrottling: 4,            // 4x sekin (o'rtacha Android)
    network: {
      // 4G LTE
      offline: false,
      downloadThroughput: 9 * 1024 * 1024 / 8,   // 9 Mbps
      uploadThroughput: 4.5 * 1024 * 1024 / 8,   // 4.5 Mbps
      latency: 170,
    },
    lighthouse: {
      formFactor: 'mobile',
      throttlingMethod: 'simulate',
      throttling: {
        rttMs: 150,
        throughputKbps: 1638,
        cpuSlowdownMultiplier: 4,
      },
      screenEmulation: {
        mobile: true,
        width: 390,
        height: 844,
        deviceScaleFactor: 3,
        disabled: false,
      },
    },
  },

  // Slow — past darajali qurilma, sekin internet (eng qiyin stsenariy)
  slow: {
    label: 'Slow 3G + 6x CPU (low-end device)',
    viewport: { width: 360, height: 780 },
    userAgent: 'Mozilla/5.0 (Linux; Android 10; SM-A205U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    cpuThrottling: 6,            // 6x sekin (past darajali Android)
    network: {
      // Slow 3G
      offline: false,
      downloadThroughput: 400 * 1024 / 8,    // 400 Kbps
      uploadThroughput: 300 * 1024 / 8,      // 300 Kbps
      latency: 400,
    },
    lighthouse: {
      formFactor: 'mobile',
      throttlingMethod: 'simulate',
      throttling: {
        rttMs: 562.5,
        throughputKbps: 400,
        cpuSlowdownMultiplier: 6,
      },
      screenEmulation: {
        mobile: true,
        width: 360,
        height: 780,
        deviceScaleFactor: 2.625,
        disabled: false,
      },
    },
  },
};

export function getScenario(name) {
  const scenario = SCENARIOS[name];
  if (!scenario) {
    console.warn(`⚠  "${name}" stsenariy topilmadi, "desktop" ishlatiladi.`);
    return SCENARIOS.desktop;
  }
  return scenario;
}

export function listScenarios() {
  return Object.entries(SCENARIOS).map(([key, s]) => ({ key, label: s.label }));
}
