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
        // Allow 'join' as explicit registration (technician waits for offer)
        const isJoin = (msg as any).type === 'join';
        if (msg.type !== 'offer' && msg.type !== 'answer' && !isJoin) {
          return;
        }

        const targetSessionId = (msg as any).session_id || sessionId;
        const session = await db.query.sessions.findFirst({
          where: eq(sessions.id, targetSessionId),
        });

        if (!session) {
          ws.send(JSON.stringify({ type: 'error', message: 'Session not found' }));
          return;
        }

        if (session.status !== 'active' && session.status !== 'pending_approval') {
          ws.send(JSON.stringify({ type: 'error', message: 'Session is not active' }));
          return;
        }

        sessionId = targetSessionId;
        if (isJoin) {
          clientRole = (msg as any).role === 'client' ? 'client' : 'technician';
        } else {
          clientRole = msg.type === 'offer' ? 'client' : 'technician';
        }

        const clientId = `${sessionId}:${clientRole}:${Date.now()}`;
        clients.set(clientId, { ws, sessionId, role: clientRole });

        await redis.sadd(`${SESSION_PREFIX}${sessionId}`, clientId);

        ws.send(JSON.stringify({ type: 'connected', session_id: sessionId, role: clientRole }));

        redis.publish(
          `session:${sessionId}:presence`,
          JSON.stringify({ role: clientRole, action: 'joined' })
        );

        // Also relay the initial offer/answer to the opposite peer if already connected.
        // Without this, the first offer is swallowed and the technician never receives it.
        // Store offer if no peer yet, so late joiner can get it.
        const isJoinForForward = (msg as any).type === 'join';
        if (!isJoinForForward) {
          if (msg.type === 'offer') {
            await redis.setex(`signaling:offer:${sessionId}`, 300, JSON.stringify(msg));
          }
          {
            const targetRole = clientRole === 'client' ? 'technician' : 'client';
            const sessionClients = await redis.smembers(`${SESSION_PREFIX}${sessionId}`);
            let forwarded = false;
            for (const otherId of sessionClients) {
              const client = clients.get(otherId);
              if (client && client.role === targetRole && client.ws.readyState === WebSocket.OPEN) {
                client.ws.send(JSON.stringify(msg));
                forwarded = true;
              }
            }
            // If offer had no peer to forward to, it stays in Redis for late joiner
            if (msg.type === 'offer' && !forwarded) {
              console.log(`[signaling] stored offer for ${sessionId}, no ${targetRole} yet`);
            }
          }
        }

        // If this is a technician joining and there's a pending offer from client, deliver it now
        if (clientRole === 'technician') {
          const pendingOffer = await redis.get(`signaling:offer:${sessionId}`);
          if (pendingOffer) {
            try {
              ws.send(pendingOffer);
              console.log(`[signaling] delivered pending offer to technician ${sessionId}`);
            } catch {}
          }
        }

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

      // Relay WebRTC signaling between opposite roles.
      // Permissions.control only gates data-channel input events, NOT offer/answer/ice.
      const isSignaling = msg.type === 'offer' || msg.type === 'answer' || msg.type === 'ice-candidate';
      if (isSignaling) {
        const targetRole = clientRole === 'client' ? 'technician' : 'client';
        const sessionClients = await redis.smembers(`${SESSION_PREFIX}${sessionId}`);
        for (const clientId of sessionClients) {
          const client = clients.get(clientId);
          if (client && client.role === targetRole && client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(JSON.stringify(msg));
          }
        }
        return;
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
