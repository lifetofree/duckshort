import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'

export default defineWorkersConfig({
  test: {
    include: ['test/**/*.test.ts'],
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.toml' },
        miniflare: {
          bindings: {
            ADMIN_SECRET: 'test-secret',
            BASE_URL: 'http://localhost',
          },
          d1Databases: ['DB'],
        },
      },
    },
  },
})
