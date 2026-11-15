import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const config = defineConfig({
  resolve: {
    alias: {
      'cross-fetch': require.resolve('cross-fetch/dist/browser-ponyfill.js'),
    },
  },
  plugins: [
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'o8o.svg', 'robots.txt'],
      manifest: {
        short_name: 'oh8oh',
        name: 'oh eight oh - Bangalore Events',
        description: 'Discover and explore upcoming events in Bangalore. Your go-to event aggregator for concerts, workshops, exhibitions, and more.',
        icons: [
          {
            src: 'favicon.ico',
            sizes: '64x64 32x32 24x24 16x16',
            type: 'image/x-icon'
          },
          {
            src: 'logo72.png',
            type: 'image/png',
            sizes: '72x72',
            purpose: 'any'
          },
          {
            src: 'logo96.png',
            type: 'image/png',
            sizes: '96x96',
            purpose: 'any'
          },
          {
            src: 'logo128.png',
            type: 'image/png',
            sizes: '128x128',
            purpose: 'any'
          },
          {
            src: 'logo144.png',
            type: 'image/png',
            sizes: '144x144',
            purpose: 'any'
          },
          {
            src: 'logo152.png',
            type: 'image/png',
            sizes: '152x152',
            purpose: 'any'
          },
          {
            src: 'logo192.png',
            type: 'image/png',
            sizes: '192x192',
            purpose: 'any'
          },
          {
            src: 'logo384.png',
            type: 'image/png',
            sizes: '384x384',
            purpose: 'any'
          },
          {
            src: 'logo512.png',
            type: 'image/png',
            sizes: '512x512',
            purpose: 'any'
          },
          {
            src: 'o8o-maskable.png',
            type: 'image/png',
            sizes: '512x512',
            purpose: 'maskable'
          }
        ],
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait-primary',
        theme_color: '#000000',
        background_color: '#000000',
        categories: ['entertainment', 'lifestyle', 'social'],
        prefer_related_applications: false
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /\.(png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ],
        navigateFallback: null,
        cleanupOutdatedCaches: true
      },
      devOptions: {
        enabled: true,
        type: 'module'
      },
      // Important: Disable during SSR builds
      disable: process.env.VITE_ENVIRONMENT === 'ssr',
      integration: {
        closeBundleOrder: 'pre'
      }
    }),
    devtools(),
    nitro(),
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
