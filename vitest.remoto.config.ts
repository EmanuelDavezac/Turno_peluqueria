import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

/**
 * Pruebas de integración contra el proyecto Supabase REMOTO (crean datos con prefijo ZZ-PRUEBA).
 * No forman parte de `npm test`. Correr con: npm run test:remoto
 * Credenciales del usuario de prueba del panel: `email` y `contraseña` en .env.local (ignorado por git).
 */
function leerEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const linea of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = linea.match(/^\s*([^#=\s][^=]*?)\s*=\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}

const env = leerEnvLocal();

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'node',
    include: ['src/**/*.remoto.ts'],
    testTimeout: 30_000,
    fileParallelism: false,
    env: {
      VITE_SUPABASE_URL: env.VITE_SUPABASE_URL ?? '',
      VITE_SUPABASE_PUBLISHABLE_KEY: env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '',
      PRUEBA_EMAIL: env.email ?? '',
      PRUEBA_PASSWORD: env['contraseña'] ?? '',
    },
  },
});
