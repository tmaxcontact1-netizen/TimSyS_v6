import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/students': { target: 'http://localhost:3000', changeOrigin: true },
      '/staff': { target: 'http://localhost:3000', changeOrigin: true },
      '/rooms': { target: 'http://localhost:3000', changeOrigin: true },
      '/inventory': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  build: { outDir: 'dist' },
});
