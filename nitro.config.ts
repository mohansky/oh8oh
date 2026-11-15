import { defineNitroConfig } from 'nitro/config'

export default defineNitroConfig({
  // Use pure Cloudflare Workers preset (not Pages)
  preset: process.env.NODE_ENV === 'production' ? 'cloudflare-module' : undefined,

  // Development server
  devServer: {
    watch: ['src/**/*'],
  },

  // Source maps for debugging
  sourcemap: true,

  // Cloudflare Workers supports WASM natively
  experimental: {
    wasm: true,
  },

  // Externalize large dependencies to reduce bundle size
  externals: {
    inline: [
      // Inline only necessary dependencies
    ],
  },

  // Rollup options for Workers
  rollupConfig: {
    output: {
      format: 'esm',
      inlineDynamicImports: false,
    },
  },
})
