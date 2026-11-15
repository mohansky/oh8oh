import { fileURLToPath } from 'node:url'
import { defineNitroConfig } from 'nitro/config'

// Reflect.metadata polyfill for tsyringe (used by @simplewebauthn in passkey plugin)
// Must run before any module evaluation, so injected as a rollup banner
const reflectPolyfill = `
if(typeof Reflect.getMetadata!=="function"){
  const s=new WeakMap();
  function g(t){let m=s.get(t);if(!m){m=new Map();s.set(t,m)}return m}
  Reflect.getMetadata=(k,t)=>g(t).get(k);
  Reflect.getOwnMetadata=(k,t)=>g(t).get(k);
  Reflect.defineMetadata=(k,v,t)=>{g(t).set(k,v)};
  Reflect.metadata=(k,v)=>(t)=>{g(t).set(k,v)};
}
`

export default defineNitroConfig({
  // Use pure Cloudflare Workers preset (not Pages)
  preset: process.env.NODE_ENV === 'production' ? 'cloudflare-module' : undefined,

  // Server plugins. scheduled-scrape hooks Cloudflare's scheduled() handler
  // (fired by the Cron Trigger in wrangler.toml) to run the daily full scrape.
  plugins: [
    fileURLToPath(new URL('./src/lib/cron/scheduled-scrape.ts', import.meta.url)),
  ],

  // Development server
  devServer: {
    watch: ['src/**/*'],
  },

  // Source maps for debugging
  sourcemap: true,

  // Disable WASM to prevent unwasm plugin corruption
  experimental: {
    wasm: false,
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
      banner: reflectPolyfill,
    },
  },

  // Export conditions for Cloudflare Workers compatibility
  exportConditions: ['workerd', 'edge-light', 'browser', 'import', 'default'],

  // Replace Node.js-only polyfills with empty stubs for Workers
  unenv: {
    alias: {
      'node-fetch': 'node-fetch/browser',
    },
  },
})
