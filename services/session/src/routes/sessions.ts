import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db, sessions, sessionTokens, users, devices, deviceSessions } from '@screenkonect/db';
import { eq, and, gt } from 'drizzle-orm';
import { generateSessionCode, generateRandomToken, hashToken } from '@screenkonect/shared';
import { verifyAccessToken } from '@screenkonect/shared';
import { loadConfig } from '@screenkonect/config';

const config = loadConfig();

const CreateSessionSchema = z.object({
  device_id: z.string().uuid().optional(),
  max_duration_minutes: z.number().min(1).max(480).optional(),
  idle_timeout_minutes: z.number().min(1).max(120).optional(),
  recording_enabled: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const JoinSessionSchema = z.object({
  token: z.string(),
  platform: z.enum(['windows', 'macos', 'linux']),
  device_name: z.string().optional(),
  device_id: z.string().uuid().optional(),
  hostname: z.string().optional(),
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

export async function sessionRoutes(app: FastifyInstance) {
  // Create a new session (optionally targeting a specific device)
  app.post('/', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = CreateSessionSchema.parse(request.body);
    const user = (request as any).user;

    let accessMode = 'consent_required';
    let device = null;

    // If device_id is provided, verify the device exists and is active
    if (body.device_id) {
      device = await db.query.devices.findFirst({
        where: and(eq(devices.id, body.device_id), eq(devices.is_active, true)),
      });

      if (!device) {
        return reply.status(404).send({ error: 'Device not found or inactive' });
      }

      // Check if technician is allowed to connect to this device
      const allowedIds = device.allowed_technician_ids as string[];
      if (!allowedIds.includes(user.sub)) {
        return reply.status(403).send({ error: 'Not authorized to connect to this device' });
      }

      // Use device's access policy (unified for all devices)
      accessMode = device.access_policy || 'consent_required';
    }

    const sessionCode = generateSessionCode(8);
    const clientToken = generateRandomToken(32);
    const clientTokenHash = hashToken(clientToken);

    const [session] = await db
      .insert(sessions)
      .values({
        technician_id: user.sub,
        device_id: body.device_id,
        status: body.device_id ? 'pending_device' : 'created',
        session_code: sessionCode,
        client_token_hash: clientTokenHash,
        access_mode: accessMode,
        max_duration_minutes: body.max_duration_minutes || config.session_policy.default_expiry_minutes,
        idle_timeout_minutes: body.idle_timeout_minutes || config.session_policy.idle_timeout_minutes,
        recording_enabled: body.recording_enabled ?? config.session_policy.allow_recording,
        metadata: body.metadata || {},
      })
      .returning();

    const expiresAt = new Date(Date.now() + config.session_policy.consent_timeout_ms);
    await db.insert(sessionTokens).values({
      session_id: session.id,
      token_hash: clientTokenHash,
      token_type: 'client_join',
      expires_at: expiresAt,
    });

    // Use PUBLIC_URL if set (tailscale funnel https://xxx.ts.net), else use request host
    // This fixes localhost:8090 generating localhost links when technician is local but friend needs public
    const publicBase = (config as any).public_url || process.env.PUBLIC_URL;
    const joinUrl = body.device_id
      ? `screenkonect://join?session=${sessionCode}&token=${clientToken}`
      : publicBase
        ? `${publicBase.replace(/\/$/, '')}/join/${sessionCode}?token=${clientToken}`
        : `${request.protocol}://${request.headers.host}/join/${sessionCode}?token=${clientToken}`;

    return reply.status(201).send({
      session,
      join_url: joinUrl,
      join_token: clientToken,
      access_mode: accessMode,
    });
  });

  // List sessions
  app.get('/', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;

    const userSessions = await db.query.sessions.findMany({
      where: eq(sessions.technician_id, user.sub),
      orderBy: (sessions, { desc }) => [desc(sessions.created_at)],
      limit: 50,
    });

    return { sessions: userSessions };
  });

  // Get session details
  app.get('/:id', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const user = (request as any).user;

    const session = await db.query.sessions.findFirst({
      where: and(eq(sessions.id, id), eq(sessions.technician_id, user.sub)),
    });

    if (!session) {
      return reply.status(404).send({ error: 'Session not found' });
    }

    return { session };
  });

  // End session
  app.post('/:id/end', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const user = (request as any).user;

    const session = await db.query.sessions.findFirst({
      where: and(eq(sessions.id, id), eq(sessions.technician_id, user.sub)),
    });

    if (!session) {
      return reply.status(404).send({ error: 'Session not found' });
    }

    if (session.status === 'ended') {
      return reply.status(400).send({ error: 'Session already ended' });
    }

    const [updated] = await db
      .update(sessions)
      .set({
        status: 'ended',
        ended_at: new Date(),
        ended_reason: 'technician_ended',
      })
      .where(eq(sessions.id, id))
      .returning();

    // Update device session if exists
    if (session.device_id) {
      await db
        .update(deviceSessions)
        .set({
          disconnected_at: new Date(),
          disconnect_reason: 'technician_ended',
        })
        .where(
          and(
            eq(deviceSessions.session_id, id),
            eq(deviceSessions.device_id, session.device_id)
          )
        );
    }

    return { session: updated };
  });

  // Client joins session (browser or agent)
  app.post('/join', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = JoinSessionSchema.parse(request.body);

    const tokenHash = hashToken(body.token);
    // Allow rejoin within expiry (refresh/retry shouldn't kill 40min session).
    // One-time enforcement is opt-in via session_policy.one_time_link_usage.
    const sessionToken = await db.query.sessionTokens.findFirst({
      where: and(
        eq(sessionTokens.token_hash, tokenHash),
        eq(sessionTokens.token_type, 'client_join'),
        gt(sessionTokens.expires_at, new Date())
      ),
    });

    if (!sessionToken) {
      return reply.status(401).send({ error: 'Invalid or expired token. Create a NEW session link - old links expire after 45min and refresh needs a fresh link if rejoin fails.' });
    }
    if (sessionToken.used && config.session_policy.one_time_link_usage) {
      // Still allow same client to re-poll within active window; only block
      // brand-new joins after use when strict one-time mode is on.
      const existing = await db.query.sessions.findFirst({
        where: eq(sessions.id, sessionToken.session_id),
      });
      if (!existing || existing.status === 'ended') {
        return reply.status(401).send({ error: 'Invalid or expired token. Create a NEW session link.' });
      }
    }

    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, sessionToken.session_id),
    });

    if (!session) {
      return reply.status(404).send({ error: 'Session not found' });
    }

    if (session.status === 'ended') {
      return reply.status(400).send({ error: 'Session has ended' });
    }

    // Mark token as used only on first use (allows refresh/rejoin within 45min)
    if (!sessionToken.used) {
      await db
        .update(sessionTokens)
        .set({ used: true, used_at: new Date() })
        .where(eq(sessionTokens.id, sessionToken.id));
    }

    // Update session with client info
    const updateData: Record<string, unknown> = {
      status: 'pending_approval',
      consent_state: 'pending',
      client_platform: body.platform,
      client_ip: request.ip,
    };

    // If device_id is provided, link the device to the session
    if (body.device_id) {
      updateData.device_id = body.device_id;

      // Update device last seen
      await db
        .update(devices)
        .set({
          last_seen_at: new Date(),
          last_ip: request.ip,
        })
        .where(eq(devices.id, body.device_id));

      // Create device session record
      await db.insert(deviceSessions).values({
        device_id: body.device_id,
        session_id: session.id,
      });
    }

    const [updated] = await db
      .update(sessions)
      .set(updateData)
      .where(eq(sessions.id, session.id))
      .returning();

    // Determine consent requirements based on access mode
    let requiresConsent = config.session_policy.require_client_approval;
    let accessMode = session.access_mode || 'consent_required';

    // If device is enrolled, check access policy
    if (body.device_id) {
      const device = await db.query.devices.findFirst({
        where: eq(devices.id, body.device_id),
      });

      if (device) {
        // Get session to check technician
        const currentSession = await db.query.sessions.findFirst({
          where: eq(sessions.id, sessionToken.session_id),
        });

        const allowedIds = device.allowed_technician_ids as string[];
        const isAllowedTechnician = currentSession && allowedIds.includes(currentSession.technician_id);

        if (isAllowedTechnician) {
          // Use device's access policy (unified for all devices)
          switch (device.access_policy) {
            case 'admin_only':
              requiresConsent = false;
              accessMode = 'admin_only';
              break;

            case 'notification_only':
              requiresConsent = false;
              accessMode = 'notification_only';
              break;

            case 'consent_required':
            default:
              requiresConsent = true;
              accessMode = 'consent_required';
              break;
          }

          // Auto-approve for non-consent modes
          if (!requiresConsent) {
            await db
              .update(sessions)
              .set({
                consent_state: 'auto_approved',
                status: 'active',
                started_at: new Date(),
                access_mode: accessMode,
                permissions: {
                  view: true,
                  control: true,
                  clipboard: true,
                  file_transfer: false,
                  audio: false,
                },
              })
              .where(eq(sessions.id, session.id));

            updateData.status = 'active';
            updateData.consent_state = 'auto_approved';
          }
        }
      }
    }

    return {
      session: updated,
      requires_consent: requiresConsent,
      access_mode: accessMode,
    };
  });

  // Get consent state
  app.get('/:id/consent-state', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, id),
      columns: {
        id: true,
        status: true,
        consent_state: true,
        permissions: true,
        access_mode: true,
      },
    });

    if (!session) {
      return reply.status(404).send({ error: 'Session not found' });
    }

    return {
      consent_state: session.consent_state,
      permissions: session.permissions,
      access_mode: session.access_mode,
    };
  });

  // Delete a single session (only owner)
  app.delete('/:id', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const user = (request as any).user;

    const session = await db.query.sessions.findFirst({
      where: and(eq(sessions.id, id), eq(sessions.technician_id, user.sub)),
    });

    if (!session) {
      return reply.status(404).send({ error: 'Session not found' });
    }

    // Delete related tokens first (cascade would also handle, but be explicit)
    await db.delete(sessionTokens).where(eq(sessionTokens.session_id, id));
    await db.delete(sessions).where(eq(sessions.id, id));

    return { success: true, deleted_id: id };
  });

  // Bulk delete: delete by status or delete all for technician
  // Query: ?status=ended,expired,created or ?all=true
  // For safety, only allows deleting ended/expired or all with explicit confirm
  app.delete('/', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    const query = request.query as { status?: string; all?: string };

    if (query.all === 'true') {
      const toDelete = await db.query.sessions.findMany({
        where: eq(sessions.technician_id, user.sub),
        columns: { id: true },
      });
      const ids = toDelete.map((s) => s.id);
      if (ids.length > 0) {
        for (const sid of ids) {
          await db.delete(sessionTokens).where(eq(sessionTokens.session_id, sid));
        }
        await db.delete(sessions).where(eq(sessions.technician_id, user.sub));
      }
      return { success: true, deleted_count: ids.length };
    }

    const status = query.status as string | undefined;
    const allowedStatuses = ['ended', 'created', 'pending_approval', 'expired'];
    if (!status || !allowedStatuses.includes(status)) {
      return reply.status(400).send({ error: 'Provide ?status=ended|created|pending_approval|expired or ?all=true' });
    }

    // For expired: sessions where token expired or created_at old
    if (status === 'expired') {
      const expired = await db.query.sessions.findMany({
        where: and(eq(sessions.technician_id, user.sub), eq(sessions.status, 'created')),
      });
      const cutoff = new Date(Date.now() - config.session_policy.consent_timeout_ms);
      const expiredIds = expired.filter((s) => s.created_at && new Date(s.created_at) < cutoff).map((s) => s.id);
      for (const sid of expiredIds) {
        await db.delete(sessionTokens).where(eq(sessionTokens.session_id, sid));
      }
      if (expiredIds.length) {
        // delete one by one to handle foreign keys
        for (const sid of expiredIds) {
          await db.delete(sessions).where(eq(sessions.id, sid));
        }
      }
      return { success: true, deleted_count: expiredIds.length };
    }

    const toDelete = await db.query.sessions.findMany({
      where: and(eq(sessions.technician_id, user.sub), eq(sessions.status, status)),
      columns: { id: true },
    });
    for (const sid of toDelete.map((s) => s.id)) {
      await db.delete(sessionTokens).where(eq(sessionTokens.session_id, sid));
      await db.delete(sessions).where(eq(sessions.id, sid));
    }
    return { success: true, deleted_count: toDelete.length, status };
  });

  // Get available devices for the technician
  app.get('/devices/available', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;

    const availableDevices = await db.query.devices.findMany({
      where: and(
        eq(devices.is_active, true),
      ),
      orderBy: (devices, { desc }) => [desc(devices.last_seen_at)],
    });

    // Filter devices where technician is allowed
    const filteredDevices = availableDevices.filter((device) => {
      const allowedIds = device.allowed_technician_ids as string[];
      return allowedIds.includes(user.sub);
    });

    return { devices: filteredDevices };
  });
}
