import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  base: './',
  server: {
    port: 5173,
    strictPort: false
  },
  build: {
    chunkSizeWarningLimit: 1600
  }
});
