import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db, devices, deviceSessions, sessions, users, companies } from '@screenkonect/db';
import { eq, and, gt } from 'drizzle-orm';
import { generateRandomToken, hashToken, generateId } from '@screenkonect/shared';
import { verifyAccessToken } from '@screenkonect/shared';
import { loadConfig } from '@screenkonect/config';

const config = loadConfig();

const EnrollDeviceSchema = z.object({
  device_name: z.string().min(1).max(255),
  platform: z.enum(['windows', 'macos', 'linux']),
  platform_version: z.string().optional(),
  agent_version: z.string().optional(),
  hostname: z.string().optional(),
  mac_address: z.string().optional(),
  company_id: z.string().uuid().optional(),
  assigned_user_id: z.string().uuid().optional(),
  access_policy: z.enum(['consent_required', 'notification_only', 'admin_only']).optional(),
  allowed_technician_ids: z.array(z.string().uuid()).optional(),
  notify_user_on_connect: z.boolean().optional(),
});

const UpdateDeviceSchema = z.object({
  device_name: z.string().min(1).max(255).optional(),
  company_id: z.string().uuid().optional(),
  assigned_user_id: z.string().uuid().optional(),
  access_policy: z.enum(['consent_required', 'notification_only', 'admin_only']).optional(),
  allowed_technician_ids: z.array(z.string().uuid()).optional(),
  notify_user_on_connect: z.boolean().optional(),
  is_active: z.boolean().optional(),
});

const DeviceAuthSchema = z.object({
  enrollment_token: z.string(),
  device_name: z.string().optional(),
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

export async function deviceRoutes(app: FastifyInstance) {
  // Generate enrollment token for a new device
  app.post('/enroll', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = EnrollDeviceSchema.parse(request.body);
    const user = (request as any).user;

    const enrollmentToken = generateRandomToken(32);
    const enrollmentTokenHash = hashToken(enrollmentToken);

    const [device] = await db
      .insert(devices)
      .values({
        enrollment_token_hash: enrollmentTokenHash,
        device_name: body.device_name,
        platform: body.platform,
        platform_version: body.platform_version,
        agent_version: body.agent_version,
        hostname: body.hostname,
        mac_address: body.mac_address,
        company_id: body.company_id,
        assigned_user_id: body.assigned_user_id,
        access_policy: body.access_policy || 'consent_required',
        allowed_technician_ids: body.allowed_technician_ids || [user.sub],
        notify_user_on_connect: body.notify_user_on_connect ?? true,
      })
      .returning();

    return reply.status(201).send({
      device,
      enrollment_token: enrollmentToken,
      enrollment_url: `screenkonect://enroll?token=${enrollmentToken}`,
    });
  });

  // Device authenticates using enrollment token (called by agent)
  app.post('/authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = DeviceAuthSchema.parse(request.body);

    const enrollmentTokenHash = hashToken(body.enrollment_token);
    const device = await db.query.devices.findFirst({
      where: and(
        eq(devices.enrollment_token_hash, enrollmentTokenHash),
        eq(devices.is_active, true)
      ),
    });

    if (!device) {
      return reply.status(401).send({ error: 'Invalid or inactive enrollment token' });
    }

    // Update last seen and IP
    await db
      .update(devices)
      .set({
        last_seen_at: new Date(),
        last_ip: request.ip,
        ...(body.hostname && { hostname: body.hostname }),
      })
      .where(eq(devices.id, device.id));

    return {
      device_id: device.id,
      device_name: device.device_name,
      access_policy: device.access_policy,
      notify_user_on_connect: device.notify_user_on_connect,
      allowed_technician_ids: device.allowed_technician_ids,
    };
  });

  // List devices for authenticated user
  app.get('/', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;

    const userDevices = await db.query.devices.findMany({
      where: eq(devices.is_active, true),
      orderBy: (devices, { desc }) => [desc(devices.last_seen_at)],
    });

    return { devices: userDevices };
  });

  // Get device details
  app.get('/:id', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const device = await db.query.devices.findFirst({
      where: eq(devices.id, id),
    });

    if (!device) {
      return reply.status(404).send({ error: 'Device not found' });
    }

    return { device };
  });

  // Update device settings
  app.patch('/:id', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = UpdateDeviceSchema.parse(request.body);
    const user = (request as any).user;

    const device = await db.query.devices.findFirst({
      where: eq(devices.id, id),
    });

    if (!device) {
      return reply.status(404).send({ error: 'Device not found' });
    }

    const [updated] = await db
      .update(devices)
      .set(body)
      .where(eq(devices.id, id))
      .returning();

    return { device: updated };
  });

  // Delete device (uninstall)
  app.delete('/:id', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const device = await db.query.devices.findFirst({
      where: eq(devices.id, id),
    });

    if (!device) {
      return reply.status(404).send({ error: 'Device not found' });
    }

    // Soft delete - mark as inactive
    await db
      .update(devices)
      .set({ is_active: false })
      .where(eq(devices.id, id));

    return { message: 'Device removed' };
  });

  // Get device session history
  app.get('/:id/sessions', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const deviceSessionsList = await db.query.deviceSessions.findMany({
      where: eq(deviceSessions.device_id, id),
      orderBy: (deviceSessions, { desc }) => [desc(deviceSessions.connected_at)],
      limit: 50,
    });

    return { sessions: deviceSessionsList };
  });

  // Device heartbeat (called by agent periodically)
  app.post('/:id/heartbeat', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const device = await db.query.devices.findFirst({
      where: eq(devices.id, id),
    });

    if (!device || !device.is_active) {
      return reply.status(401).send({ error: 'Device not found or inactive' });
    }

    await db
      .update(devices)
      .set({
        last_seen_at: new Date(),
        last_ip: request.ip,
      })
      .where(eq(devices.id, id));

    return {
      status: 'ok',
      access_policy: device.access_policy,
      notify_user_on_connect: device.notify_user_on_connect,
    };
  });

  // Generate new enrollment token for existing device
  app.post('/:id/re-enroll', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const device = await db.query.devices.findFirst({
      where: eq(devices.id, id),
    });

    if (!device) {
      return reply.status(404).send({ error: 'Device not found' });
    }

    const newEnrollmentToken = generateRandomToken(32);
    const newEnrollmentTokenHash = hashToken(newEnrollmentToken);

    await db
      .update(devices)
      .set({ enrollment_token_hash: newEnrollmentTokenHash })
      .where(eq(devices.id, id));

    return {
      enrollment_token: newEnrollmentToken,
      enrollment_url: `screenkonect://enroll?token=${newEnrollmentToken}`,
    };
  });

  // Get company info (optional - for reporting/stats only)
  app.get('/company/:companyId', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { companyId } = request.params as { companyId: string };

    const company = await db.query.companies.findFirst({
      where: eq(companies.id, companyId),
    });

    if (!company) {
      return reply.status(404).send({ error: 'Company not found' });
    }

    return { company };
  });
}
