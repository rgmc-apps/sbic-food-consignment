import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';
import { execSync } from 'node:child_process';
import { APP_VERSION } from './src/version';

// Same mechanism as rgmc-consignment-webapp: short commit SHA (if this ever
// becomes a git checkout — it isn't one yet, so this quietly returns null and
// getBuildId() falls back to the timestamp alone) plus a build timestamp, so
// every deploy gets a traceable "when was this actually built" stamp without
// any commit-back workflow.
function getGitSha(): string | null {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim() || null;
  } catch {
    return null;
  }
}

function getBuildId(): string {
  const sha = getGitSha();
  const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
  return sha ? `${sha} · ${timestamp}` : timestamp;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = env.VITE_API_BASE_URL;

  return {
    plugins: [vue()],
    define: {
      __APP_VERSION__: JSON.stringify(APP_VERSION),
      __APP_BUILD__: JSON.stringify(getBuildId()),
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('/bcryptjs/')) return undefined; // stays a lazy chunk (login only)
            if (id.includes('/@ionic/') || id.includes('/ionicons/')) return 'ionic';
            if (id.includes('/vue') || id.includes('/pinia/') || id.includes('/@vue/')) return 'vue';
            return 'vendor';
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 8200,
      // Every backend call this app makes is live (no cache) — the /food prefix is
      // this app's own dedicated, uncached router on rgmc-bc-api (see Phase 2 of the
      // build plan). It never touches the garments app's /bc, /internal or /tasks paths.
      proxy: proxyTarget
        ? {
            '/food': { target: proxyTarget, changeOrigin: true, secure: true },
          }
        : undefined,
    },
  };
});
