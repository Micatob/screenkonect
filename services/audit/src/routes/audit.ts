import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db, auditLogs } from '@screenkonect/db';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { verifyAccessToken } from '@screenkonect/shared';

const QuerySchema = z.object({
  session_id: z.string().uuid().optional(),
  user_id: z.string().uuid().optional(),
  action: z.string().optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  limit: z.coerce.number().min(1).max(1000).default(100),
  offset: z.coerce.number().min(0).default(0),
});

async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.slice(7);
  try {
    const payload = verifyAccessToken(token);
    (request as any).user = payload;
  } catch {
    return reply.status(401).send({ error: 'Invalid or expired token' });
  }
}

export async function auditRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = QuerySchema.parse(request.query);
    const user = (request as any).user;

    const conditions = [];

    if (query.session_id) {
      conditions.push(eq(auditLogs.session_id, query.session_id));
    }

    if (query.user_id) {
      conditions.push(eq(auditLogs.user_id, query.user_id));
    } else if (user.role !== 'admin') {
      conditions.push(eq(auditLogs.user_id, user.sub));
    }

    if (query.action) {
      conditions.push(eq(auditLogs.action, query.action));
    }

    if (query.start_date) {
      conditions.push(gte(auditLogs.created_at, new Date(query.start_date)));
    }

    if (query.end_date) {
      conditions.push(lte(auditLogs.created_at, new Date(query.end_date)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const logs = await db.query.auditLogs.findMany({
      where: whereClause,
      orderBy: (auditLogs, { desc }) => [desc(auditLogs.created_at)],
      limit: query.limit,
      offset: query.offset,
    });

    return { logs, limit: query.limit, offset: query.offset };
  });

  app.get('/:id', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const user = (request as any).user;

    const numericId = Number(id);
    if (!Number.isInteger(numericId)) {
      return reply.status(400).send({ error: 'Invalid audit log id' });
    }

    const log = await db.query.auditLogs.findFirst({
      where: eq(auditLogs.id, numericId),
    });

    if (!log) {
      return reply.status(404).send({ error: 'Audit log not found' });
    }

    if (user.role !== 'admin' && log.user_id !== user.sub) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    return { log };
  });
}
