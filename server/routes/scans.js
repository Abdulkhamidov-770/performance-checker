/**
 * Scans API — skan boshlash, ro'yxat, holat.
 */
import { z } from 'zod';

const startSchema = z.object({
  projectId: z.number().int().positive(),
  layers: z.array(z.enum(['static', 'runtime', 'ai'])).min(1),
  scenario: z.enum(['desktop', 'mobile', 'slow']).optional(),
  runs: z.number().int().min(1).max(10).optional(),
});

export default async function scansRoutes(fastify) {
  // POST /api/scans — yangi skan
  fastify.post('/', async (req, reply) => {
    const data = startSchema.parse(req.body);
    const project = fastify.db.prepare('SELECT * FROM projects WHERE id = ?').get(data.projectId);
    if (!project) {
      return reply.status(404).send({ error: 'NotFound', message: 'Loyiha topilmadi' });
    }
    if (data.layers.includes('runtime') && !project.url) {
      return reply.status(400).send({
        error: 'MissingUrl',
        message: 'Runtime skan uchun loyihada URL kerak',
      });
    }

    // API keylar settings'dan
    const settings = fastify.db.prepare('SELECT key, value FROM settings').all();
    const settingsMap = Object.fromEntries(settings.map(s => [s.key, s.value]));

    const jobId = fastify.jobs.start({
      project,
      layers: data.layers,
      config: {
        scenario: data.scenario,
        runs: data.runs,
        geminiApiKey: settingsMap.GEMINI_API_KEY || process.env.GEMINI_API_KEY,
        anthropicApiKey: settingsMap.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY,
      },
    });
    reply.status(202);
    return { jobId };
  });

  // GET /api/scans — barcha skanlar (filter qilinishi mumkin)
  fastify.get('/', async (req) => {
    const { projectId, limit = 50 } = req.query;
    const args = [];
    let sql = `
      SELECT s.*, p.name as project_name
      FROM scans s
      LEFT JOIN projects p ON p.id = s.project_id
    `;
    if (projectId) {
      sql += ' WHERE s.project_id = ?';
      args.push(Number(projectId));
    }
    sql += ' ORDER BY s.started_at DESC LIMIT ?';
    args.push(Number(limit));
    const rows = fastify.db.prepare(sql).all(...args);
    return rows.map(decorate);
  });

  // GET /api/scans/:id
  fastify.get('/:id', async (req, reply) => {
    const row = fastify.db.prepare(`
      SELECT s.*, p.name as project_name FROM scans s
      LEFT JOIN projects p ON p.id = s.project_id WHERE s.id = ?
    `).get(req.params.id);
    if (!row) return reply.status(404).send({ error: 'NotFound', message: 'Skan topilmadi' });
    return decorate(row);
  });

  // POST /api/scans/:id/cancel
  fastify.post('/:id/cancel', async (req, reply) => {
    const ok = fastify.jobs.cancel(req.params.id);
    if (!ok) return reply.status(404).send({ error: 'NotRunning', message: 'Skan ishlamayapti' });
    return { ok: true };
  });
}

function decorate(row) {
  return {
    ...row,
    layers: row.layers ? JSON.parse(row.layers) : [],
    result_summary: row.result_summary ? JSON.parse(row.result_summary) : null,
    started_at: row.started_at ? new Date(row.started_at).toISOString() : null,
    finished_at: row.finished_at ? new Date(row.finished_at).toISOString() : null,
  };
}
