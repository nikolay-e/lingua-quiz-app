import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { sveltePreprocess } from 'svelte-preprocess';

export default defineConfig({
  plugins: [
    svelte({
      preprocess: sveltePreprocess(),
    }),
  ],
  server: {
    port: 8080,
  },
  publicDir: 'public',
  build: {
    target: ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14'],
    sourcemap: false, // Disable sourcemaps in production to avoid information disclosure
    minify: 'esbuild',
    cssMinify: true,
    rollupOptions: {
      output: {
        // Generate hashed filenames for better caching
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
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
