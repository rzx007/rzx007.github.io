import { defineConfig } from 'vite'

/**
 * `base` matters: this is a *project* Pages site, so it is served from
 * https://<user>.github.io/<repo>/ rather than the domain root. Vite's built
 * output references assets absolutely (/assets/…), which would 404 there.
 *
 * Local dev stays on '/' so `npm run dev` is unchanged; only the build gets the
 * prefix. If the repository is ever renamed, this string must change with it.
 */
const REPO = 'tobias-quill'

export default defineConfig(({ command }) => ({
  base: command === 'build' ? `/${REPO}/` : '/',

  server: {
    host: '127.0.0.1',
    port: 5173,
    open: false,
  },

  build: {
    target: 'es2022',
    // The shaders bundle is large and self-contained; keep it as its own chunk
    // so it stays off the critical path and caches independently.
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      output: {
        manualChunks: (id) => (id.includes('node_modules/shaders') ? 'shaders' : undefined),
      },
    },
  },
}))
