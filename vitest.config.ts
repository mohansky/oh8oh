import { defineConfig } from 'vitest/config'
import viteTsConfigPaths from 'vite-tsconfig-paths'

// Deliberately separate from vite.config.ts: the app config loads the Nitro,
// TanStack Start and PWA plugins, which try to boot a server build and crash
// the test runner. Unit tests only need path aliases.
export default defineConfig({
  plugins: [viteTsConfigPaths({ projects: ['./tsconfig.json'] })],
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
