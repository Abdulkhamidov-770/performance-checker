/**
 * Mavjud projects.config.js fayldan DB ga loyihalarni import qilish.
 * Foydalanish: node server/import-projects.js ./my-projects.config.js
 */
import { resolve } from 'path';
import { pathToFileURL } from 'url';
import { getDB } from './services/db.js';

const cfgPath = resolve(process.argv[2] || './my-projects.config.js');
const cfg = (await import(pathToFileURL(cfgPath).href)).default;
const db = getDB();

const stmt = db.prepare(`
  INSERT INTO projects (name, path, framework, url, scenario, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const exists = db.prepare('SELECT 1 FROM projects WHERE name = ? AND path = ?');

let added = 0, skipped = 0;
for (const p of cfg.projects) {
  if (exists.get(p.name, p.path)) { skipped++; continue; }
  const now = Date.now();
  stmt.run(p.name, p.path, p.framework || 'auto', p.url || null, p.scenario || 'desktop', now, now);
  added++;
}
console.log(`✅ Import tugadi: ${added} ta qo'shildi, ${skipped} ta o'tkazib yuborildi`);
process.exit(0);
