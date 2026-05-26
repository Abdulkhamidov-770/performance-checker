/**
 * Settings API — API keylar va konfiguratsiya saqlash.
 * Sensitive qiymatlar (API key) maskirovka bilan qaytariladi.
 */
import { z } from 'zod';

const SENSITIVE_KEYS = new Set(['GEMINI_API_KEY', 'ANTHROPIC_API_KEY', 'GOOGLE_API_KEY']);

const updateSchema = z.object({
  key: z.string().min(1).max(80),
  value: z.string().nullable(),
});

export default async function settingsRoutes(fastify) {
  // GET /api/settings
  fastify.get('/', async () => {
    const rows = fastify.db.prepare('SELECT key, value, updated_at FROM settings').all();
    const result = {};
    for (const row of rows) {
      result[row.key] = {
        value: SENSITIVE_KEYS.has(row.key) ? maskKey(row.value) : row.value,
        hasValue: !!row.value,
        sensitive: SENSITIVE_KEYS.has(row.key),
        updated_at: new Date(row.updated_at).toISOString(),
      };
    }
    // Env'dan defaults (UI ko'rsatish uchun)
    for (const k of SENSITIVE_KEYS) {
      if (!result[k] && process.env[k]) {
        result[k] = {
          value: maskKey(process.env[k]),
          hasValue: true,
          sensitive: true,
          fromEnv: true,
          updated_at: null,
        };
      }
    }
    return result;
  });

  // PUT /api/settings — bitta qiymat yangilash
  fastify.put('/', async (req) => {
    const data = updateSchema.parse(req.body);
    const now = Date.now();
    fastify.db.prepare(`
      INSERT INTO settings (key, value, encrypted, updated_at)
      VALUES (@key, @value, 0, @updated_at)
      ON CONFLICT(key) DO UPDATE SET value=@value, updated_at=@updated_at
    `).run({ key: data.key, value: data.value, updated_at: now });
    return { ok: true };
  });

  // DELETE /api/settings/:key
  fastify.delete('/:key', async (req) => {
    fastify.db.prepare('DELETE FROM settings WHERE key = ?').run(req.params.key);
    return { ok: true };
  });
}

function maskKey(value) {
  if (!value) return '';
  if (value.length < 12) return '***';
  return value.slice(0, 6) + '...' + value.slice(-4);
}
