import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

/**
 * The `base` path is set from an env var so the same build works both at a
 * domain root (a custom domain) and under a GitHub Pages project subpath
 * (`https://<user>.github.io/photospec/`). CI sets PHOTOSPEC_BASE=/photospec/.
 */
export default defineConfig({
  base: process.env.PHOTOSPEC_BASE ?? '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@domain': fileURLToPath(new URL('./src/domain', import.meta.url)),
      '@application': fileURLToPath(new URL('./src/application', import.meta.url)),
      '@infrastructure': fileURLToPath(new URL('./src/infrastructure', import.meta.url)),
      '@ui': fileURLToPath(new URL('./src/ui', import.meta.url)),
      '@content': fileURLToPath(new URL('./src/content', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // MediaPipe and pdf-lib are large and change rarely. Splitting them out
        // means a code change ships a small chunk instead of invalidating 800 kB
        // of vendor code in everyone's browser cache.
        manualChunks: {
          mediapipe: ['@mediapipe/tasks-vision'],
          pdf: ['pdf-lib'],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
