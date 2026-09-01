import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { loadConfig } from '@screenkonect/config';
import { auditRoutes } from './routes/audit';

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

app.register(helmet);

app.register(auditRoutes, { prefix: '/v1/audit' });

app.get('/healthz', async () => ({ status: 'ok' }));
app.get('/readyz', async () => ({ status: 'ok' }));

const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '4003');
    await app.listen({ port, host: config.host });
    console.log(`[audit] Server listening on ${config.host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
