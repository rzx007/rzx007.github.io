import { defineConfig } from 'vite'

/**
 * GitHub Pages comes in two shapes, and `base` differs between them:
 *
 *   user site     repo named `<user>.github.io` → served from the domain root,
 *                 so assets are referenced from `/`.          ← this one
 *   project site  any other repo → served from `/<repo>/`, so `base` must be
 *                 `/<repo>/` or every asset 404s.
 *
 * This is the user-site case, served from https://rzx007.github.io/.
 * If the repository is ever renamed to something that is not
 * `<user>.github.io`, set BASE to `/<new-repo>/`.
 */
const BASE = '/'

export default defineConfig({
  base: BASE,

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
})
