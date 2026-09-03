import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = process.env.VITE_API_TARGET || env.VITE_API_TARGET || 'http://localhost:4000';
  const authTarget = process.env.VITE_AUTH_TARGET || env.VITE_AUTH_TARGET || apiTarget;
  const sessionTarget = process.env.VITE_SESSION_TARGET || env.VITE_SESSION_TARGET || 'http://localhost:4001';
  const deviceTarget = process.env.VITE_DEVICE_TARGET || env.VITE_DEVICE_TARGET || 'http://localhost:4004';
  const auditTarget = process.env.VITE_AUDIT_TARGET || env.VITE_AUDIT_TARGET || 'http://localhost:4003';
  const signalingTarget = process.env.VITE_SIGNALING_TARGET || env.VITE_SIGNALING_TARGET || 'ws://localhost:4002';

  return {
    base: '/join/',
    plugins: [react()],
    server: {
      port: 5174,
      host: true,
      proxy: {
        '/v1/auth': {
          target: authTarget,
          changeOrigin: true,
        },
        '/v1/sessions': {
          target: sessionTarget,
          changeOrigin: true,
        },
        '/v1/devices': {
          target: deviceTarget,
          changeOrigin: true,
        },
        '/v1/audit': {
          target: auditTarget,
          changeOrigin: true,
        },
        '/v1': {
          target: apiTarget,
          changeOrigin: true,
        },
        '/ws': {
          target: signalingTarget,
          ws: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
    },
  };
});
