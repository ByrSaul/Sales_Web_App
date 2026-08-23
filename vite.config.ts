import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  if (command === 'build' && (env.VITE_AUTH_MODE === 'dev-token' || mode === 'e2e')) {
    throw new Error('Los modos de autenticación temporal no están permitidos en builds de producción.');
  }
  return {
    plugins: [react()],
    build: { sourcemap: false },
    test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'], include: ['src/**/*.test.{ts,tsx}'] },
  };
});
