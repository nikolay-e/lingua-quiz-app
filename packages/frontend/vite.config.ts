import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    svelte(),
    VitePWA({
      strategies: 'generateSW',
      registerType: 'autoUpdate',
      devOptions: {
        enabled: false, // Disable PWA in development to avoid caching issues
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,jpg,jpeg,gif,ico,svg,woff,woff2}'],
        maximumFileSizeToCacheInBytes: 3000000,
        skipWaiting: true, // Automatically update service worker
        clientsClaim: true, // Take control of all clients immediately
        cleanupOutdatedCaches: true, // Clean up old caches automatically
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 365 days
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 365 days
              },
            },
          },
          {
            urlPattern: /\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60, // 1 hour
              },
              networkTimeoutSeconds: 10,
            },
          },
        ],
      },
      manifest: {
        name: 'LinguaQuiz',
        short_name: 'LinguaQuiz',
        description: 'Interactive language learning quiz application',
        theme_color: '#4a90e2',
        background_color: '#f4f7f9',
        display: 'standalone',
        icons: [
          {
            src: '/favicon/android-chrome-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/favicon/android-chrome-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_API_URL || 'http://localhost:9000',
        changeOrigin: true,
      },
    },
    headers: {
      // Disable caching in development
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  },
  preview: { port: 5173, strictPort: true },
  publicDir: 'public',
  build: {
    target: ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14'],
    sourcemap: false, // Disable sourcemaps in production to avoid information disclosure
    minify: 'esbuild',
    cssMinify: true,
    rollupOptions: {
      output: {
        // Generate hashed filenames with timestamp for better cache busting
        assetFileNames: `assets/[name]-[hash]-${Date.now()}[extname]`,
        chunkFileNames: `assets/[name]-[hash]-${Date.now()}.js`,
        entryFileNames: `assets/[name]-[hash]-${Date.now()}.js`,
        // Remove comments from build
        banner: '',
        footer: '',
        intro: '',
        outro: '',
      },
    },
  },
  esbuild: {
    target: 'es2020',
    // Remove console.log and debugger statements in production
    drop: ['console', 'debugger'],
    // Remove comments
    legalComments: 'none',
  },
});
