import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { UserConfig } from 'vitest/config'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const { version } = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_URL || 'http://localhost:8787'

  return {
    define: {
      __APP_VERSION__: JSON.stringify(version),
    },
    plugins: [tailwindcss(), react()],
    base: mode === 'production' ? 'https://duckshort.pages.dev/' : '/',
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false,
      rollupOptions: {
        output: {
          entryFileNames: 'assets/index.js',
          chunkFileNames: 'assets/[name].js',
          assetFileNames: 'assets/[name][extname]',
        },
      },
    },
    server: {
      port: 3030,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
        '/preview': {
          target: apiTarget,
          changeOrigin: true,
        },
        '/password': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
    } satisfies UserConfig['test'],
  }
})
