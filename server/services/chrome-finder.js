/**
 * Lokal Chrome profillarini topish.
 * Profillar: %LOCALAPPDATA%/Google/Chrome/User Data/{Default, Profile 1, ...}
 */
import { existsSync, readdirSync, statSync, readFileSync } from 'fs';
import { join } from 'path';

export function findChromeUserDataDir() {
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

/**
 * Chrome profillarini ro'yxat qilish.
 * @returns {Array<{name:string, displayName:string, path:string, lastUsed:number|null}>}
 */
export function listChromeProfiles() {
  const root = findChromeUserDataDir();
  if (!root) return [];
  const entries = readdirSync(root);
  const profiles = [];

  for (const name of entries) {
    if (name !== 'Default' && !name.startsWith('Profile ')) continue;
    const profilePath = join(root, name);
    try {
      const st = statSync(profilePath);
      if (!st.isDirectory()) continue;
    } catch { continue; }

    let displayName = name;
    let lastUsed = null;
    const prefsPath = join(profilePath, 'Preferences');
    if (existsSync(prefsPath)) {
      try {
        const prefs = JSON.parse(readFileSync(prefsPath, 'utf8'));
        displayName = prefs.profile?.name || name;
        if (prefs.profile?.last_active_time) {
          lastUsed = Number(prefs.profile.last_active_time);
        }
      } catch {}
    }
    profiles.push({ name, displayName, path: profilePath, lastUsed });
  }
  return profiles.sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0));
}

export function chromeRootDir() {
  return findChromeUserDataDir();
}
