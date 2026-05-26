import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:3000', changeOrigin: true },
      '/ws': { target: 'ws://127.0.0.1:3000', ws: true, changeOrigin: true },
      '/reports-static': { target: 'http://127.0.0.1:3000', changeOrigin: true },
    },
  },
  build: {
    outDir: '../public-ui',
    emptyOutDir: true,
  },
});
