import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db, sessions, consentEvents } from '@screenkonect/db';
import { eq } from 'drizzle-orm';
import { generateId } from '@screenkonect/shared';

const ApproveSchema = z.object({
  permissions: z.object({
    view: z.boolean().default(true),
    control: z.boolean().default(false),
    clipboard: z.boolean().default(false),
    file_transfer: z.boolean().default(false),
    audio: z.boolean().default(false),
  }),
});

const RejectSchema = z.object({
  reason: z.string().optional(),
});

export async function consentRoutes(app: FastifyInstance) {
  app.post('/:id/approve', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = ApproveSchema.parse(request.body);

    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, id),
    });

    if (!session) {
      return reply.status(404).send({ error: 'Session not found' });
    }

    if (session.consent_state !== 'pending') {
      return reply.status(400).send({ error: 'Session is not awaiting consent' });
    }

    const [updated] = await db
      .update(sessions)
      .set({
        consent_state: 'approved',
        status: 'active',
        started_at: new Date(),
        permissions: body.permissions,
      })
      .where(eq(sessions.id, id))
      .returning();

    await db.insert(consentEvents).values({
      session_id: id,
      event_type: 'consent_approved',
      granted_by: 'client',
      permissions: body.permissions,
      ip_address: request.ip,
      user_agent: request.headers['user-agent'] || null,
    });

    return { session: updated };
  });

  app.post('/:id/reject', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = RejectSchema.parse(request.body);

    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, id),
    });

    if (!session) {
      return reply.status(404).send({ error: 'Session not found' });
    }

    if (session.consent_state !== 'pending') {
      return reply.status(400).send({ error: 'Session is not awaiting consent' });
    }

    const [updated] = await db
      .update(sessions)
      .set({
        consent_state: 'denied',
        status: 'ended',
        ended_at: new Date(),
        ended_reason: 'client_revoked',
      })
      .where(eq(sessions.id, id))
      .returning();

    await db.insert(consentEvents).values({
      session_id: id,
      event_type: 'consent_denied',
      granted_by: 'client',
      permissions: null,
      ip_address: request.ip,
      user_agent: request.headers['user-agent'] || null,
    });

    return { session: updated };
  });

  app.post('/:id/revoke', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, id),
    });

    if (!session) {
      return reply.status(404).send({ error: 'Session not found' });
    }

    if (session.status !== 'active' && session.status !== 'paused') {
      return reply.status(400).send({ error: 'Session is not active' });
    }

    const [updated] = await db
      .update(sessions)
      .set({
        consent_state: 'revoked',
        status: 'ended',
        ended_at: new Date(),
        ended_reason: 'client_revoked',
      })
      .where(eq(sessions.id, id))
      .returning();

    await db.insert(consentEvents).values({
      session_id: id,
      event_type: 'consent_revoked',
      granted_by: 'client',
      permissions: null,
      ip_address: request.ip,
      user_agent: request.headers['user-agent'] || null,
    });

    return { session: updated };
  });

  app.post('/:id/permissions', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = ApproveSchema.parse(request.body);

    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, id),
    });

    if (!session) {
      return reply.status(404).send({ error: 'Session not found' });
    }

    if (session.status !== 'active') {
      return reply.status(400).send({ error: 'Session is not active' });
    }

    const [updated] = await db
      .update(sessions)
      .set({ permissions: body.permissions })
      .where(eq(sessions.id, id))
      .returning();

    await db.insert(consentEvents).values({
      session_id: id,
      event_type: body.permissions.control ? 'permission_granted' : 'permission_revoked',
      granted_by: 'client',
      permissions: body.permissions,
      ip_address: request.ip,
      user_agent: request.headers['user-agent'] || null,
    });

    return { session: updated };
  });
}
