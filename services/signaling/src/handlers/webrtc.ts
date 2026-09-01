import { WebSocket } from 'ws';
import Redis from 'ioredis';
import { db, sessions } from '@screenkonect/db';
import { eq } from 'drizzle-orm';
import { SignalingMessage } from '@screenkonect/shared';

interface ConnectedClient {
  ws: WebSocket;
  sessionId: string;
  role: 'technician' | 'client';
  userId?: string;
}

const clients = new Map<string, ConnectedClient>();
const SESSION_PREFIX = 'signaling:session:';

export async function signalingHandler(
  ws: WebSocket,
  redis: Redis
) {
  let sessionId: string | null = null;
  let clientRole: 'technician' | 'client' | null = null;

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString()) as SignalingMessage;

      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', session_id: msg.session_id }));
        return;
      }

      if (!sessionId) {
        if (msg.type !== 'offer' && msg.type !== 'answer') {
          return;
        }

        const session = await db.query.sessions.findFirst({
          where: eq(sessions.id, msg.session_id),
        });

        if (!session) {
          ws.send(JSON.stringify({ type: 'error', message: 'Session not found' }));
          return;
        }

        if (session.status !== 'active' && session.status !== 'pending_approval') {
          ws.send(JSON.stringify({ type: 'error', message: 'Session is not active' }));
          return;
        }

        sessionId = msg.session_id;
        clientRole = msg.type === 'offer' ? 'client' : 'technician';

        const clientId = `${sessionId}:${clientRole}:${Date.now()}`;
        clients.set(clientId, { ws, sessionId, role: clientRole });

        await redis.sadd(`${SESSION_PREFIX}${sessionId}`, clientId);

        ws.send(JSON.stringify({ type: 'connected', session_id: sessionId, role: clientRole }));

        redis.publish(
          `session:${sessionId}:presence`,
          JSON.stringify({ role: clientRole, action: 'joined' })
        );

        return;
      }

      if (!sessionId || !clientRole) {
        return;
      }

      const session = await db.query.sessions.findFirst({
        where: eq(sessions.id, sessionId),
      });

      if (!session || session.status === 'ended') {
        ws.send(JSON.stringify({ type: 'error', message: 'Session ended' }));
        ws.close();
        return;
      }

      if (clientRole === 'client' && !session.permissions?.control) {
        if (msg.type === 'answer' || msg.type === 'ice-candidate') {
          const sessionClients = await redis.smembers(`${SESSION_PREFIX}${sessionId}`);
          for (const clientId of sessionClients) {
            const client = clients.get(clientId);
            if (client && client.role === 'technician' && client.ws.readyState === WebSocket.OPEN) {
              client.ws.send(JSON.stringify(msg));
            }
          }
        }
      }

      if (clientRole === 'technician') {
        if (msg.type === 'offer') {
          const sessionClients = await redis.smembers(`${SESSION_PREFIX}${sessionId}`);
          for (const clientId of sessionClients) {
            const client = clients.get(clientId);
            if (client && client.role === 'client' && client.ws.readyState === WebSocket.OPEN) {
              client.ws.send(JSON.stringify(msg));
            }
          }
        } else if (msg.type === 'ice-candidate') {
          const sessionClients = await redis.smembers(`${SESSION_PREFIX}${sessionId}`);
          for (const clientId of sessionClients) {
            const client = clients.get(clientId);
            if (client && client.role === 'client' && client.ws.readyState === WebSocket.OPEN) {
              client.ws.send(JSON.stringify(msg));
            }
          }
        }
      }

      if (msg.type === 'consent-update' || msg.type === 'permission-update' || msg.type === 'session-end') {
        const sessionClients = await redis.smembers(`${SESSION_PREFIX}${sessionId}`);
        for (const clientId of sessionClients) {
          const client = clients.get(clientId);
          if (client && client.ws.readyState === WebSocket.OPEN && client.ws !== ws) {
            client.ws.send(JSON.stringify(msg));
          }
        }
      }
    } catch (err) {
      console.error('[signaling] Error processing message:', err);
    }
  });

  ws.on('close', async () => {
    if (sessionId) {
      const sessionClients = await redis.smembers(`${SESSION_PREFIX}${sessionId}`);
      for (const clientId of sessionClients) {
        const client = clients.get(clientId);
        if (client && client.ws === ws) {
          clients.delete(clientId);
          await redis.srem(`${SESSION_PREFIX}${sessionId}`, clientId);

          redis.publish(
            `session:${sessionId}:presence`,
            JSON.stringify({ role: clientRole, action: 'left' })
          );
          break;
        }
      }
    }
  });

  ws.on('error', (err) => {
    console.error('[signaling] WebSocket error:', err);
  });
}
