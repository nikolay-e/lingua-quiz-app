import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig(({ mode }) => {
  const serverAddress =
    mode === 'production'
      ? 'https://api-lingua-quiz.nikolay-eremeev.com:443'
      : 'https://test-api-lingua-quiz.nikolay-eremeev.com:443';

  return {
    root: 'src',
    build: {
      outDir: '../dist',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          main: 'src/index.html',
          login: 'src/login.html',
        },
        external: ['fs', 'https', 'path'], // Exclude Node.js built-in modules
      },
    },
    define: {
      'process.env.SERVER_ADDRESS': JSON.stringify(serverAddress),
    },
    plugins: [
      viteStaticCopy({
        targets: [
          {
            src: 'data/*',
            dest: '../dist/data',
          },
        ],
      }),
    ],
  };
});
