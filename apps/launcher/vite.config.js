import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    fs: {
      allow: ['/home/tmax/TimSyS_v6']
    },
    watch: {
      ignored: [
        '**/node_modules/**',
        '**/platform/**',
        '**/apps/memecoined/**',
        '**/apps/principaled/**',
        '**/.git/**',
      ]
    },
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/health': { target: 'http://localhost:3000', changeOrigin: true },
      '/students': { target: 'http://localhost:3000', changeOrigin: true },
      '/staff': { target: 'http://localhost:3000', changeOrigin: true },
      '/rooms': { target: 'http://localhost:3000', changeOrigin: true },
      '/inventory': { target: 'http://localhost:3000', changeOrigin: true },
      '/apps': { target: 'http://localhost:3000', changeOrigin: true },
      '/analytics': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
