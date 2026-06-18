import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'

export default defineWorkersConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // 5.4: Coverage gate. The Workers Vitest pool does not support V8
    // coverage (uses node:inspector which workerd does not provide), so we
    // use Istanbul instrumentation. Thresholds are intentionally low
    // (ratchet up over time):
    //   lines: 60%, functions: 60%, branches: 50%, statements: 60%
    // New code MUST be covered or `npm run test:coverage` fails. After the
    // baseline stabilises, ratchet each threshold up by 5pp per quarter.
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'html', 'json-summary'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'src/types.ts',
        'src/ui/**',
        'src/index.tsx',
        'src/**/*.d.ts',
      ],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 50,
        statements: 60,
      },
    },
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.toml' },
        miniflare: {
          bindings: {
            ADMIN_SECRET: 'test-secret',
            // 1.2: dedicated session HMAC key for tests. Distinct from
            // ADMIN_SECRET so we can verify the cookie path actually uses
            // SESSION_SECRET (and doesn't fall through to the legacy key).
            SESSION_SECRET: 'test-session-secret',
            BASE_URL: 'http://localhost',
          },
          d1Databases: ['DB'],
        },
      },
    },
  },
})
