import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db, users, refreshTokens } from '@screenkonect/db';
import { eq, and, gt } from 'drizzle-orm';
import { hashPassword, verifyPassword, generateRandomToken, hashToken, verifyAccessToken } from '@screenkonect/shared';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '@screenkonect/shared';
import { loadConfig } from '@screenkonect/config';

const config = loadConfig();

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  display_name: z.string().min(1).max(100),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const RefreshSchema = z.object({
  refresh_token: z.string(),
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

export async function authRoutes(app: FastifyInstance) {
  app.get('/me', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;

    const foundUser = await db.query.users.findFirst({
      where: eq(users.id, user.sub),
      columns: {
        id: true,
        email: true,
        display_name: true,
        role: true,
        company_id: true,
        mfa_enabled: true,
        created_at: true,
        updated_at: true,
        last_login_at: true,
      },
    });

    if (!foundUser) {
      return reply.status(404).send({ error: 'User not found' });
    }

    return { user: foundUser };
  });

  app.post('/register', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = RegisterSchema.parse(request.body);

    const existing = await db.query.users.findFirst({
      where: eq(users.email, body.email),
    });

    if (existing) {
      return reply.status(409).send({ error: 'Email already registered' });
    }

    const passwordHash = await hashPassword(body.password);

    const [user] = await db
      .insert(users)
      .values({
        email: body.email,
        display_name: body.display_name,
        password_hash: passwordHash,
        role: 'technician',
      })
      .returning({
        id: users.id,
        email: users.email,
        display_name: users.display_name,
        role: users.role,
        created_at: users.created_at,
      });

    const accessToken = generateAccessToken({
      sub: user.id,
      email: user.email!,
      role: user.role as 'technician' | 'admin',
    });

    const refreshToken = generateRefreshToken({
      sub: user.id,
      email: user.email!,
      role: user.role as 'technician' | 'admin',
    });

    const tokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + config.security.refresh_token_expiry_days * 24 * 60 * 60 * 1000);

    await db.insert(refreshTokens).values({
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    return reply.status(201).send({
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: config.security.token_expiry_ms / 1000,
      token_type: 'Bearer',
      user,
    });
  });

  app.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = LoginSchema.parse(request.body);

    const user = await db.query.users.findFirst({
      where: eq(users.email, body.email),
    });

    if (!user || !user.password_hash) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const valid = await verifyPassword(body.password, user.password_hash);
    if (!valid) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    await db
      .update(users)
      .set({ last_login_at: new Date() })
      .where(eq(users.id, user.id));

    const accessToken = generateAccessToken({
      sub: user.id,
      email: user.email!,
      role: user.role as 'technician' | 'admin',
    });

    const refreshToken = generateRefreshToken({
      sub: user.id,
      email: user.email!,
      role: user.role as 'technician' | 'admin',
    });

    const tokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + config.security.refresh_token_expiry_days * 24 * 60 * 60 * 1000);

    await db.insert(refreshTokens).values({
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: config.security.token_expiry_ms / 1000,
      token_type: 'Bearer',
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        role: user.role,
        created_at: user.created_at,
        updated_at: user.updated_at,
        last_login_at: user.last_login_at,
        mfa_enabled: user.mfa_enabled,
      },
    };
  });

  app.post('/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = RefreshSchema.parse(request.body);

    let payload;
    try {
      payload = verifyRefreshToken(body.refresh_token);
    } catch {
      return reply.status(401).send({ error: 'Invalid refresh token' });
    }

    const tokenHash = hashToken(body.refresh_token);
    const storedToken = await db.query.refreshTokens.findFirst({
      where: and(
        eq(refreshTokens.user_id, payload.sub),
        eq(refreshTokens.token_hash, tokenHash),
        gt(refreshTokens.expires_at, new Date())
      ),
    });

    if (!storedToken || storedToken.revoked_at) {
      return reply.status(401).send({ error: 'Refresh token not found or revoked' });
    }

    await db
      .update(refreshTokens)
      .set({ revoked_at: new Date() })
      .where(eq(refreshTokens.id, storedToken.id));

    const newAccessToken = generateAccessToken({
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
    });

    const newRefreshToken = generateRefreshToken({
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
    });

    const newTokenHash = hashToken(newRefreshToken);
    const expiresAt = new Date(Date.now() + config.security.refresh_token_expiry_days * 24 * 60 * 60 * 1000);

    await db.insert(refreshTokens).values({
      user_id: payload.sub,
      token_hash: newTokenHash,
      expires_at: expiresAt,
    });

    return {
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      expires_in: config.security.token_expiry_ms / 1000,
      token_type: 'Bearer',
    };
  });

  app.post('/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = RefreshSchema.parse(request.body);

    const tokenHash = hashToken(body.refresh_token);
    await db
      .update(refreshTokens)
      .set({ revoked_at: new Date() })
      .where(eq(refreshTokens.token_hash, tokenHash));

    return { message: 'Logged out successfully' };
  });
}
