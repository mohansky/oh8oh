//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'

export default [
  // Build output, generated files, and plain-JS config files (which the
  // type-aware parser can't load because they aren't part of the TS project)
  {
    ignores: [
      '.output/**',
      '.nitro/**',
      '.tanstack/**',
      '.wrangler/**',
      'dist/**',
      'dev-dist/**',
      'src/routeTree.gen.ts',
      '*.config.js',
    ],
  },
  ...tanstackConfig,
  {
    rules: {
      // This rule trusts the types, but several guards here protect against
      // things the types can't see: `process.env` being absent on Workers,
      // `navigator.share` missing in some browsers, and loosely-typed
      // (`any`-shimmed) Better Auth and scraper data. Removing those guards to
      // satisfy the rule would trade real runtime safety for a clean report.
      '@typescript-eslint/no-unnecessary-condition': 'off',
    },
  },
]
