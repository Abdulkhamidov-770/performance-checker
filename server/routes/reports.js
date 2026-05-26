/**
 * Reports API — bitta skan hisobotlari ro'yxati va metadatasi.
 * HTML fayllar /reports-static/ orqali to'g'ridan-to'g'ri serve qilinadi.
 */
import { readdirSync, statSync, readFileSync, existsSync } from 'fs';
import { join, basename } from 'path';

export default async function reportsRoutes(fastify) {
  // GET /api/reports/:scanId — fayllar ro'yxati + meta
  fastify.get('/:scanId', async (req, reply) => {
    const { scanId } = req.params;
    const scan = fastify.db.prepare('SELECT * FROM scans WHERE id = ?').get(scanId);
    if (!scan) return reply.status(404).send({ error: 'NotFound', message: 'Skan topilmadi' });
    if (!scan.report_dir || !existsSync(scan.report_dir)) {
      return { scanId, files: [], meta: null };
    }

    const entries = readdirSync(scan.report_dir).map(name => {
      const full = join(scan.report_dir, name);
      const st = statSync(full);
      return {
        name,
        size: st.size,
        modified: new Date(st.mtimeMs).toISOString(),
        url: `/reports-static/${basename(scan.report_dir)}/${name}`,
        ext: name.split('.').pop().toLowerCase(),
      };
    });

    let meta = null;
    const jsonPath = join(scan.report_dir, 'perf-report.json');
    if (existsSync(jsonPath)) {
      try {
        const data = JSON.parse(readFileSync(jsonPath, 'utf8'));
        meta = data.meta;
      } catch {}
    }

    return { scanId, files: entries, meta };
  });

  // GET /api/reports/:scanId/findings — barcha findinglar JSON shaklida
  fastify.get('/:scanId/findings', async (req, reply) => {
    const scan = fastify.db.prepare('SELECT * FROM scans WHERE id = ?').get(req.params.scanId);
    if (!scan || !scan.report_dir) {
      return reply.status(404).send({ error: 'NotFound', message: 'Hisobot topilmadi' });
    }
    const jsonPath = join(scan.report_dir, 'perf-report.json');
    if (!existsSync(jsonPath)) {
      // fallback — alohida fayllarni o'qish
      return { findings: [] };
    }
    try {
      const data = JSON.parse(readFileSync(jsonPath, 'utf8'));
      return {
        findings: data.findings || [],
        meta: data.meta,
        summary: {
          static: data.static?.summary,
          runtime: data.runtime?.summary,
          ai: data.ai?.summary,
        },
      };
    } catch (err) {
      return reply.status(500).send({ error: 'ReadError', message: err.message });
    }
  });
}
