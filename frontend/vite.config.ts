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
    // Always use a relative base. The Worker at duckshort.cc proxies /assets/*
    // to Pages, so the browser sees assets as same-origin. The previous
    // production override (https://duckshort.pages.dev/) bypassed the Worker
    // and triggered CSP 'self' mismatches on the proxy origin.
    base: '/',
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
