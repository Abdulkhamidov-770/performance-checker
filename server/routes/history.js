/**
 * History API — loyiha bo'yicha tarix snapshotlari (trend chart uchun).
 */
export default async function historyRoutes(fastify) {
  // GET /api/history/:projectId
  fastify.get('/:projectId', async (req) => {
    const limit = Number(req.query.limit) || 50;
    const rows = fastify.db.prepare(`
      SELECT id, scan_id, taken_at, lighthouse, lcp, inp, cls, tbt,
             total_kb, critical_count, warning_count, info_count, regression
      FROM snapshots
      WHERE project_id = ?
      ORDER BY taken_at ASC
      LIMIT ?
    `).all(req.params.projectId, limit);

    return rows.map(r => ({
      ...r,
      taken_at: new Date(r.taken_at).toISOString(),
    }));
  });

  // GET /api/history — overview: barcha loyihalar oxirgi snapshot
  fastify.get('/', async () => {
    const rows = fastify.db.prepare(`
      SELECT p.id, p.name, p.path, p.framework,
             s.taken_at, s.lighthouse, s.lcp, s.critical_count, s.warning_count, s.regression
      FROM projects p
      LEFT JOIN snapshots s ON s.id = (
        SELECT id FROM snapshots WHERE project_id = p.id ORDER BY taken_at DESC LIMIT 1
      )
      ORDER BY p.updated_at DESC
    `).all();
    return rows.map(r => ({
      ...r,
      taken_at: r.taken_at ? new Date(r.taken_at).toISOString() : null,
    }));
  });
}
