import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { loadConfig } from '@screenkonect/config';
import { signalingHandler } from './handlers/webrtc';
import Redis from 'ioredis';

const config = loadConfig();

const app = Fastify({
  logger: {
    level: config.observability.log_level,
    transport:
      process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  },
});

const redis = new Redis(config.redis_url);

redis.on('error', (err) => {
  console.error('[signaling] Redis connection error:', err);
});

app.register(cors, {
  origin: config.security.cors_origins,
  credentials: true,
});

app.register(websocket);

app.register(async function (fastify) {
  fastify.get('/ws/signaling', { websocket: true }, (socket) => {
    signalingHandler(socket, redis);
  });
});

app.get('/healthz', async () => ({ status: 'ok' }));
app.get('/readyz', async () => {
  const redisOk = redis.status === 'ready';
  return { status: redisOk ? 'ok' : 'degraded', redis: redisOk };
});

const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '4002');
    await app.listen({ port, host: config.host });
    console.log(`[signaling] Server listening on ${config.host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
