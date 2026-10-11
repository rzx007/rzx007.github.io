import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5173,
    open: false,
  },
  build: {
    target: 'es2022',
    // The shaders bundle is large and self-contained; keep it as its own chunk.
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      output: {
        manualChunks: (id) => (id.includes('node_modules/shaders') ? 'shaders' : undefined),
      },
    },
  },
})
