import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { loadConfig } from '@screenkonect/config';
import { deviceRoutes } from './routes/devices';
import { verifyAccessToken } from '@screenkonect/shared';

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

app.register(cors, {
  origin: config.security.cors_origins,
  credentials: true,
});

app.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'wss:', 'ws:'],
    },
  },
});

app.register(rateLimit, {
  max: config.security.rate_limit_max_requests,
  timeWindow: config.security.rate_limit_window_ms,
});

app.register(deviceRoutes, { prefix: '/v1/devices' });

app.get('/healthz', async () => ({ status: 'ok' }));
app.get('/readyz', async () => ({ status: 'ok' }));

const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '4004');
    await app.listen({ port, host: config.host });
    console.log(`[device] Server listening on ${config.host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
