import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      react: resolve(import.meta.dirname, 'node_modules', 'react'),
      'react-dom': resolve(import.meta.dirname, 'node_modules', 'react-dom'),
    },
  },
  server: {
    port: 5180,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/students': { target: 'http://localhost:3000', changeOrigin: true },
      '/staff': { target: 'http://localhost:3000', changeOrigin: true },
      '/rooms': { target: 'http://localhost:3000', changeOrigin: true },
      '/inventory': { target: 'http://localhost:3000', changeOrigin: true },
      '/modules': { target: 'http://localhost:3000', changeOrigin: true },
      '/cover': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  build: { outDir: 'dist' },
});
