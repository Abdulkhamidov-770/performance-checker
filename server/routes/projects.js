/**
 * Projects CRUD API.
 */
import { z } from 'zod';
import { existsSync } from 'fs';

const projectSchema = z.object({
  name: z.string().min(1).max(120),
  path: z.string().min(1),
  framework: z.enum(['vue', 'react', 'auto']).optional().default('auto'),
  url: z.string().url().optional().or(z.literal('')).transform(v => v || null),
  scenario: z.enum(['desktop', 'mobile', 'slow']).optional().default('desktop'),
  chrome_profile: z.string().nullable().optional(),
  user_data_dir: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export default async function projectsRoutes(fastify) {
  // GET /api/projects
  fastify.get('/', async () => {
    const rows = fastify.db.prepare(
      'SELECT * FROM projects ORDER BY updated_at DESC'
    ).all();
    return rows.map(decorate);
  });

  // GET /api/projects/:id
  fastify.get('/:id', async (req, reply) => {
    const row = fastify.db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    if (!row) return reply.status(404).send({ error: 'NotFound', message: 'Loyiha topilmadi' });
    return decorate(row);
  });

  // POST /api/projects
  fastify.post('/', async (req, reply) => {
    const data = projectSchema.parse(req.body);
    if (!existsSync(data.path)) {
      return reply.status(400).send({
        error: 'InvalidPath',
        message: `Loyiha yo'li mavjud emas: ${data.path}`,
      });
    }
    const now = Date.now();
    const stmt = fastify.db.prepare(`
      INSERT INTO projects (name, path, framework, url, scenario, chrome_profile, user_data_dir, notes, created_at, updated_at)
      VALUES (@name, @path, @framework, @url, @scenario, @chrome_profile, @user_data_dir, @notes, @created_at, @updated_at)
    `);
    const result = stmt.run({
      ...data,
      chrome_profile: data.chrome_profile ?? null,
      user_data_dir: data.user_data_dir ?? null,
      notes: data.notes ?? null,
      created_at: now,
      updated_at: now,
    });
    const created = fastify.db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
    reply.status(201);
    return decorate(created);
  });

  // PUT /api/projects/:id
  fastify.put('/:id', async (req, reply) => {
    const data = projectSchema.partial().parse(req.body);
    const existing = fastify.db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    if (!existing) return reply.status(404).send({ error: 'NotFound', message: 'Loyiha topilmadi' });

    const updated = { ...existing, ...data, updated_at: Date.now() };
    fastify.db.prepare(`
      UPDATE projects
      SET name=@name, path=@path, framework=@framework, url=@url, scenario=@scenario,
          chrome_profile=@chrome_profile, user_data_dir=@user_data_dir, notes=@notes,
          updated_at=@updated_at
      WHERE id=@id
    `).run(updated);
    return decorate(updated);
  });

  // DELETE /api/projects/:id
  fastify.delete('/:id', async (req, reply) => {
    const result = fastify.db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return reply.status(404).send({ error: 'NotFound', message: 'Loyiha topilmadi' });
    }
    return { ok: true };
  });
}

function decorate(row) {
  if (!row) return row;
  return {
    ...row,
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString(),
  };
}
